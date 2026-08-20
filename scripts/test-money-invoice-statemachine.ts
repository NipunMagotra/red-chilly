/**
 * Money Correctness, Historical Snapshotting, Invoice Integrity & State Machine Test Suite
 * Single-Tenant Architecture
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

  const originalMenuItem = SEED_MENU.find((m) => m.id === 'item-1')!
  const originalPrice = originalMenuItem.price

  const { newRound } = tabManager.appendOrderToTab(
    session.id,
    [{ menuItemId: 'item-1', name: 'Red Chilly Dragon Dumplings', quantity: 2 }],
    'Snapshot test',
    'key-snapshot-1'
  )

  const orderedItem = newRound.items[0]
  assert(orderedItem.price === originalPrice, `Item snapshotted at ₹${originalPrice}`)
  assert(orderedItem.subtotal === originalPrice * 2, `Line total snapshotted at ₹${originalPrice * 2}`)

  // Simulate catalog price modification / inflation
  const catalogPriceBefore = originalMenuItem.price
  originalMenuItem.price = 999.00 // Catalog re-priced

  // Verify that previous order round was NOT affected by catalog re-pricing
  const existingRound = session.rounds.find((r) => r.id === newRound.id)!
  assert(
    existingRound.items[0].price === originalPrice,
    `Historical order price remained ₹${originalPrice} after catalog repricing`
  )
  assert(
    existingRound.subtotal === originalPrice * 2,
    `Historical order subtotal remained ₹${originalPrice * 2} after catalog repricing`
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
  // Item 2: ₹520 (qty 2) -> ₹1040
  // Item 3: ₹420 (qty 1) -> ₹420
  // Item 10: ₹590 (qty 1) -> ₹590
  // Total Subtotal = ₹2050
  const { newRound: tableRound } = tabManager.appendOrderToTab(
    tableSession.id,
    [
      { menuItemId: 'item-2', name: 'Crispy Truffle Calamari', quantity: 2 },
      { menuItemId: 'item-3', name: 'Avocado Tartare & Wonton Crisps', quantity: 1 },
      { menuItemId: 'item-10', name: 'Smoke & Spice Mezcalita', quantity: 1 },
    ],
    'Voiding test',
    'key-void-calc'
  )

  assert(tableSession.totalItemsCount === 4, 'Total item count is 4 before void')
  assert(tableRound.subtotal === 2050, `Subtotal is ₹2050 before void (₹${tableRound.subtotal})`)

  // Void Item 3 (₹420)
  const itemToVoid = tableRound.items.find((i) => i.menuItemId === 'item-3')!
  tabManager.voidOrderItem(tableSession.id, tableRound.id, itemToVoid.id, 'Guest allergic')

  // Expected after void:
  // Active Subtotal: ₹1040 + ₹590 = ₹1630
  // Tax (8.25%): Math.round(1630 * 0.0825 * 100) / 100 = ₹134.48 (paise: Math.round(163000 * 0.0825) = 13448 => 134.48)
  // Total: 1630 + 134.48 = 1764.48
  // Active Item Count: 3
  assert(tableSession.totalItemsCount === 3, 'Item count decreased by exactly 1 to 3')
  assert(tableRound.subtotal === 1630, `Round subtotal is exactly ₹1630 (₹${tableRound.subtotal})`)
  assert(tableRound.tax === 134.48, `Round tax is exactly ₹134.48 (₹${tableRound.tax})`)
  assert(tableRound.total === 1764.48, `Round total is exactly ₹1764.48 (₹${tableRound.total})`)

  // ---------------------------------------------------------------------------
  // TEST 3: Invoice Number Uniqueness & SHA-256 Digital Checksum
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 3: Invoice Uniqueness & SHA-256 Digital Checksum ---')

  const settledSession = tabManager.settleAndCloseTab(
    tableSession.id,
    'credit_card',
    'Paid at table terminal'
  )

  assert(Boolean(settledSession.invoiceNumber?.startsWith('INV-RDC-')), 'Invoice number has prefix INV-RDC-')
  assert(Boolean(settledSession.invoiceSequenceNumber && settledSession.invoiceSequenceNumber > 1000), 'Sequential invoice counter > 1000')
  assert(Boolean(settledSession.invoiceChecksum && settledSession.invoiceChecksum.length === 64), 'SHA-256 digital verification checksum is 64 hex chars')

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
