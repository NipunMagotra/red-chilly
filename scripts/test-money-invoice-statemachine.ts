/**
 * Money Correctness, Historical Snapshotting, Invoice Integrity & State Machine Test Suite
 */

import crypto from 'crypto'
import {
  tabManager,
  SEED_MENU,
  validateSessionTransition,
  validateOrderTransition,
} from '../src/lib/data/restaurant-data'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`)
    process.exit(1)
  } else {
    console.log(`✅ PASSED: ${message}`)
  }
}

async function runMoneyInvoiceStateMachineTests() {
  console.log('\n==================================================================')
  console.log('💰 RUNNING MONEY CORRECTNESS, INVOICE INTEGRITY & STATE MACHINE AUDIT')
  console.log('==================================================================\n')

  // ---------------------------------------------------------------------------
  // TEST 1: Price Tampering & Historical Price Snapshotting
  // ---------------------------------------------------------------------------
  console.log('--- Test 1: Historical Price Snapshotting ---')
  const loc = tabManager.getLocationByIdentifier('room-201')!
  const session = tabManager.createOrGetSession(loc)

  // Order Item 1 at original price $14.50
  const originalMenuItem = SEED_MENU.find((m) => m.id === 'item-1')!
  const originalPrice = originalMenuItem.price

  const { newRound } = tabManager.appendOrderToTab(
    session.id,
    [{ menuItemId: 'item-1', name: 'Red Chilly Dragon Dumplings', quantity: 2 }],
    'Snapshot test',
    'prop-red-chilly-flagship',
    'key-snapshot-1'
  )

  const orderedItem = newRound.items[0]
  assert(orderedItem.price === originalPrice, `Item snapshotted at $${originalPrice}`)
  assert(orderedItem.subtotal === originalPrice * 2, `Line total snapshotted at $${originalPrice * 2}`)

  // Simulate catalog price modification / inflation
  const catalogPriceBefore = originalMenuItem.price
  originalMenuItem.price = 99.99 // Catalog re-priced

  // Verify that previous order round was NOT affected by catalog re-pricing
  const existingRound = session.rounds.find((r) => r.id === newRound.id)!
  assert(
    existingRound.items[0].price === 14.50,
    'Historical order price remained $14.50 after catalog repricing'
  )
  assert(
    existingRound.subtotal === 29.00,
    'Historical order subtotal remained $29.00 after catalog repricing'
  )

  // Restore catalog price
  originalMenuItem.price = catalogPriceBefore

  // ---------------------------------------------------------------------------
  // TEST 2: Money Correctness & Single-Count Voiding
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 2: Money Correctness & Exact Void Exclusion ---')
  const locTable = tabManager.getLocationByIdentifier('table-12')!
  const tableSession = tabManager.createOrGetSession(locTable)

  // Append 3 items:
  // Item 2: $16.00 (qty 2) -> $32.00
  // Item 3: $13.00 (qty 1) -> $13.00
  // Item 10: $16.50 (qty 1) -> $16.50
  // Total Subtotal = $61.50
  const { newRound: tableRound } = tabManager.appendOrderToTab(
    tableSession.id,
    [
      { menuItemId: 'item-2', name: 'Crispy Truffle Calamari', quantity: 2 },
      { menuItemId: 'item-3', name: 'Avocado Tartare & Wonton Crisps', quantity: 1 },
      { menuItemId: 'item-10', name: 'Smoke & Spice Mezcalita', quantity: 1 },
    ],
    'Voiding test',
    'prop-red-chilly-flagship',
    'key-void-calc'
  )

  assert(tableSession.totalItemsCount === 4, 'Total item count is 4 before void')
  assert(tableRound.subtotal === 61.50, `Subtotal is $61.50 before void ($${tableRound.subtotal})`)

  // Void Item 3 ($13.00)
  const itemToVoid = tableRound.items.find((i) => i.menuItemId === 'item-3')!
  tabManager.voidOrderItem(tableSession.id, tableRound.id, itemToVoid.id, 'Guest allergic', 'prop-red-chilly-flagship')

  // Expected after void:
  // Active Subtotal: $32.00 + $16.50 = $48.50
  // Tax (8.25%): Math.round(48.50 * 0.0825 * 100) / 100 = $4.00
  // Total: $48.50 + $4.00 = $52.50
  // Active Item Count: 3
  assert(tableSession.totalItemsCount === 3, 'Item count decreased by exactly 1 to 3')
  assert(tableRound.subtotal === 48.50, `Round subtotal is exactly $48.50 ($${tableRound.subtotal})`)
  assert(tableRound.tax === 4.00, `Round tax is exactly $4.00 ($${tableRound.tax})`)
  assert(tableRound.total === 52.50, `Round total is exactly $52.50 ($${tableRound.total})`)
  assert(tableSession.totalAmount === 52.50, `Session total is exactly $52.50 ($${tableSession.totalAmount})`)

  // ---------------------------------------------------------------------------
  // TEST 3: Invoice Number Uniqueness & SHA-256 Digital Checksum
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 3: Invoice Uniqueness & SHA-256 Digital Checksum ---')

  const settledSession = tabManager.settleAndCloseTab(
    tableSession.id,
    'credit_card',
    'Paid at table terminal',
    'prop-red-chilly-flagship'
  )

  assert(Boolean(settledSession.invoiceNumber?.startsWith('INV-RDC-')), 'Invoice number has property prefix INV-RDC-')
  assert(Boolean(settledSession.invoiceSequenceNumber && settledSession.invoiceSequenceNumber > 1000), 'Sequential invoice counter > 1000')
  assert(Boolean(settledSession.invoiceChecksum && settledSession.invoiceChecksum.length === 64), 'SHA-256 digital verification checksum is 64 hex chars')

  // Re-compute SHA-256 to verify checksum integrity
  const expectedChecksumPayload = `${settledSession.invoiceNumber}:${settledSession.id}:${settledSession.propertyId}:${settledSession.totalAmount.toFixed(2)}:${settledSession.settledAt}`
  const computedChecksum = crypto.createHash('sha256').update(expectedChecksumPayload).digest('hex')
  assert(settledSession.invoiceChecksum === computedChecksum, 'Invoice checksum matches cryptographic signature')

  // ---------------------------------------------------------------------------
  // TEST 4: State Machine Legal & Illegal Transition Enforcement
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 4: State Machine Transition Invariants ---')

  // Session transitions
  assert(validateSessionTransition('active', 'settled'), 'active -> settled is legal')
  assert(validateSessionTransition('active', 'closed'), 'active -> closed is legal')
  assert(!validateSessionTransition('settled', 'active'), 'settled -> active is ILLEGAL (Terminal)')
  assert(!validateSessionTransition('closed', 'active'), 'closed -> active is ILLEGAL (Terminal)')
  assert(!validateSessionTransition('voided', 'active'), 'voided -> active is ILLEGAL (Terminal)')

  // Order transitions
  assert(validateOrderTransition('pending', 'preparing'), 'pending -> preparing is legal')
  assert(validateOrderTransition('preparing', 'ready'), 'preparing -> ready is legal')
  assert(validateOrderTransition('ready', 'delivered'), 'ready -> delivered is legal')
  assert(!validateOrderTransition('delivered', 'preparing'), 'delivered -> preparing is ILLEGAL (Backward)')
  assert(!validateOrderTransition('preparing', 'pending'), 'preparing -> pending is ILLEGAL (Backward)')
  assert(!validateOrderTransition('cancelled', 'pending'), 'cancelled -> pending is ILLEGAL (Terminal)')

  console.log('\n==================================================================')
  console.log('🎉 ALL MONEY CORRECTNESS, INVOICE & STATE MACHINE TESTS PASSED!')
  console.log('==================================================================\n')
}

runMoneyInvoiceStateMachineTests().catch((e) => {
  console.error(e)
  process.exit(1)
})
