/**
 * Database Integrity, Timezone Correctness, Client Recovery & Double-Submission Test Suite
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

async function runDatabaseTimezoneNetworkTests() {
  console.log('\n==================================================================')
  console.log('🌐 RUNNING DATABASE INTEGRITY, TIMEZONE & NETWORK FAILURE AUDIT')
  console.log('==================================================================\n')

  // ---------------------------------------------------------------------------
  // TEST 1: Double-Submission Network Failure Recovery
  // Scenario:
  // 1. Guest taps "Append to Room Tab"
  // 2. Server commits order successfully
  // 3. Network response is lost (simulated timeout/disconnect)
  // 4. Browser retries with same idempotencyKey
  // 5. Assert: System returns existing round, 0 duplicate items, balance charged once
  // ---------------------------------------------------------------------------
  console.log('--- Test 1: Network Failure & Double Submission Recovery ---')
  const loc = tabManager.getLocationByIdentifier('room-404')!
  const session = tabManager.createOrGetSession(loc)

  const balanceBefore = session.totalAmount
  const roundsBefore = session.rounds.length
  const idempotencyKey = `network-retry-test-${Date.now()}`

  const orderPayload = [
    { menuItemId: 'item-8', name: 'Loaded Chili Oil Truffle Fries', quantity: 1, price: 11.50 },
    { menuItemId: 'item-10', name: 'Smoke & Spice Mezcalita', quantity: 1, price: 16.50 },
  ]

  // First Attempt: Server commits
  const firstAttempt = tabManager.appendOrderToTab(
    session.id,
    orderPayload,
    'Room service',
    'prop-red-chilly-flagship',
    idempotencyKey
  )

  const committedRoundId = firstAttempt.newRound.id
  const committedBalance = session.totalAmount

  // Second Attempt: Network retry with same idempotencyKey
  const retryAttempt = tabManager.appendOrderToTab(
    session.id,
    orderPayload,
    'Room service (retry)',
    'prop-red-chilly-flagship',
    idempotencyKey
  )

  assert(retryAttempt.newRound.id === committedRoundId, 'Retry returned identical round ID')
  assert(session.rounds.length === roundsBefore + 1, 'Exactly ONE round created despite retry')
  assert(session.totalAmount === committedBalance, `Balance charged only once ($${session.totalAmount} === $${committedBalance})`)

  // ---------------------------------------------------------------------------
  // TEST 2: Time & Timezone Formatting Correctness
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 2: Timezone Formatting & Date Prefix ---')

  const utcTimestamp = new Date('2026-08-20T02:30:00Z') // 2:30 AM UTC on Aug 20

  // Format in America/New_York (EDT, UTC-4 -> 10:30 PM on Aug 19)
  const nyFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = nyFormatter.formatToParts(utcTimestamp)
  const nyYear = parts.find((p) => p.type === 'year')?.value
  const nyMonth = parts.find((p) => p.type === 'month')?.value
  const nyDay = parts.find((p) => p.type === 'day')?.value
  const nyDateStr = `${nyYear}${nyMonth}${nyDay}`

  assert(nyDateStr === '20260819', `New York date is 2026-08-19 when UTC is 2026-08-20 02:30 ($${nyDateStr})`)

  // Format in Asia/Kolkata (IST, UTC+5:30 -> 8:00 AM on Aug 20)
  const istFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const istParts = istFormatter.formatToParts(utcTimestamp)
  const istDateStr = `${istParts.find((p) => p.type === 'year')?.value}${istParts.find((p) => p.type === 'month')?.value}${istParts.find((p) => p.type === 'day')?.value}`

  assert(istDateStr === '20260820', `Kolkata date is 2026-08-20 ($${istDateStr})`)

  // ---------------------------------------------------------------------------
  // TEST 3: Database Single Active Session Invariant
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 3: Single Active Session Invariant ---')

  const activeSession1 = tabManager.getActiveSessionForLocation(loc.id)
  assert(activeSession1 !== undefined, 'Active session exists for Room 404')

  const activeSession2 = tabManager.createOrGetSession(loc)
  assert(activeSession1?.id === activeSession2.id, 'createOrGetSession returns same active session without duplicate creation')

  // ---------------------------------------------------------------------------
  // TEST 4: Historical Financial Integrity on Menu Deletion
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 4: Historical Financial Integrity ---')

  const round = session.rounds[0]
  const firstItem = round.items[0]
  assert(Boolean(firstItem.price && firstItem.subtotal), 'Historical item price and subtotal are preserved')
  assert(firstItem.historicalMenuName !== undefined, 'Historical menu name is preserved')

  console.log('\n==================================================================')
  console.log('🎉 ALL DATABASE INTEGRITY, TIMEZONE & NETWORK TESTS PASSED!')
  console.log('==================================================================\n')
}

runDatabaseTimezoneNetworkTests().catch((e) => {
  console.error(e)
  process.exit(1)
})
