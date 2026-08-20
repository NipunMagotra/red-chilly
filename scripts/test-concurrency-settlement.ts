/**
 * Continuous Tab Concurrency, Financial Idempotency & Settlement Race Test Suite
 */

import { tabManager } from '../src/lib/data/restaurant-data'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`)
    process.exit(1)
  } else {
    console.log(`✅ PASSED: ${message}`)
  }
}

async function runConcurrencyTests() {
  console.log('\n======================================================')
  console.log('⚡ RUNNING CONTINUOUS TAB CONCURRENCY & SETTLEMENT AUDIT')
  console.log('======================================================\n')

  // Setup Test Location & Session
  const location = tabManager.getLocationByIdentifier('cabana-7')!
  const session = tabManager.createOrGetSession(location)
  const initialBalance = session.totalAmount
  const initialRoundsCount = session.rounds.length

  // ---------------------------------------------------------------------------
  // TEST 1: Double-Click & Network Retry Idempotency
  // ---------------------------------------------------------------------------
  console.log('--- Test 1: Double-Click / Retry Idempotency ---')
  const sharedIdempotencyKey = 'idem-key-double-click-98234'

  const items = [
    { menuItemId: 'item-8', name: 'Loaded Chili Oil Truffle Fries', quantity: 2, price: 11.50 }
  ]

  // Dispatch 3 simultaneous requests with identical idempotencyKey
  const results = await Promise.all([
    tabManager.appendOrderToTab(session.id, items, 'Double click 1', 'prop-red-chilly-flagship', sharedIdempotencyKey),
    tabManager.appendOrderToTab(session.id, items, 'Double click 2', 'prop-red-chilly-flagship', sharedIdempotencyKey),
    tabManager.appendOrderToTab(session.id, items, 'Double click 3', 'prop-red-chilly-flagship', sharedIdempotencyKey),
  ])

  // Assert all 3 calls resolved with the exact same new round
  assert(results[0].newRound.id === results[1].newRound.id, 'Request 1 and 2 returned identical round ID')
  assert(results[1].newRound.id === results[2].newRound.id, 'Request 2 and 3 returned identical round ID')
  assert(session.rounds.length === initialRoundsCount + 1, 'Exactly ONE round created despite 3 concurrent requests')

  const expectedSingleRoundSubtotal = 23.00
  const expectedSingleRoundTax = Math.round(23.00 * 0.0825 * 100) / 100
  const expectedSingleRoundTotal = 23.00 + expectedSingleRoundTax
  assert(
    session.totalAmount === Math.round((initialBalance + expectedSingleRoundTotal) * 100) / 100,
    `Total balance charged only once ($${session.totalAmount})`
  )

  // ---------------------------------------------------------------------------
  // TEST 2: Concurrent Distinct Orders (Atomic Accumulation)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 2: Concurrent Distinct Orders ---')
  const roundsBeforeDistinct = session.rounds.length
  const balanceBeforeDistinct = session.totalAmount

  const orderA = [
    { menuItemId: 'item-1', name: 'Red Chilly Dragon Dumplings', quantity: 1, price: 14.50 }
  ]
  const orderB = [
    { menuItemId: 'item-10', name: 'Smoke & Spice Mezcalita', quantity: 1, price: 16.50 }
  ]

  // Dispatch 2 distinct orders simultaneously
  const [resA, resB] = await Promise.all([
    tabManager.appendOrderToTab(session.id, orderA, 'Round A', 'prop-red-chilly-flagship', 'key-distinct-A'),
    tabManager.appendOrderToTab(session.id, orderB, 'Round B', 'prop-red-chilly-flagship', 'key-distinct-B'),
  ])

  assert(resA.newRound.id !== resB.newRound.id, 'Distinct orders created distinct round IDs')
  assert(session.rounds.length === roundsBeforeDistinct + 2, 'Both rounds atomically appended')

  const subtotalA = 14.50
  const taxA = Math.round(14.50 * 0.0825 * 100) / 100
  const subtotalB = 16.50
  const taxB = Math.round(16.50 * 0.0825 * 100) / 100
  const expectedFinalBalance = Math.round((balanceBeforeDistinct + subtotalA + taxA + subtotalB + taxB) * 100) / 100

  assert(
    session.totalAmount === expectedFinalBalance,
    `Financial total is strictly additive ($${session.totalAmount} === $${expectedFinalBalance})`
  )

  // ---------------------------------------------------------------------------
  // TEST 3: Settlement Race Condition & Invariant Enforcement
  // Invariant: SETTLED TAB -> Rejects new rounds
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 3: Tab Settlement & Invariant Defense ---')

  // Reception settles the tab
  tabManager.settleAndCloseTab(session.id, 'room_folio', 'Guest checking out', 'prop-red-chilly-flagship')
  assert(session.status === 'settled', 'Session status transitioned to settled')
  assert(session.settledAt !== undefined, 'settledAt timestamp recorded')
  assert(Boolean(session.invoiceNumber?.startsWith('INV-')), 'Official invoice number generated')

  // Guest tries to order after settlement
  let postSettlementOrderBlocked = false
  try {
    tabManager.appendOrderToTab(
      session.id,
      [{ menuItemId: 'item-7', name: 'Midnight Chilly Cheeseburger Sliders', quantity: 1, price: 15.00 }],
      'Late night post-checkout snack',
      'prop-red-chilly-flagship',
      'key-post-settle'
    )
  } catch (err: any) {
    postSettlementOrderBlocked = true
    assert(
      err.message.includes('already been settled'),
      `Post-settlement order correctly rejected: "${err.message}"`
    )
  }
  assert(postSettlementOrderBlocked, 'SETTLED TAB strictly rejects new rounds')

  // ---------------------------------------------------------------------------
  // TEST 4: Voiding on Settled Tab Invariant
  // Invariant: Cannot void items once tab is settled
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 4: Voiding on Settled Tab Rejection ---')
  let voidOnSettledBlocked = false
  try {
    const round = session.rounds[0]
    const item = round.items[0]
    tabManager.voidOrderItem(session.id, round.id, item.id, 'Fraudulent late void', 'prop-red-chilly-flagship')
  } catch (err: any) {
    voidOnSettledBlocked = true
    assert(
      err.message.includes('Cannot void items from a tab that is already settled'),
      `Voiding on settled tab correctly rejected: "${err.message}"`
    )
  }
  assert(voidOnSettledBlocked, 'Settled tab is immutable and cannot be tampered with')

  console.log('\n======================================================')
  console.log('🎉 ALL CONCURRENCY, IDEMPOTENCY & SETTLEMENT TESTS PASSED!')
  console.log('======================================================\n')
}

runConcurrencyTests().catch((e) => {
  console.error(e)
  process.exit(1)
})
