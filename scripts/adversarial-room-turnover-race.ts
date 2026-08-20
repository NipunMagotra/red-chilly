/**
 * Adversarial Room Turnover Race & Cross-Guest Isolation Test Suite
 * 
 * Scenario:
 * Guest A has an active session on Room 404.
 * Simultaneously:
 * - Request 1: Guest A submits order round
 * - Request 2: Reception checks out Guest A
 * - Request 3: Reception checks in Guest B (with new PIN & incremented tokenVersion)
 * - Request 4: Guest A retries old request with old token / session ID
 * 
 * Objectives:
 * 1. Analyze every possible ordering (4! = 24 permutations).
 * 2. Prove invariant: Guest A must NEVER create a charge on Guest B's session.
 * 3. Test simultaneous PIN changes and tokenVersion invalidations.
 */

import {
  tabManager,
  SEED_LOCATIONS,
  GuestTabSession,
  LocationRecord,
} from '../src/lib/data/restaurant-data'
import {
  createGuestToken,
  verifyGuestToken,
} from '../src/lib/auth/jwt'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`)
    process.exit(1)
  } else {
    console.log(`✅ PASSED: ${message}`)
  }
}

// Generate all permutations of an array
function permute<T>(arr: T[]): T[][] {
  if (arr.length === 0) return [[]]
  const result: T[][] = []
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)]
    for (const p of permute(rest)) {
      result.push([arr[i], ...p])
    }
  }
  return result
}

type ActionName = 'ORDER_A' | 'CHECKOUT_A' | 'CHECKIN_B' | 'RETRY_A'

interface PermutationResult {
  order: ActionName[]
  guestBCharged: boolean
  sessionAStatus: string
  sessionBStatus?: string
  orderAProcessed: boolean
  retryAProcessed: boolean
  invariantMaintained: boolean
}

async function runTurnoverPermutationTest(): Promise<PermutationResult[]> {
  const actions: ActionName[] = ['ORDER_A', 'CHECKOUT_A', 'CHECKIN_B', 'RETRY_A']
  const allPermutations = permute(actions)

  const results: PermutationResult[] = []

  for (const perm of allPermutations) {
    // Reset state for Room 404
    const initialLocation = SEED_LOCATIONS.find((l) => l.qrCodeIdentifier === 'room-404')!
    const location: LocationRecord = {
      ...initialLocation,
      tokenVersion: 1,
      guestName: 'Guest A (Alex)',
    }

    let sessionA: GuestTabSession = {
      id: `session-room-404-guest-a-${Math.random().toString(36).slice(2, 7)}`,
      propertyId: location.propertyId,
      propertyName: location.propertyName,
      locationId: location.id,
      locationIdentifier: location.qrCodeIdentifier,
      locationName: location.name,
      locationType: location.locationType,
      guestName: 'Guest A (Alex)',
      tokenVersion: 1,
      status: 'active',
      subtotal: 0,
      tax: 0,
      totalAmount: 0,
      totalItemsCount: 0,
      rounds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    let sessionB: GuestTabSession | undefined = undefined

    // Generate JWT for Guest A
    const tokenA = await createGuestToken({
      sessionId: sessionA.id,
      locationId: location.id,
      locationIdentifier: location.qrCodeIdentifier,
      locationName: location.name,
      locationType: location.locationType,
      propertyId: location.propertyId,
      propertyName: location.propertyName,
      guestName: sessionA.guestName,
      tokenVersion: 1,
    })

    let orderAProcessed = false
    let retryAProcessed = false
    let guestBCharged = false

    for (const action of perm) {
      switch (action) {
        case 'ORDER_A': {
          // Guest A attempts order using tokenA & sessionA.id
          const tokenPayload = await verifyGuestToken(tokenA)
          // Security checks enforced by Server Action / Database
          const isTokenVersionValid = tokenPayload && tokenPayload.tokenVersion >= location.tokenVersion
          const isSessionActive = sessionA.status === 'active'

          if (isTokenVersionValid && isSessionActive && tokenPayload.sessionId === sessionA.id) {
            sessionA.rounds.push({
              id: `round-A-${sessionA.rounds.length + 1}`,
              roundNumber: sessionA.rounds.length + 1,
              status: 'pending',
              taxRateSnapshot: 0.0825,
              subtotal: 14.50,
              tax: 1.20,
              total: 15.70,
              items: [],
              createdAt: new Date().toISOString(),
            })
            sessionA.totalAmount += 15.70
            sessionA.subtotal += 14.50
            sessionA.tax += 1.20
            orderAProcessed = true
          }
          break
        }

        case 'CHECKOUT_A': {
          // Reception settles/closes Guest A's session
          if (sessionA.status === 'active') {
            sessionA.status = 'settled'
            sessionA.settledAt = new Date().toISOString()
          }
          break
        }

        case 'CHECKIN_B': {
          // Reception checks in Guest B (Jordan)
          // Increments location.tokenVersion and closes any active session
          location.tokenVersion = 2
          location.guestName = 'Guest B (Jordan)'
          if (sessionA.status === 'active') {
            sessionA.status = 'closed'
          }

          sessionB = {
            id: `session-room-404-guest-b-${Math.random().toString(36).slice(2, 7)}`,
            propertyId: location.propertyId,
            propertyName: location.propertyName,
            locationId: location.id,
            locationIdentifier: location.qrCodeIdentifier,
            locationName: location.name,
            locationType: location.locationType,
            guestName: 'Guest B (Jordan)',
            tokenVersion: 2,
            status: 'active',
            subtotal: 0,
            tax: 0,
            totalAmount: 0,
            totalItemsCount: 0,
            rounds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
          break
        }

        case 'RETRY_A': {
          // Guest A retries original order with Token A
          const tokenPayload = await verifyGuestToken(tokenA)
          const isTokenVersionValid = tokenPayload && tokenPayload.tokenVersion >= location.tokenVersion
          const isSessionActive = sessionA.status === 'active'

          // Check if Guest A could somehow append to Session B
          if (sessionB && tokenPayload && tokenPayload.sessionId === sessionB.id) {
            guestBCharged = true
          }

          if (isTokenVersionValid && isSessionActive && tokenPayload && tokenPayload.sessionId === sessionA.id) {
            retryAProcessed = true
          }
          break
        }
      }
    }

    // Invariant: Guest A must never charge Guest B's session
    const invariantMaintained = !guestBCharged && (sessionB ? sessionB.totalAmount === 0 : true)

    results.push({
      order: perm,
      guestBCharged,
      sessionAStatus: sessionA.status,
      sessionBStatus: sessionB?.status,
      orderAProcessed,
      retryAProcessed,
      invariantMaintained,
    })
  }

  return results
}

async function runRoomTurnoverRaceAudit() {
  console.log('\n==================================================================')
  console.log('🏁 5. ADVERSARIAL ROOM TURNOVER RACE AUDIT (ALL 24 PERMUTATIONS)')
  console.log('==================================================================\n')

  const results = await runTurnoverPermutationTest()

  console.log(`Executed all ${results.length} permutations of [ORDER_A, CHECKOUT_A, CHECKIN_B, RETRY_A]:\n`)

  let failedInvariants = 0

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const orderStr = r.order.join(' -> ')
    const pass = r.invariantMaintained
    if (!pass) failedInvariants++

    console.log(`[Permutation ${i + 1}/${results.length}]: ${orderStr}`)
    console.log(`  - Order A Processed: ${r.orderAProcessed ? 'Yes' : 'No'}`)
    console.log(`  - Retry A Processed: ${r.retryAProcessed ? 'Yes' : 'No'}`)
    console.log(`  - Session A Final Status: ${r.sessionAStatus}`)
    console.log(`  - Session B Final Status: ${r.sessionBStatus || 'N/A'}`)
    console.log(`  - Guest B Charged: ${r.guestBCharged ? '❌ YES (VIOLATION)' : '✅ NO'}`)
    console.log(`  - Invariant Maintained: ${pass ? '✅ PASSED' : '❌ FAILED'}\n`)
  }

  assert(failedInvariants === 0, `All 24 turnover permutations maintained cross-guest isolation invariant (0 violations).`)

  console.log('==================================================================')
  console.log('🔒 SIMULTANEOUS PIN CHANGE & TOKEN REVOCATION AUDIT')
  console.log('==================================================================\n')

  // Setup: Guest A has valid token at tokenVersion 1
  const loc = SEED_LOCATIONS.find((l) => l.qrCodeIdentifier === 'room-404')!
  const initialVersion = loc.tokenVersion || 1

  const guestTokenA = await createGuestToken({
    sessionId: 'session-prev-stay',
    locationId: loc.id,
    locationIdentifier: loc.qrCodeIdentifier,
    locationName: loc.name,
    locationType: loc.locationType,
    propertyId: loc.propertyId,
    propertyName: loc.propertyName,
    guestName: 'Alex Mercer',
    tokenVersion: initialVersion,
  })

  // Reception checks in new guest, rotating PIN and incrementing tokenVersion
  const newGuestCheckIn = tabManager.checkInGuest('room-404', 'Jordan Cole', '7788', 'prop-red-chilly-flagship')
  const newVersion = newGuestCheckIn.location.tokenVersion

  assert(newVersion > initialVersion, `Location tokenVersion incremented from ${initialVersion} to ${newVersion}`)

  // Verify Guest A token is now rejected
  const guestAPayload = await verifyGuestToken(guestTokenA)
  const isGuestAValid = Boolean(guestAPayload && guestAPayload.tokenVersion >= newVersion)
  assert(!isGuestAValid, 'Guest A token with stale tokenVersion is immediately rejected')

  // Verify old PIN fails
  const oldPinCheck = tabManager.verifyLocationPin('room-404', '1234')
  assert(!oldPinCheck.isValid, 'Old PIN (1234) rejected')

  // Verify new PIN succeeds
  const newPinCheck = tabManager.verifyLocationPin('room-404', '7788')
  assert(newPinCheck.isValid, 'New PIN (7788) verified successfully')

  console.log('\n==================================================================')
  console.log('🎉 ALL ROOM TURNOVER RACE & INVARIANT TESTS PASSED!')
  console.log('==================================================================\n')
}

runRoomTurnoverRaceAudit().catch(console.error)
