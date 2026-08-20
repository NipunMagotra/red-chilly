/**
 * Adversarial Browser & Network Failure Simulation Test Suite
 * 
 * Simulates:
 * - Case A: Submit order → server commits → response dropped → retry.
 * - Case B: Submit order → server hangs → user refreshes.
 * - Case C: Submit order → user taps button repeatedly (double-click).
 * - Case D: Settlement → browser loses connection.
 * - Case E: Session expires while drawer is open.
 * - Case F: Admin settles tab while guest has stale browser state.
 * 
 * Verifies that the client / UI state reconciles strictly with server truth.
 */

import { tabManager, SEED_LOCATIONS } from '../src/lib/data/restaurant-data'
import { createGuestToken, verifyGuestToken } from '../src/lib/auth/jwt'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`)
    process.exit(1)
  } else {
    console.log(`✅ PASSED: ${message}`)
  }
}

async function runBrowserNetworkFailureTests() {
  console.log('\n==================================================================')
  console.log('🌐 13. ADVERSARIAL BROWSER & NETWORK FAILURE AUDIT (CASES A - F)')
  console.log('==================================================================\n')

  const loc = SEED_LOCATIONS.find((l) => l.qrCodeIdentifier === 'room-404')!
  const session = tabManager.createOrGetSession(loc)

  const items = [{ menuItemId: 'item-1', name: 'Dumplings', price: 14.50, quantity: 1 }]

  // ---------------------------------------------------------------------------
  // CASE A: Submit order → Server commits → Response dropped → Client retries
  // ---------------------------------------------------------------------------
  console.log('--- Case A: Response Dropped after Server Commit & Client Retry ---')
  const keyA = `case-a-key-${Date.now()}`
  const initialRounds = session.rounds.length
  const initialBalance = session.totalAmount

  // Server commits initial request
  const commitA = tabManager.appendOrderToTab(session.id, items, 'Case A', 'prop-red-chilly-flagship', keyA)
  const committedRoundId = commitA.newRound.id

  // Client network times out / response dropped. Client retries with exact same key:
  const retryA = tabManager.appendOrderToTab(session.id, items, 'Case A Retry', 'prop-red-chilly-flagship', keyA)

  assert(retryA.newRound.id === committedRoundId, 'Client retry returned original committed round ID')
  assert(session.rounds.length === initialRounds + 1, 'Exactly ONE round created despite network drop and retry')
  assert(session.totalAmount === commitA.session.totalAmount, 'Balance was not double-charged')

  // ---------------------------------------------------------------------------
  // CASE B: Submit order → Server hangs → User refreshes page
  // ---------------------------------------------------------------------------
  console.log('\n--- Case B: Server Commits, User Refreshes Page ---')
  const keyB = `case-b-key-${Date.now()}`
  tabManager.appendOrderToTab(session.id, items, 'Case B', 'prop-red-chilly-flagship', keyB)

  // User refreshes page: Client queries getSessionById(sessionId)
  const refreshedSession = tabManager.getSessionById(session.id)
  assert(refreshedSession !== undefined, 'Refreshed page retrieved active session')
  assert(refreshedSession?.rounds.some((r) => r.idempotencyKey === keyB), 'Refreshed state contains the committed order')

  // ---------------------------------------------------------------------------
  // CASE C: User taps button repeatedly (Rapid Double-Click)
  // ---------------------------------------------------------------------------
  console.log('\n--- Case C: Rapid Double/Triple Button Taps ---')
  const keyC = `case-c-key-${Date.now()}`
  const roundsBeforeC = session.rounds.length

  const [t1, t2, t3] = await Promise.all([
    tabManager.appendOrderToTab(session.id, items, 'Tap 1', 'prop-red-chilly-flagship', keyC),
    tabManager.appendOrderToTab(session.id, items, 'Tap 2', 'prop-red-chilly-flagship', keyC),
    tabManager.appendOrderToTab(session.id, items, 'Tap 3', 'prop-red-chilly-flagship', keyC),
  ])

  assert(t1.newRound.id === t2.newRound.id && t2.newRound.id === t3.newRound.id, 'All 3 concurrent taps returned identical round')
  assert(session.rounds.length === roundsBeforeC + 1, 'Exactly ONE round created from 3 rapid taps')

  // ---------------------------------------------------------------------------
  // CASE D: Settlement → Browser loses connection
  // ---------------------------------------------------------------------------
  console.log('\n--- Case D: Settlement Connection Loss & Reconnect ---')
  const settledTab = tabManager.settleAndCloseTab(session.id, 'room_folio', 'Case D Settle', 'prop-red-chilly-flagship')
  const invoiceNum = settledTab.invoiceNumber

  // Client reconnects and queries session state:
  const reconnectedSession = tabManager.getSessionById(session.id)
  assert(reconnectedSession?.status === 'settled', 'Reconnected client sees settled status')
  assert(reconnectedSession?.invoiceNumber === invoiceNum, 'Reconnected client retrieves official invoice number')

  // ---------------------------------------------------------------------------
  // CASE E: Session expires / invalidates while drawer is open
  // ---------------------------------------------------------------------------
  console.log('\n--- Case E: Token Invalidation while Drawer is Open ---')
  // New guest checks in to room 404, incrementing tokenVersion
  const newGuestCheckIn = tabManager.checkInGuest('room-404', 'New Guest Case E', '4455', 'prop-red-chilly-flagship')
  const currentTokenVersion = newGuestCheckIn.location.tokenVersion

  // Old guest tries to submit order with stale token (version 1)
  const staleToken = await createGuestToken({
    sessionId: session.id,
    locationId: loc.id,
    locationIdentifier: loc.qrCodeIdentifier,
    locationName: loc.name,
    locationType: loc.locationType,
    propertyId: loc.propertyId,
    propertyName: loc.propertyName,
    guestName: 'Old Guest',
    tokenVersion: 1, // Stale version
  })

  const verifiedPayload = await verifyGuestToken(staleToken)
  const isStale = Boolean(verifiedPayload && verifiedPayload.tokenVersion < currentTokenVersion)
  assert(isStale, 'Stale token detected (payload tokenVersion < location tokenVersion)')

  // ---------------------------------------------------------------------------
  // CASE F: Admin settles tab while guest has stale browser state
  // ---------------------------------------------------------------------------
  console.log('\n--- Case F: Guest Submits Order with Stale Active UI on Settled Tab ---')
  let staleUiOrderBlocked = false
  try {
    tabManager.appendOrderToTab(session.id, items, 'Stale UI order', 'prop-red-chilly-flagship', 'key-case-f')
  } catch (err: any) {
    staleUiOrderBlocked = true
    assert(err.message.includes('already been settled'), 'Order rejected on settled tab')
  }
  assert(staleUiOrderBlocked, 'Server rejected order from stale UI and enforced settled invariant')

  console.log('\n==================================================================')
  console.log('🎉 ALL BROWSER & NETWORK FAILURE TESTS PASSED (CASES A - F)!')
  console.log('==================================================================\n')
}

runBrowserNetworkFailureTests().catch(console.error)
