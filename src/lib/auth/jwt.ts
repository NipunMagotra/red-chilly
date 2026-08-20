import crypto from 'crypto'
import { SignJWT, jwtVerify } from 'jose'

// Primary & Rotation Secret Material
const PRIMARY_SECRET =
  process.env.JWT_SECRET ||
  process.env.SUPABASE_JWT_SECRET ||
  'dinescan_secure_jwt_secret_red_chilly_2026_super_secret_key_982347'

const PREVIOUS_SECRET = process.env.JWT_SECRET_PREVIOUS

const JWT_KEYS = [
  new TextEncoder().encode(PRIMARY_SECRET),
  ...(PREVIOUS_SECRET ? [new TextEncoder().encode(PREVIOUS_SECRET)] : []),
]

export interface GuestSessionTokenPayload {
  jti: string
  sessionId: string
  locationId: string
  locationIdentifier: string
  locationName: string
  locationType: string
  propertyId: string
  propertyName: string
  guestName?: string
  tokenVersion: number
  role: 'guest'
}

export interface StaffSessionTokenPayload {
  jti: string
  staffId: string
  propertyId: string
  role: 'admin' | 'manager' | 'staff'
  name: string
}

const GUEST_TOKEN_EXPIRY = '24h' // Active for 24 hours
const STAFF_TOKEN_EXPIRY = '12h' // Active for 12 hours

export const GUEST_COOKIE_NAME = 'dinescan_guest_session'
export const STAFF_COOKIE_NAME = 'dinescan_staff_session'

/**
 * Signs an HTTP-only JWT for the verified guest session
 * 
 * SECURITY CONTROLS:
 * 1. HMAC-SHA256 with 256-bit secret.
 * 2. Explicit jti (unique JWT identifier) to prevent replay.
 * 3. Issuer ('dinescan:auth') and Audience ('dinescan:guest') claims.
 * 4. tokenVersion claim for instant revocation upon checkout / PIN rotation.
 * 5. Minimal claims: Raw stay PIN is omitted.
 */
export async function createGuestToken(
  payload: Omit<GuestSessionTokenPayload, 'role' | 'jti'>
): Promise<string> {
  const jti = crypto.randomUUID()

  return await new SignJWT({ ...payload, jti, role: 'guest' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(GUEST_TOKEN_EXPIRY)
    .setIssuer('dinescan:auth')
    .setAudience('dinescan:guest')
    .setJti(jti)
    .sign(JWT_KEYS[0])
}

/**
 * Verifies the Guest JWT with explicit algorithm, issuer, audience, and expiration checks.
 * Supports zero-downtime key rotation by attempting previous key if primary fails.
 */
export async function verifyGuestToken(
  token: string
): Promise<GuestSessionTokenPayload | null> {
  for (const key of JWT_KEYS) {
    try {
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'], // Explicit algorithm verification (prevents alg confusion)
        issuer: 'dinescan:auth', // Issuer validation
        audience: 'dinescan:guest', // Audience validation
        clockTolerance: '5s', // Clock skew tolerance
      })

      return {
        jti: (payload.jti as string) || '',
        sessionId: payload.sessionId as string,
        locationId: payload.locationId as string,
        locationIdentifier: payload.locationIdentifier as string,
        locationName: payload.locationName as string,
        locationType: payload.locationType as string,
        propertyId: payload.propertyId as string,
        propertyName: payload.propertyName as string,
        guestName: (payload.guestName as string) || 'Valued Guest',
        tokenVersion: typeof payload.tokenVersion === 'number' ? payload.tokenVersion : 1,
        role: 'guest',
      }
    } catch {
      // Try next rotation key if available
      continue
    }
  }

  return null
}

/**
 * Signs an HTTP-only JWT for verified hotel reception / admin staff
 */
export async function createStaffToken(
  payload: Omit<StaffSessionTokenPayload, 'jti'>
): Promise<string> {
  const jti = crypto.randomUUID()

  return await new SignJWT({ ...payload, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(STAFF_TOKEN_EXPIRY)
    .setIssuer('dinescan:auth')
    .setAudience('dinescan:staff')
    .setJti(jti)
    .sign(JWT_KEYS[0])
}

/**
 * Verifies the Staff JWT with explicit algorithm, issuer, audience, and expiration checks.
 */
export async function verifyStaffToken(
  token: string
): Promise<StaffSessionTokenPayload | null> {
  for (const key of JWT_KEYS) {
    try {
      const { payload } = await jwtVerify(token, key, {
        algorithms: ['HS256'],
        issuer: 'dinescan:auth',
        audience: 'dinescan:staff',
        clockTolerance: '5s',
      })

      return {
        jti: (payload.jti as string) || '',
        staffId: payload.staffId as string,
        propertyId: payload.propertyId as string,
        role: payload.role as 'admin' | 'manager' | 'staff',
        name: payload.name as string,
      }
    } catch {
      continue
    }
  }

  return null
}
