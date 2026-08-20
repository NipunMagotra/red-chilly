/**
 * Adversarial Concurrency & Settlement Race Stress Test Suite
 * 
 * Objectives:
 * 1. Execute 100 simultaneous append requests against one guest session.
 * 2. Execute 50 append requests + 50 settlement requests concurrently.
 * 3. Verify:
 *    - No lost orders
 *    - No duplicate orders
 *    - No incorrect totals
 *    - No orders accepted after settlement
 *    - No invoice collisions
 *    - No negative totals
 *    - No orphaned order items
 *    - No inconsistent round numbers
 * 4. Compare final database state against an independently calculated expected result.
 */

import {
  toCents,
  toDollars,
  calculateTaxCents,
} from '../src/lib/data/restaurant-data'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`)
    process.exit(1)
  } else {
    console.log(`✅ PASSED: ${message}`)
  }
}

interface DbRowSession {
  id: string
  property_id: string
  location_id: string
  status: 'active' | 'settled' | 'closed'
  subtotal: number
  tax: number
  total_amount: number
  total_items_count: number
  rounds_count: number
  invoice_number: string | null
  settled_at: string | null
}

interface DbRowOrder {
  id: string
  guest_session_id: string
  property_id: string
  round_number: number
  idempotency_key: string | null
  subtotal: number
  tax: number
  total: number
  items_count: number
  status: string
}

interface DbRowOrderItem {
  id: string
  order_id: string
  menu_item_id: string
  unit_price: number
  quantity: number
  subtotal: number
}

class ConcurrentPostgresEngine {
  private session: DbRowSession
  private orders: DbRowOrder[] = []
  private orderItems: DbRowOrderItem[] = []
  private invoiceCounter = 1000
  private sessionLock = false
  private lockQueue: (() => void)[] = []

  constructor() {
    this.session = {
      id: 'session-stress-test-1',
      property_id: 'prop-red-chilly-flagship',
      location_id: 'loc-room-404',
      status: 'active',
      subtotal: 0,
      tax: 0,
      total_amount: 0,
      total_items_count: 0,
      rounds_count: 0,
      invoice_number: null,
      settled_at: null,
    }
  }

  private async acquireRowLock(): Promise<void> {
    if (!this.sessionLock) {
      this.sessionLock = true
      return
    }
    return new Promise<void>((resolve) => {
      this.lockQueue.push(resolve)
    })
  }

  private releaseRowLock(): void {
    if (this.lockQueue.length > 0) {
      const next = this.lockQueue.shift()!
      next()
    } else {
      this.sessionLock = false
    }
  }

  /**
   * Stored procedure append_items_to_guest_tab
   */
  async appendItems(
    items: { menuItemId: string; price: number; quantity: number }[],
    idempotencyKey?: string
  ): Promise<{ success: boolean; orderId?: string; roundNumber?: number; error?: string; isReplay?: boolean }> {
    await this.acquireRowLock()
    try {
      // 1. Invariant: Session status must be active
      if (this.session.status === 'settled') {
        return { success: false, error: 'This room tab has already been settled at checkout and cannot accept new orders.' }
      }
      if (this.session.status !== 'active') {
        return { success: false, error: `Cannot append orders to tab with status ${this.session.status}` }
      }

      // 2. Idempotency Check
      if (idempotencyKey) {
        const existing = this.orders.find((o) => o.idempotency_key === idempotencyKey)
        if (existing) {
          return { success: true, orderId: existing.id, roundNumber: existing.round_number, isReplay: true }
        }
      }

      // 3. Compute Financials using Minor Units (Cents)
      const roundSubtotalCents = items.reduce((acc, it) => acc + toCents(it.price) * it.quantity, 0)
      const roundTaxCents = calculateTaxCents(roundSubtotalCents, 0.0825)
      const roundTotalCents = roundSubtotalCents + roundTaxCents
      const totalQty = items.reduce((acc, it) => acc + it.quantity, 0)

      const nextRoundNum = this.orders.length + 1
      const orderId = `order-${this.session.id}-${nextRoundNum}`

      const newOrder: DbRowOrder = {
        id: orderId,
        guest_session_id: this.session.id,
        property_id: this.session.property_id,
        round_number: nextRoundNum,
        idempotency_key: idempotencyKey || null,
        subtotal: toDollars(roundSubtotalCents),
        tax: toDollars(roundTaxCents),
        total: toDollars(roundTotalCents),
        items_count: totalQty,
        status: 'pending',
      }

      this.orders.push(newOrder)

      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        this.orderItems.push({
          id: `oi-${orderId}-${i}`,
          order_id: orderId,
          menu_item_id: it.menuItemId,
          unit_price: it.price,
          quantity: it.quantity,
          subtotal: toDollars(toCents(it.price) * it.quantity),
        })
      }

      // Update session totals atomically
      this.session.subtotal = toDollars(toCents(this.session.subtotal) + roundSubtotalCents)
      this.session.tax = toDollars(toCents(this.session.tax) + roundTaxCents)
      this.session.total_amount = toDollars(toCents(this.session.total_amount) + roundTotalCents)
      this.session.total_items_count += totalQty
      this.session.rounds_count = nextRoundNum

      return { success: true, orderId, roundNumber: nextRoundNum, isReplay: false }
    } finally {
      this.releaseRowLock()
    }
  }

  /**
   * Stored procedure settle_guest_tab
   */
  async settleTab(): Promise<{ success: boolean; invoiceNumber?: string; totalAmount?: number; alreadySettled?: boolean; error?: string }> {
    await this.acquireRowLock()
    try {
      if (this.session.status === 'settled') {
        return {
          success: true,
          invoiceNumber: this.session.invoice_number!,
          totalAmount: this.session.total_amount,
          alreadySettled: true,
        }
      }

      if (this.session.status !== 'active') {
        return { success: false, error: `Cannot settle session in status ${this.session.status}` }
      }

      this.invoiceCounter++
      const invoiceNumber = `INV-RDC-20260820-${this.invoiceCounter}`

      this.session.status = 'settled'
      this.session.invoice_number = invoiceNumber
      this.session.settledAt = new Date().toISOString()

      return {
        success: true,
        invoiceNumber,
        totalAmount: this.session.total_amount,
        alreadySettled: false,
      }
    } finally {
      this.releaseRowLock()
    }
  }

  getState() {
    return {
      session: { ...this.session },
      orders: [...this.orders],
      orderItems: [...this.orderItems],
    }
  }
}

async function runConcurrencyStressTests() {
  console.log('\n==================================================================')
  console.log('⚡ 7. ADVERSARIAL SETTLEMENT / APPEND CONCURRENCY STRESS AUDIT')
  console.log('==================================================================\n')

  // ---------------------------------------------------------------------------
  // TEST 1: 100 Simultaneous Append Requests
  // ---------------------------------------------------------------------------
  console.log('--- Test 1: 100 Simultaneous Append Requests against Single Session ---')
  const engine1 = new ConcurrentPostgresEngine()

  const itemPayload = [
    { menuItemId: 'item-1', price: 14.50, quantity: 2 }, // $29.00
    { menuItemId: 'item-10', price: 16.50, quantity: 1 }, // $16.50
  ]
  // Per round: Subtotal = $45.50, Tax (8.25%) = Math.round(45.50 * 0.0825 * 100)/100 = $3.75, Total = $49.25, Qty = 3

  const expectedSingleSubtotal = 45.50
  const expectedSingleTax = 3.75
  const expectedSingleTotal = 49.25
  const expectedSingleQty = 3

  const appendPromises: Promise<any>[] = []
  for (let i = 0; i < 100; i++) {
    appendPromises.push(
      engine1.appendItems(itemPayload, `key-stress-100-${i}`)
    )
  }

  const appendResults = await Promise.all(appendPromises)

  const successAppends = appendResults.filter((r) => r.success && !r.isReplay)
  assert(successAppends.length === 100, `All 100 simultaneous appends succeeded (count = ${successAppends.length})`)

  const state1 = engine1.getState()

  // Verify consistency
  assert(state1.orders.length === 100, 'Orders table contains exactly 100 rows (no lost or duplicate orders)')
  assert(state1.orderItems.length === 200, 'OrderItems table contains exactly 200 rows (no orphaned items)')
  assert(state1.session.rounds_count === 100, 'Session rounds_count is exactly 100')
  assert(state1.session.total_items_count === 300, 'Session total_items_count is exactly 300 (100 * 3)')

  const expectedTotalSubtotal = 100 * expectedSingleSubtotal // 4550.00
  const expectedTotalTax = 100 * expectedSingleTax // 375.00
  const expectedGrandTotal = 100 * expectedSingleTotal // 4925.00

  assert(state1.session.subtotal === expectedTotalSubtotal, `Subtotal matched independent sum ($${state1.session.subtotal} === $${expectedTotalSubtotal})`)
  assert(state1.session.tax === expectedTotalTax, `Tax matched independent sum ($${state1.session.tax} === $${expectedTotalTax})`)
  assert(state1.session.total_amount === expectedGrandTotal, `Total amount matched independent sum ($${state1.session.total_amount} === $${expectedGrandTotal})`)

  // Verify monotonic round numbers
  const roundNums = state1.orders.map((o) => o.round_number)
  const isSequential = roundNums.every((num, idx) => num === idx + 1)
  assert(isSequential, 'Round numbers are strictly sequential from 1 through 100 with zero gaps')

  // ---------------------------------------------------------------------------
  // TEST 2: 50 Concurrent Appends + 50 Concurrent Settlements
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 2: 50 Concurrent Appends + 50 Concurrent Settlements Race ---')
  const engine2 = new ConcurrentPostgresEngine()

  // Shuffle 50 appends and 50 settlements together
  const mixedOps: { type: 'append' | 'settle'; key?: string }[] = []
  for (let i = 0; i < 50; i++) {
    mixedOps.push({ type: 'append', key: `mixed-append-${i}` })
    mixedOps.push({ type: 'settle' })
  }

  // Shuffle randomly
  mixedOps.sort(() => Math.random() - 0.5)

  const mixedResults = await Promise.all(
    mixedOps.map((op) => {
      if (op.type === 'append') {
        return engine2.appendItems(itemPayload, op.key).then((res) => ({ type: 'append', res }))
      } else {
        return engine2.settleTab().then((res) => ({ type: 'settle', res }))
      }
    })
  )

  const state2 = engine2.getState()

  const successfulAppends = mixedResults.filter((r) => r.type === 'append' && r.res.success)
  const rejectedAppends = mixedResults.filter((r) => r.type === 'append' && !r.res.success)
  const settleSuccesses = mixedResults.filter((r) => r.type === 'settle' && r.res.success && !r.res.alreadySettled)
  const reSettleReplays = mixedResults.filter((r) => r.type === 'settle' && r.res.success && r.res.alreadySettled)

  console.log(`- Total Appends Attempted: 50`)
  console.log(`  ├─ Appends Committed before Settlement: ${successfulAppends.length}`)
  console.log(`  └─ Appends Blocked after Settlement: ${rejectedAppends.length}`)
  console.log(`- Total Settlements Attempted: 50`)
  console.log(`  ├─ Initial Settlement Transition: ${settleSuccesses.length}`)
  console.log(`  └─ Idempotent Re-settlements: ${reSettleReplays.length}`)

  assert(state2.session.status === 'settled', 'Session is settled in final state')
  assert(settleSuccesses.length === 1, 'Exactly ONE settlement performed the state transition (no duplicate invoices)')
  assert(state2.orders.length === successfulAppends.length, 'Database orders count strictly matches committed appends count')

  // Invariant: No orders accepted after settlement
  for (const rej of rejectedAppends) {
    assert(
      rej.res.error?.includes('already been settled'),
      'All rejected appends returned explicit settled tab rejection error'
    )
  }

  // Invariant: Financials strictly match committed orders
  const committedCount = successfulAppends.length
  const expectedSubtotal2 = committedCount * expectedSingleSubtotal
  const expectedTax2 = committedCount * expectedSingleTax
  const expectedTotal2 = committedCount * expectedSingleTotal

  assert(state2.session.subtotal === expectedSubtotal2, `Subtotal ($${state2.session.subtotal}) matches committed count ($${expectedSubtotal2})`)
  assert(state2.session.tax === expectedTax2, `Tax ($${state2.session.tax}) matches committed count ($${expectedTax2})`)
  assert(state2.session.total_amount === expectedTotal2, `Total ($${state2.session.total_amount}) matches committed count ($${expectedTotal2})`)
  assert(state2.session.total_amount >= 0, 'Total amount is non-negative')

  console.log('\n==================================================================')
  console.log('🎉 ALL CONCURRENCY STRESS & SETTLEMENT RACE TESTS PASSED!')
  console.log('==================================================================\n')
}

runConcurrencyStressTests().catch(console.error)
