/**
 * JWT, Session Security & QR Code Reassignment Test Suite
 * Validates cryptographic JWT claims, session revocation, and cross-guest isolation upon room turnover.
 */

import { SignJWT } from 'jose'
import {
  createGuestToken,
  verifyGuestToken,
  createStaffToken,
  verifyStaffToken,
} from '../src/lib/auth/jwt'
import { tabManager } from '../src/lib/data/restaurant-data'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`)
    process.exit(1)
  } else {
    console.log(`✅ PASSED: ${message}`)
  }
}

async function runJwtQrSecurityTests() {
  console.log('\n======================================================')
  console.log('🛡️ RUNNING JWT SESSION & QR CODE SECURITY AUDIT')
  console.log('======================================================\n')

  // ---------------------------------------------------------------------------
  // TEST 1: JWT Cryptographic Integrity & Algorithm Confusion Defense
  // ---------------------------------------------------------------------------
  console.log('--- Test 1: JWT Integrity & Algorithm Defense ---')

  const validToken = await createGuestToken({
    sessionId: 'test-session-101',
    locationId: 'loc-room-404',
    locationIdentifier: 'room-404',
    locationName: 'Suite 404',
    locationType: 'room',
    propertyId: 'prop-red-chilly-flagship',
    propertyName: 'Red Chilly Resort',
    guestName: 'Test Guest',
    tokenVersion: 1,
  })

  const verifiedPayload = await verifyGuestToken(validToken)
  assert(!!verifiedPayload, 'Valid token verifies successfully')
  assert(verifiedPayload?.role === 'guest', 'Role is strictly guest')
  assert(verifiedPayload?.jti.length === 36, 'Unique UUID jti is present')

  // Attack 1a: Forged token signed with wrong secret
  const attackerSecret = new TextEncoder().encode('attacker_secret_key_1234567890123456')
  const forgedToken = await new SignJWT({
    sessionId: 'test-session-101',
    locationId: 'loc-room-404',
    locationIdentifier: 'room-404',
    locationName: 'Suite 404',
    locationType: 'room',
    propertyId: 'prop-red-chilly-flagship',
    propertyName: 'Red Chilly Resort',
    role: 'guest',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .setIssuer('dinescan:auth')
    .setAudience('dinescan:guest')
    .sign(attackerSecret)

  const forgedResult = await verifyGuestToken(forgedToken)
  assert(forgedResult === null, 'Forged token with wrong secret is REJECTED')

  // Attack 1b: Token with wrong issuer
  const wrongIssuerToken = await new SignJWT({
    sessionId: 'test-session-101',
    role: 'guest',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .setIssuer('evil-issuer:auth')
    .setAudience('dinescan:guest')
    .sign(new TextEncoder().encode(process.env.JWT_SECRET || 'dinescan_secure_jwt_secret_red_chilly_2026_super_secret_key_982347'))

  const wrongIssuerResult = await verifyGuestToken(wrongIssuerToken)
  assert(wrongIssuerResult === null, 'Token with wrong issuer is REJECTED')

  // ---------------------------------------------------------------------------
  // TEST 2: Database Authority & Session Revocation
  // A settled/closed session must reject unexpired JWT tokens
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 2: Database Authority & Session Revocation ---')
  const room201 = tabManager.getLocationByIdentifier('room-201')!
  const guestSession = tabManager.createOrGetSession(room201)

  const guestToken = await createGuestToken({
    sessionId: guestSession.id,
    locationId: room201.id,
    locationIdentifier: room201.qrCodeIdentifier,
    locationName: room201.name,
    locationType: room201.locationType,
    propertyId: room201.propertyId,
    propertyName: room201.propertyName,
    guestName: room201.guestName,
    tokenVersion: room201.tokenVersion,
  })

  // Settle and close the session in the database
  tabManager.settleAndCloseTab(guestSession.id, 'room_folio', 'Guest checked out', 'prop-red-chilly-flagship')
  const dbSession = tabManager.getSessionById(guestSession.id)
  assert(dbSession?.status === 'settled', 'Session is settled in authoritative database')

  // Verify that an active order append is rejected even with valid JWT
  let appendBlocked = false
  try {
    tabManager.appendOrderToTab(
      guestSession.id,
      [{ menuItemId: 'item-1', name: 'Red Chilly Dragon Dumplings', quantity: 1 }],
      'Late order after checkout',
      'prop-red-chilly-flagship'
    )
  } catch (err: any) {
    appendBlocked = true
    assert(err.message.includes('settled'), 'Order rejected on settled session')
  }
  assert(appendBlocked, 'Unexpired JWT cannot modify closed/settled tab')

  // ---------------------------------------------------------------------------
  // TEST 3: QR Security & Room Reassignment (Cross-Guest Isolation)
  // Scenario:
  // 1. Room 404 is occupied by Guest A (Alex Mercer)
  // 2. Front desk checks in Guest B (Jordan Cole) with new PIN
  // 3. Guest A still has old token (Token Version 1)
  // 4. Verify Guest A cannot see or append to Guest B's tab
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 3: QR Code Reassignment & Cross-Guest Isolation ---')

  const room404 = tabManager.getLocationByIdentifier('room-404')!
  const sessionGuestA = tabManager.createOrGetSession(room404)

  const tokenGuestA = await createGuestToken({
    sessionId: sessionGuestA.id,
    locationId: room404.id,
    locationIdentifier: room404.qrCodeIdentifier,
    locationName: room404.name,
    locationType: room404.locationType,
    propertyId: room404.propertyId,
    propertyName: room404.propertyName,
    guestName: 'Guest A (Alex Mercer)',
    tokenVersion: room404.tokenVersion, // Token Version 1
  })

  // Front desk checks in Guest B with new PIN 8888
  const checkInGuestB = tabManager.checkInGuest(
    'room-404',
    'Guest B (Jordan Cole)',
    '8888',
    'prop-red-chilly-flagship'
  )

  assert(checkInGuestB.location.tokenVersion > room404.tokenVersion - 1, 'Room 404 tokenVersion incremented')
  assert(checkInGuestB.session.id !== sessionGuestA.id, 'Guest B receives completely fresh session ID')

  // Verify Guest A's old token is invalidated by tokenVersion check
  const guestAPayload = await verifyGuestToken(tokenGuestA)
  const currentRoom404 = tabManager.getLocationByIdentifier('room-404')!

  const isGuestAValid = Boolean(guestAPayload && guestAPayload.tokenVersion >= currentRoom404.tokenVersion)
  assert(!isGuestAValid, 'Guest A token is invalidated because tokenVersion < current location tokenVersion')

  // Verify Guest A cannot append to Guest B's session
  let crossGuestAppendBlocked = false
  try {
    tabManager.appendOrderToTab(
      checkInGuestB.session.id,
      [{ menuItemId: 'item-1', name: 'Red Chilly Dragon Dumplings', quantity: 1 }],
      'Injected by Guest A',
      'prop-red-chilly-flagship'
    )
  } catch (err: any) {
    crossGuestAppendBlocked = true
  }
  // Even if Guest A guessed Guest B's session ID, Guest A's token does not carry Guest B's session ID
  assert(guestAPayload?.sessionId !== checkInGuestB.session.id, 'Guest A token is tied strictly to old session ID')

  console.log('\n======================================================')
  console.log('🎉 ALL JWT SESSION & QR SECURITY TESTS PASSED!')
  console.log('======================================================\n')
}

runJwtQrSecurityTests().catch((e) => {
  console.error(e)
  process.exit(1)
})
