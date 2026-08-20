'use server'

import { cookies } from 'next/headers'
import {
  createGuestToken,
  verifyGuestToken,
  GUEST_COOKIE_NAME,
  GuestSessionTokenPayload,
} from '@/lib/auth/jwt'
import {
  tabManager,
  LocationRecord,
  GuestTabSession,
} from '@/lib/data/restaurant-data'
import { VerifyPinSchema } from '@/lib/validation/schemas'

import {
  checkPinRateLimit,
  recordPinFailedAttempt,
  resetPinFailedAttempts,
} from '@/lib/auth/rate-limiter'

export interface VerifyPinResult {
  success: boolean
  error?: string
  session?: GuestTabSession
  lockoutRemainingSeconds?: number
}

/**
 * Server Action: Verifies the 4-digit stay PIN with Zod schema validation,
 * anti-enumeration, constant-time execution, and distributed Edge Redis sliding-window rate limiting.
 */
export async function verifyStayPin(
  locationIdentifier: string,
  pin: string
): Promise<VerifyPinResult> {
  // 1. Strict Runtime Input Validation
  const validation = VerifyPinSchema.safeParse({ locationIdentifier, pin })
  if (!validation.success) {
    return {
      success: false,
      error: validation.error.issues[0]?.message || 'Invalid location or PIN format.',
    }
  }

  const { locationIdentifier: cleanId, pin: cleanPin } = validation.data

  // 2. Distributed Edge Rate Limiter (Fail-Closed in Production)
  const { isLocked, remainingSeconds } = await checkPinRateLimit(cleanId)

  if (isLocked) {
    const mins = Math.ceil(remainingSeconds / 60)
    return {
      success: false,
      error: `Too many failed PIN attempts. Access is locked for ${mins} minute(s). Please contact reception.`,
      lockoutRemainingSeconds: remainingSeconds,
    }
  }

  // 3. Constant-Time & Anti-Enumeration Verification
  const { isValid, location } = tabManager.verifyLocationPin(cleanId, cleanPin)

  if (!isValid || !location) {
    const { isLocked: nowLocked, remainingSeconds: lockSec, attemptsLeft } = await recordPinFailedAttempt(
      cleanId
    )

    if (nowLocked) {
      const mins = Math.ceil(lockSec / 60)
      return {
        success: false,
        error: `Too many failed attempts. Access is locked for ${mins} minute(s). Please contact reception.`,
        lockoutRemainingSeconds: lockSec,
      }
    }

    return {
      success: false,
      error: `Invalid room or stay PIN. Please check your room key envelope. (${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining)`,
    }
  }

  // 4. Success: Clear failed attempts in distributed Redis
  await resetPinFailedAttempts(cleanId)

  // Retrieve or Initialize Continuous Tab Session
  const session = tabManager.createOrGetSession(location)

  // Prevent Session Fixation: Generate new token with current location tokenVersion
  const tokenPayload: Omit<GuestSessionTokenPayload, 'role' | 'jti'> = {
    sessionId: session.id,
    locationId: location.id,
    locationIdentifier: location.qrCodeIdentifier,
    locationName: location.name,
    locationType: location.locationType,
    guestName: location.guestName,
    tokenVersion: location.tokenVersion || 1,
  }

  const token = await createGuestToken(tokenPayload)

  // Rotate Cookie: Delete old and issue new HttpOnly cookie
  const cookieStore = cookies()
  cookieStore.delete(GUEST_COOKIE_NAME)
  cookieStore.set({
    name: GUEST_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  })

  return {
    success: true,
    session,
  }
}

/**
 * Server Action: Reads and verifies the active guest session cookie.
 */
export async function getGuestSession(
  expectedLocationIdentifier?: string
): Promise<{
  isAuthenticated: boolean
  session: GuestTabSession | null
  location: Omit<LocationRecord, 'pinHash' | 'pinSalt' | 'accessPin'> | null
}> {
  const cookieStore = cookies()
  const token = cookieStore.get(GUEST_COOKIE_NAME)?.value

  let targetLocation: Omit<LocationRecord, 'pinHash' | 'pinSalt' | 'accessPin'> | null = null
  let fullLocation: LocationRecord | null = null

  if (expectedLocationIdentifier) {
    const loc = tabManager.getLocationByIdentifier(expectedLocationIdentifier)
    if (loc) {
      fullLocation = loc
      targetLocation = {
        id: loc.id,
        name: loc.name,
        qrCodeIdentifier: loc.qrCodeIdentifier,
        locationType: loc.locationType,
        tokenVersion: loc.tokenVersion,
        guestName: loc.guestName,
        isActive: loc.isActive,
      }
    }
  }

  if (!token) {
    return {
      isAuthenticated: false,
      session: null,
      location: targetLocation,
    }
  }

  const payload = await verifyGuestToken(token)
  if (!payload) {
    return {
      isAuthenticated: false,
      session: null,
      location: targetLocation,
    }
  }

  // Cross-room isolation check
  if (
    expectedLocationIdentifier &&
    payload.locationIdentifier.toLowerCase() !==
      expectedLocationIdentifier.toLowerCase()
  ) {
    return {
      isAuthenticated: false,
      session: null,
      location: targetLocation,
    }
  }

  // PIN Rotation / Session Fixation Invalidation Check
  const currentLoc = fullLocation || tabManager.getLocationByIdentifier(payload.locationIdentifier)
  if (!currentLoc || (payload.tokenVersion && payload.tokenVersion < (currentLoc.tokenVersion || 1))) {
    return {
      isAuthenticated: false,
      session: null,
      location: targetLocation,
    }
  }

  const activeSession = tabManager.getSessionById(payload.sessionId)
  if (!activeSession || activeSession.status !== 'active') {
    return {
      isAuthenticated: false,
      session: null,
      location: targetLocation,
    }
  }

  return {
    isAuthenticated: true,
    session: activeSession,
    location: targetLocation || {
      id: payload.locationId,
      name: payload.locationName,
      qrCodeIdentifier: payload.locationIdentifier,
      locationType: payload.locationType as 'room' | 'table' | 'cabana' | 'bar',
      tokenVersion: payload.tokenVersion,
      guestName: payload.guestName || 'Valued Guest',
      isActive: true,
    },
  }
}

/**
 * Server Action: Clears the guest session cookie (Check-out / Lock)
 */
export async function logoutGuestSession(): Promise<{ success: boolean }> {
  const cookieStore = cookies()
  cookieStore.delete(GUEST_COOKIE_NAME)
  return { success: true }
}

/**
 * Server Action: Public metadata query for location details
 */
export async function getLocationPublicMeta(identifier: string) {
  if (!identifier || typeof identifier !== 'string') return null
  const cleanId = identifier.trim().toLowerCase().slice(0, 64)
  const loc = tabManager.getLocationByIdentifier(cleanId)
  if (!loc) return null
  return {
    id: loc.id,
    name: loc.name,
    locationType: loc.locationType,
    qrCodeIdentifier: loc.qrCodeIdentifier,
    guestName: loc.guestName,
  }
}
