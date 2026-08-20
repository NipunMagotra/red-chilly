'use server'

import { cookies } from 'next/headers'
import { verifyGuestToken, GUEST_COOKIE_NAME } from '@/lib/auth/jwt'
import {
  tabManager,
  SEED_MENU,
  MenuItemRecord,
  GuestTabSession,
  OrderRoundRecord,
} from '@/lib/data/restaurant-data'
import { AppendOrderSchema } from '@/lib/validation/schemas'
import { auditLogger } from '@/lib/logging/audit-logger'

export interface AppendItemInput {
  menuItemId: string
  quantity: number
  notes?: string
}

export type TabActionDirective = 'NONE' | 'FORCE_CHECKOUT' | 'REAUTH_REQUIRED' | 'RETRY'

export interface AppendOrderResult {
  success: boolean
  error?: string
  actionRequired?: TabActionDirective
  session?: GuestTabSession
  newRound?: OrderRoundRecord
}

/**
 * Server Action: Appends order items directly into the guest's active Continuous Tab.
 * 
 * DEFENSE IN DEPTH:
 * 1. Runtime Zod Schema Validation: Rejects negative/zero/absurd quantities, malformed IDs, oversized notes.
 * 2. Authenticates session via signed HTTP-only JWT cookie.
 * 3. Idempotency Protection: Client-provided idempotencyKey deduplicates double-clicks and retries.
 * 4. Database Authority: Checks active session status and tokenVersion matching (rejects stale/revoked JWTs).
 * 5. Cross-Tenant IDOR Protection: Verifies that every menuItemId strictly belongs
 *    to the session's propertyId.
 * 6. Authoritative Pricing: Prices are looked up strictly from SEED_MENU.
 * 7. Immutable Audit Logging: Records every order round appended.
 */
export async function appendOrderToTab(
  items: AppendItemInput[],
  specialInstructions?: string,
  idempotencyKey?: string
): Promise<AppendOrderResult> {
  // 1. Strict Runtime Input Validation
  const validation = AppendOrderSchema.safeParse({
    items,
    specialInstructions,
    idempotencyKey,
  })

  if (!validation.success) {
    return {
      success: false,
      actionRequired: 'RETRY',
      error: validation.error.issues[0]?.message || 'Invalid order parameters.',
    }
  }

  const {
    items: validatedInputItems,
    specialInstructions: cleanSpecialInstructions,
    idempotencyKey: cleanIdempotencyKey,
  } = validation.data

  // 2. Authenticate via secure HTTP-only cookie
  const cookieStore = cookies()
  const token = cookieStore.get(GUEST_COOKIE_NAME)?.value

  if (!token) {
    return {
      success: false,
      actionRequired: 'REAUTH_REQUIRED',
      error: 'Unauthorized. Please scan your room QR code and enter your stay PIN.',
    }
  }

  const payload = await verifyGuestToken(token)
  if (!payload) {
    return {
      success: false,
      actionRequired: 'REAUTH_REQUIRED',
      error: 'Session expired or invalid. Please re-enter your stay PIN.',
    }
  }

  // 3. Database Authority & Session Validity Check
  const location = tabManager.getLocationByIdentifier(payload.locationIdentifier)
  if (!location || (payload.tokenVersion && payload.tokenVersion < (location.tokenVersion || 1))) {
    return {
      success: false,
      actionRequired: 'REAUTH_REQUIRED',
      error: 'Session has been invalidated (stay closed or new guest checked in). Please re-enter stay PIN.',
    }
  }

  const activeSession = tabManager.getSessionById(payload.sessionId)
  if (!activeSession || activeSession.status !== 'active') {
    return {
      success: false,
      actionRequired: 'FORCE_CHECKOUT',
      error: 'This room tab has been settled at checkout and cannot accept new orders. Redirecting...',
    }
  }

  // 4. Validate and look up authoritative items strictly within the guest's tenant/property
  const validatedItems: { menuItemId: string; name: string; price: number; quantity: number; notes?: string }[] = []

  for (const clientItem of validatedInputItems) {
    const menuItem = SEED_MENU.find((m) => m.id === clientItem.menuItemId)
    if (!menuItem) {
      return { success: false, error: `Menu item "${clientItem.menuItemId}" does not exist in catalog.` }
    }

    // MULTI-TENANT ISOLATION CHECK: Prevent ordering items from another property
    if (menuItem.propertyId !== payload.propertyId) {
      return {
        success: false,
        error: `Cross-Tenant Violation: Menu item "${menuItem.name}" does not belong to this resort (${payload.propertyName}).`,
      }
    }

    if (!menuItem.isAvailable) {
      return { success: false, error: `Item "${menuItem.name}" is currently out of stock.` }
    }

    validatedItems.push({
      menuItemId: menuItem.id,
      name: menuItem.name,
      price: menuItem.price, // Authoritative server price
      quantity: clientItem.quantity,
      notes: clientItem.notes,
    })
  }

  // 5. Append order to active continuous tab with strict property & idempotency check
  try {
    const { session, newRound } = tabManager.appendOrderToTab(
      payload.sessionId,
      validatedItems,
      cleanSpecialInstructions,
      payload.propertyId,
      cleanIdempotencyKey
    )

    // 6. Record Audit Log Entry
    auditLogger.logEvent({
      actorId: payload.sessionId,
      actorName: payload.guestName || 'Valued Guest',
      actorRole: 'guest',
      propertyId: payload.propertyId,
      action: 'ORDER_APPEND',
      targetResource: newRound.id,
      targetResourceType: 'order_round',
      newState: {
        roundNumber: newRound.roundNumber,
        itemsCount: newRound.items.length,
        roundTotal: newRound.total,
        sessionTotal: session.totalAmount,
      },
      idempotencyKey: cleanIdempotencyKey,
    })

    return {
      success: true,
      session,
      newRound,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to append order to room tab.'
    return {
      success: false,
      error: message,
    }
  }
}

/**
 * Server Action: Fetches active continuous tab status and history for authenticated session
 */
export async function getActiveTab(): Promise<GuestTabSession | null> {
  const cookieStore = cookies()
  const token = cookieStore.get(GUEST_COOKIE_NAME)?.value
  if (!token) return null

  const payload = await verifyGuestToken(token)
  if (!payload) return null

  const location = tabManager.getLocationByIdentifier(payload.locationIdentifier)
  if (!location || (payload.tokenVersion && payload.tokenVersion < (location.tokenVersion || 1))) {
    return null
  }

  const session = tabManager.getSessionById(payload.sessionId)
  if (!session || session.status !== 'active') return null

  // Ensure tenant isolation
  if (session.propertyId !== payload.propertyId) return null

  return session
}

/**
 * Server Action: Retrieves available menu items for a specific property
 */
export async function getMenuItems(propertyId?: string): Promise<MenuItemRecord[]> {
  const cookieStore = cookies()
  const token = cookieStore.get(GUEST_COOKIE_NAME)?.value
  let targetPropertyId = propertyId

  if (!targetPropertyId && token) {
    const payload = await verifyGuestToken(token)
    if (payload) {
      targetPropertyId = payload.propertyId
    }
  }

  return tabManager.getMenuItemsByProperty(targetPropertyId)
}
