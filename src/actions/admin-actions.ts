'use server'

import { cookies } from 'next/headers'
import {
  createStaffToken,
  verifyStaffToken,
  STAFF_COOKIE_NAME,
  StaffSessionTokenPayload,
} from '@/lib/auth/jwt'
import {
  tabManager,
  LocationRecord,
  GuestTabSession,
} from '@/lib/data/restaurant-data'
import {
  StaffLoginSchema,
  CheckInGuestSchema,
  VoidItemSchema,
  SettleTabSchema,
  SessionLookupSchema,
} from '@/lib/validation/schemas'
import { auditLogger } from '@/lib/logging/audit-logger'

const STAFF_ADMIN_SECRET = process.env.STAFF_ADMIN_SECRET || 'redchilly2026'

export interface DashboardMetrics {
  totalActiveRevenue: number
  totalSettledRevenue: number
  activeTabsCount: number
  settledTabsCount: number
  totalRoundsCount: number
  totalLocationsCount: number
  propertyName: string
}

export interface AdminDashboardData {
  locations: LocationRecord[]
  activeTabs: GuestTabSession[]
  settledTabs: GuestTabSession[]
  metrics: DashboardMetrics
}

/**
 * Helper: Validates staff authentication from secure HTTP-only cookie
 */
async function verifyStaffSession(): Promise<StaffSessionTokenPayload | null> {
  const cookieStore = cookies()
  const token = cookieStore.get(STAFF_COOKIE_NAME)?.value
  if (!token) return null
  return await verifyStaffToken(token)
}

/**
 * Server Action: Staff login challenge
 */
export async function staffLogin(
  passcode: string
): Promise<{ success: boolean; error?: string; staff?: StaffSessionTokenPayload }> {
  const validation = StaffLoginSchema.safeParse({ passcode })
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0]?.message || 'Invalid login request.' }
  }

  const { passcode: cleanPasscode } = validation.data

  if (cleanPasscode.trim() !== STAFF_ADMIN_SECRET.trim()) {
    return { success: false, error: 'Invalid staff passcode. Access denied.' }
  }

  const staffPayload: Omit<StaffSessionTokenPayload, 'jti'> = {
    staffId: 'staff-reception-01',
    role: 'admin',
    name: 'Reception Front Desk',
  }

  const token = await createStaffToken(staffPayload)

  const cookieStore = cookies()
  cookieStore.set({
    name: STAFF_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12, // 12 hours
  })

  const verifiedStaff = await verifyStaffToken(token)

  // Record Audit Log
  auditLogger.logEvent({
    actorId: staffPayload.staffId,
    actorName: staffPayload.name,
    actorRole: 'admin',
    action: 'STAFF_LOGIN',
    targetResource: 'reception-console',
    targetResourceType: 'location',
    reason: 'Staff logged in at reception console',
  })

  return {
    success: true,
    staff: verifiedStaff || undefined,
  }
}

/**
 * Server Action: Staff logout
 */
export async function staffLogout(): Promise<{ success: boolean }> {
  const staff = await verifyStaffSession()
  if (staff) {
    auditLogger.logEvent({
      actorId: staff.staffId,
      actorName: staff.name,
      actorRole: staff.role,
      action: 'STAFF_LOGOUT',
      targetResource: 'reception-console',
      targetResourceType: 'location',
    })
  }

  const cookieStore = cookies()
  cookieStore.delete(STAFF_COOKIE_NAME)
  return { success: true }
}

/**
 * Server Action: Check if current visitor has an active staff session
 */
export async function checkStaffAuth(): Promise<{
  isAuthenticated: boolean
  staff: StaffSessionTokenPayload | null
}> {
  const staff = await verifyStaffSession()
  return {
    isAuthenticated: !!staff,
    staff,
  }
}

/**
 * Server Action: Fetches all active tabs, locations, and live reception metrics
 */
export async function getAdminDashboardData(): Promise<{
  success: boolean
  error?: string
  data?: AdminDashboardData
}> {
  const staff = await verifyStaffSession()
  if (!staff) {
    return { success: false, error: 'Unauthorized: Staff authentication required.' }
  }

  const locations = tabManager.getAllLocations()
  const allSessions = tabManager.getAllSessions()

  const activeTabs = allSessions.filter((s) => s.status === 'active')
  const settledTabs = allSessions.filter((s) => s.status === 'settled')

  const totalActiveRevenue = activeTabs.reduce((acc, s) => acc + s.totalAmount, 0)
  const totalSettledRevenue = settledTabs.reduce((acc, s) => acc + s.totalAmount, 0)
  const totalRoundsCount = allSessions.reduce((acc, s) => acc + s.rounds.length, 0)

  return {
    success: true,
    data: {
      locations,
      activeTabs,
      settledTabs,
      metrics: {
        totalActiveRevenue: Math.round(totalActiveRevenue * 100) / 100,
        totalSettledRevenue: Math.round(totalSettledRevenue * 100) / 100,
        activeTabsCount: activeTabs.length,
        settledTabsCount: settledTabs.length,
        totalRoundsCount,
        totalLocationsCount: locations.length,
        propertyName: 'Red Chilly Resort',
      },
    },
  }
}

/**
 * Server Action: Check-in a new guest to a room/table and generate a new 4-digit stay PIN
 */
export async function adminCheckInGuest(
  locationIdentifier: string,
  guestName: string,
  customPin?: string
): Promise<{ success: boolean; error?: string; location?: LocationRecord; session?: GuestTabSession }> {
  const staff = await verifyStaffSession()
  if (!staff) {
    return { success: false, error: 'Unauthorized: Staff authentication required.' }
  }

  const validation = CheckInGuestSchema.safeParse({ locationIdentifier, guestName, customPin })
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0]?.message || 'Invalid check-in parameters.' }
  }

  const { locationIdentifier: cleanId, guestName: cleanName, customPin: cleanPin } = validation.data

  try {
    const pinToUse =
      cleanPin && /^\d{4}$/.test(cleanPin)
        ? cleanPin
        : Math.floor(1000 + Math.random() * 9000).toString()

    const { location, session } = tabManager.checkInGuest(
      cleanId,
      cleanName,
      pinToUse
    )

    // Record Immutable Audit Log
    auditLogger.logEvent({
      actorId: staff.staffId,
      actorName: staff.name,
      actorRole: staff.role,
      action: 'GUEST_CHECK_IN',
      targetResource: location.qrCodeIdentifier,
      targetResourceType: 'location',
      newState: {
        guestName: location.guestName,
        sessionId: session.id,
        tokenVersion: location.tokenVersion,
      },
      reason: `Guest checked in by front desk (${staff.name})`,
    })

    return {
      success: true,
      location,
      session,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to check in guest.'
    return {
      success: false,
      error: message,
    }
  }
}

/**
 * Server Action: Voids an out-of-stock or cancelled item from an order round
 */
export async function adminVoidItem(
  sessionId: string,
  roundId: string,
  itemId: string,
  reason?: string
): Promise<{ success: boolean; error?: string; session?: GuestTabSession }> {
  const staff = await verifyStaffSession()
  if (!staff) {
    return { success: false, error: 'Unauthorized: Staff authentication required.' }
  }

  const validation = VoidItemSchema.safeParse({ sessionId, roundId, itemId, reason })
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0]?.message || 'Invalid void parameters.' }
  }

  const { sessionId: cleanSessionId, roundId: cleanRoundId, itemId: cleanItemId, reason: cleanReason } = validation.data

  try {
    const session = tabManager.voidOrderItem(
      cleanSessionId,
      cleanRoundId,
      cleanItemId,
      cleanReason || 'Out of Stock / Voided by Reception'
    )

    // Record Immutable Audit Log
    auditLogger.logEvent({
      actorId: staff.staffId,
      actorName: staff.name,
      actorRole: staff.role,
      action: 'ITEM_VOID',
      targetResource: `${cleanRoundId}:${cleanItemId}`,
      targetResourceType: 'order_item',
      reason: cleanReason || 'Voided at reception',
      newState: {
        sessionId: session.id,
        updatedTotal: session.totalAmount,
        updatedItemsCount: session.totalItemsCount,
      },
    })

    return {
      success: true,
      session,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to void item.'
    return {
      success: false,
      error: message,
    }
  }
}

/**
 * Server Action: Closes and settles a guest's continuous tab, generating final invoice
 */
export async function adminSettleTab(
  sessionId: string,
  paymentMethod: 'room_folio' | 'credit_card' | 'cash' = 'room_folio',
  staffNote?: string
): Promise<{ success: boolean; error?: string; session?: GuestTabSession }> {
  const staff = await verifyStaffSession()
  if (!staff) {
    return { success: false, error: 'Unauthorized: Staff authentication required.' }
  }

  const validation = SettleTabSchema.safeParse({ sessionId, paymentMethod, staffNote })
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0]?.message || 'Invalid settlement parameters.' }
  }

  const { sessionId: cleanSessionId, paymentMethod: cleanPaymentMethod, staffNote: cleanStaffNote } = validation.data

  try {
    const session = tabManager.settleAndCloseTab(
      cleanSessionId,
      cleanPaymentMethod,
      cleanStaffNote
    )

    // Record Immutable Audit Log
    auditLogger.logEvent({
      actorId: staff.staffId,
      actorName: staff.name,
      actorRole: staff.role,
      action: 'TAB_SETTLED',
      targetResource: session.id,
      targetResourceType: 'guest_session',
      reason: cleanStaffNote || `Settled via ${cleanPaymentMethod}`,
      newState: {
        invoiceNumber: session.invoiceNumber,
        invoiceChecksum: session.invoiceChecksum,
        totalAmount: session.totalAmount,
        paymentMethod: session.paymentMethod,
        settledAt: session.settledAt,
      },
    })

    return {
      success: true,
      session,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to settle tab.'
    return {
      success: false,
      error: message,
    }
  }
}

/**
 * Server Action: Fetches specific session details
 */
export async function adminGetSession(
  sessionId: string
): Promise<GuestTabSession | null> {
  const staff = await verifyStaffSession()
  if (!staff) return null

  const validation = SessionLookupSchema.safeParse({ sessionId })
  if (!validation.success) return null

  return tabManager.getSessionById(validation.data.sessionId) || null
}
