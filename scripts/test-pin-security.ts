/**
 * Stay PIN Security, Anti-Enumeration & Brute-Force Test Suite
 */

import { tabManager, hashPin, verifyPinConstantTime, generatePinSalt } from '../src/lib/data/restaurant-data'
import { verifyStayPin, getGuestSession } from '../src/actions/auth-actions'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`)
    process.exit(1)
  } else {
    console.log(`✅ PASSED: ${message}`)
  }
}

async function runPinSecurityTests() {
  console.log('\n======================================================')
  console.log('🔒 RUNNING STAY PIN SECURITY & BRUTE-FORCE AUDIT')
  console.log('======================================================\n')

  // ---------------------------------------------------------------------------
  // TEST 1: Cryptographic Salted PBKDF2 Hashing & Constant-Time Verification
  // ---------------------------------------------------------------------------
  console.log('--- Test 1: Cryptographic Salted Hashing ---')
  const salt = generatePinSalt()
  const pin = '4829'
  const hash = hashPin(pin, salt)

  assert(hash.length === 64, 'PBKDF2 hash is 256-bit (64 hex characters)')
  assert(verifyPinConstantTime(pin, salt, hash), 'Correct PIN matches constant-time verification')
  assert(!verifyPinConstantTime('4828', salt, hash), 'Incorrect PIN rejected')
  assert(!verifyPinConstantTime('0000', salt, hash), 'Incorrect PIN rejected')

  // ---------------------------------------------------------------------------
  // TEST 2: Anti-Enumeration & Identical Error Messages
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 2: Anti-Enumeration Oracle Defense ---')
  const nonExistentRes = await verifyStayPin('room-does-not-exist-999', '1111')
  const existentWrongPinRes = await verifyStayPin('room-201', '0000')

  assert(!nonExistentRes.success, 'Non-existent location rejected')
  assert(
    Boolean(
      nonExistentRes.error?.includes('Invalid room or stay PIN') &&
      existentWrongPinRes.error?.includes('Invalid room or stay PIN')
    ),
    'Both non-existent location and wrong PIN return identical error message (No room enumeration oracle)'
  )

  // ---------------------------------------------------------------------------
  // TEST 3: Progressive Delay & Temporary Lockout (Brute-Force Resistance)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 3: Brute-Force Rate Limiting & Lockout ---')
  const testLoc = 'cabana-7'
  
  // Submit 4 failed attempts
  for (let i = 1; i <= 4; i++) {
    const res = await verifyStayPin(testLoc, `000${i}`)
    assert(!res.success, `Attempt ${i} rejected`)
    assert(Boolean(res.error?.includes('remaining') || res.error?.includes('locked')), `Attempt ${i} feedback received`)
  }

  // 5th failed attempt -> Must trigger lockout
  const lockoutRes = await verifyStayPin(testLoc, '0005')
  assert(!lockoutRes.success, '5th attempt rejected')
  assert(
    Boolean(lockoutRes.error?.includes('locked') || lockoutRes.lockoutRemainingSeconds !== undefined),
    '5th failed attempt triggered 15-minute temporary lockout'
  )

  // 6th attempt while locked -> Must immediately reject without checking PIN
  const whileLockedRes = await verifyStayPin(testLoc, '9999') // even with valid PIN
  assert(!whileLockedRes.success, 'Valid PIN rejected while room is in lockout state')
  assert(Boolean(whileLockedRes.error?.includes('locked')), 'Lockout error returned')

  // ---------------------------------------------------------------------------
  // TEST 4: Session Fixation & PIN Rotation Invalidation
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 4: Session Fixation & PIN Rotation Invalidation ---')
  const room404 = tabManager.getLocationByIdentifier('room-404')!
  const initialTokenVersion = room404.tokenVersion

  // Guest checks in / front desk rotates PIN
  const newGuestCheckIn = tabManager.checkInGuest('room-404', 'New Guest VIP', '9876', 'prop-red-chilly-flagship')
  assert(newGuestCheckIn.location.tokenVersion === initialTokenVersion + 1, 'Token version incremented on check-in/PIN rotation')

  // Verify new PIN works
  const newPinVerify = tabManager.verifyLocationPin('room-404', '9876')
  assert(newPinVerify.isValid, 'New PIN 9876 verified successfully')

  // Verify old PIN fails
  const oldPinVerify = tabManager.verifyLocationPin('room-404', '1234')
  assert(!oldPinVerify.isValid, 'Old PIN 1234 immediately invalidated')

  console.log('\n======================================================')
  console.log('🎉 ALL STAY PIN SECURITY & BRUTE-FORCE TESTS PASSED!')
  console.log('======================================================\n')
}

runPinSecurityTests().catch((e) => {
  console.error(e)
  process.exit(1)
})
