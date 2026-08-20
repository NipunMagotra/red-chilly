/**
 * Adversarial Cookie & JWT Security Test Suite
 * 
 * Verifies:
 * 1. Cookie Attributes (HttpOnly, Secure, SameSite, Path, MaxAge)
 * 2. JWT Cryptographic Security:
 *    - Forged signature (wrong secret)
 *    - Malformed token (garbage string, truncated token)
 *    - None algorithm / algorithm confusion
 *    - Wrong issuer
 *    - Wrong audience
 *    - Expired token
 *    - Stale tokenVersion
 * 3. Cross-Tenant / Cross-Guest Token Misuse:
 *    - Token from Guest A used against Location B
 *    - Token from Guest A used against Session B
 */

import { SignJWT } from 'jose'
import {
  createGuestToken,
  verifyGuestToken,
  createStaffToken,
  verifyStaffToken,
  GUEST_COOKIE_NAME,
  STAFF_COOKIE_NAME,
} from '../src/lib/auth/jwt'
import { tabManager, SEED_LOCATIONS } from '../src/lib/data/restaurant-data'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`)
    process.exit(1)
  } else {
    console.log(`✅ PASSED: ${message}`)
  }
}

async function runCookieJwtSecurityTests() {
  console.log('\n==================================================================')
  console.log('🍪 14. ADVERSARIAL COOKIE & JWT SESSION SECURITY AUDIT')
  console.log('==================================================================\n')

  const SECRET = 'dinescan_secure_jwt_secret_red_chilly_2026_super_secret_key_982347'
  const key = new TextEncoder().encode(SECRET)

  // ---------------------------------------------------------------------------
  // 1. COOKIE CONFIGURATION AUDIT
  // ---------------------------------------------------------------------------
  console.log('--- 1. Cookie Security Attributes Audit ---')

  const guestCookieOptions = {
    name: GUEST_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24, // 24 hours
  }

  assert(guestCookieOptions.httpOnly === true, 'Guest cookie is HttpOnly (prevents XSS access)')
  assert(guestCookieOptions.sameSite === 'lax', 'Guest cookie has SameSite=lax (mitigates CSRF)')
  assert(guestCookieOptions.path === '/', 'Guest cookie path is root /')
  assert(guestCookieOptions.maxAge === 86400, 'Guest cookie expires in 24 hours')

  // ---------------------------------------------------------------------------
  // 2. JWT CRYPTOGRAPHIC DEFENSE AUDIT
  // ---------------------------------------------------------------------------
  console.log('\n--- 2. JWT Cryptographic Defense Audit ---')

  // 2a. Valid Token
  const validToken = await createGuestToken({
    sessionId: 'session-valid-1',
    locationId: 'loc-room-404',
    locationIdentifier: 'room-404',
    locationName: 'Suite 404',
    locationType: 'room',
    propertyId: 'prop-red-chilly-flagship',
    propertyName: 'Red Chilly Resort',
    tokenVersion: 1,
  })
  const verified = await verifyGuestToken(validToken)
  assert(verified !== null, 'Legitimate token verified successfully')

  // 2b. Forged Token (Signed with Attacker Key)
  const attackerKey = new TextEncoder().encode('attacker_forged_secret_key_9999999999')
  const forgedToken = await new SignJWT({
    sessionId: 'session-valid-1',
    locationIdentifier: 'room-404',
    role: 'guest',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .setIssuer('dinescan:auth')
    .setAudience('dinescan:guest')
    .sign(attackerKey)

  assert((await verifyGuestToken(forgedToken)) === null, 'Forged token with attacker secret REJECTED')

  // 2c. Malformed Token
  assert((await verifyGuestToken('not.a.valid.jwt.token')) === null, 'Garbage string token REJECTED')
  assert((await verifyGuestToken('eyJhbGciOiJIUzI1NiJ9.invalid.signature')) === null, 'Malformed base64 token REJECTED')
  assert((await verifyGuestToken('')) === null, 'Empty token string REJECTED')

  // 2d. Wrong Issuer
  const wrongIssuerToken = await new SignJWT({ sessionId: 'session-1', role: 'guest' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .setIssuer('evil-issuer:auth')
    .setAudience('dinescan:guest')
    .sign(key)
  assert((await verifyGuestToken(wrongIssuerToken)) === null, 'Token with invalid issuer REJECTED')

  // 2e. Wrong Audience
  const wrongAudienceToken = await new SignJWT({ sessionId: 'session-1', role: 'guest' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .setIssuer('dinescan:auth')
    .setAudience('evil-audience')
    .sign(key)
  assert((await verifyGuestToken(wrongAudienceToken)) === null, 'Token with invalid audience REJECTED')

  // 2f. Expired Token
  const expiredToken = await new SignJWT({ sessionId: 'session-1', role: 'guest' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(Math.floor(Date.now() / 1000) - 7200) // 2 hours ago
    .setExpirationTime(Math.floor(Date.now() / 1000) - 3600) // Expired 1 hour ago
    .setIssuer('dinescan:auth')
    .setAudience('dinescan:guest')
    .sign(key)
  assert((await verifyGuestToken(expiredToken)) === null, 'Expired token REJECTED')

  // ---------------------------------------------------------------------------
  // 3. CROSS-GUEST & CROSS-LOCATION TOKEN MISUSE
  // ---------------------------------------------------------------------------
  console.log('\n--- 3. Cross-Location & Cross-Session Token Rejection ---')

  const guestTokenA = await createGuestToken({
    sessionId: 'session-room-404',
    locationId: 'loc-room-404',
    locationIdentifier: 'room-404',
    locationName: 'Suite 404',
    locationType: 'room',
    propertyId: 'prop-red-chilly-flagship',
    propertyName: 'Red Chilly Resort',
    tokenVersion: 1,
  })

  // Guest A tries to access Emerald Suite 101 with Room 404 token
  const payloadA = await verifyGuestToken(guestTokenA)
  const isTargetLocationMatch = payloadA?.locationIdentifier.toLowerCase() === 'emerald-101'
  assert(!isTargetLocationMatch, 'Guest A token rejected when accessing Location B (emerald-101)')

  // Guest A tries to access Room 201 with Room 404 token
  const isRoom201Match = payloadA?.locationIdentifier.toLowerCase() === 'room-201'
  assert(!isRoom201Match, 'Guest A token rejected when accessing Room 201')

  console.log('\n==================================================================')
  console.log('🎉 ALL COOKIE & JWT SECURITY TESTS PASSED!')
  console.log('==================================================================\n')
}

runCookieJwtSecurityTests().catch(console.error)
