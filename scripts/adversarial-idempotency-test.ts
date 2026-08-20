/**
 * Adversarial Production Idempotency Audit & Test Suite
 * 
 * Objectives:
 * 1. Audit idempotencyStore memory locality, persistence, and multi-instance behavior.
 * 2. Simulate 2 independent application instances (Instance A & Instance B).
 * 3. Simulate process restart between initial commit and network retry.
 * 4. Test concurrent execution contexts with identical idempotency key.
 * 5. Test lost response recovery.
 * 6. Audit database-level unique constraints and stored procedure replay semantics.
 * 7. Test edge case of empty string `''` vs `NULL` idempotency keys.
 */

import {
  tabManager,
  SEED_LOCATIONS,
  GuestTabSession,
  OrderRoundRecord,
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

// -----------------------------------------------------------------------------
// SIMULATED MULTI-INSTANCE CONTAINER CLASS
// -----------------------------------------------------------------------------
class SimulatedAppInstance {
  public instanceId: string
  private idempotencyStore: Map<string, { session: GuestTabSession; newRound: OrderRoundRecord }> = new Map()
  private sessions: Map<string, GuestTabSession> = new Map()

  constructor(id: string) {
    this.instanceId = id
    // Clone initial locations
    const loc = SEED_LOCATIONS.find((l) => l.qrCodeIdentifier === 'room-404')!
    const session: GuestTabSession = {
      id: `session-room-404-multi-inst`,
      propertyId: loc.propertyId,
      propertyName: loc.propertyName,
      locationId: loc.id,
      locationIdentifier: loc.qrCodeIdentifier,
      locationName: loc.name,
      locationType: loc.locationType,
      guestName: loc.guestName,
      tokenVersion: loc.tokenVersion || 1,
      status: 'active',
      subtotal: 0,
      tax: 0,
      totalAmount: 0,
      totalItemsCount: 0,
      rounds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.sessions.set(session.id, session)
  }

  getSession(id: string): GuestTabSession | undefined {
    return this.sessions.get(id)
  }

  restart() {
    console.log(`🔄 [${this.instanceId}] Simulating instance restart / cold start (Wiping in-memory state)...`)
    this.idempotencyStore.clear()
  }

  appendOrderInInstance(
    sessionId: string,
    items: { menuItemId: string; name: string; price: number; quantity: number }[],
    idempotencyKey?: string
  ): { session: GuestTabSession; newRound: OrderRoundRecord; isReplay: boolean } {
    const cleanKey = idempotencyKey?.trim()
    if (cleanKey) {
      const cacheId = `${sessionId}:${cleanKey}`
      const cached = this.idempotencyStore.get(cacheId)
      if (cached) {
        return { session: cached.session, newRound: cached.newRound, isReplay: true }
      }
    }

    const session = this.sessions.get(sessionId)!
    const subtotalCents = items.reduce((acc, it) => acc + toCents(it.price) * it.quantity, 0)
    const taxCents = calculateTaxCents(subtotalCents, 0.0825)
    const totalCents = subtotalCents + taxCents

    const newRoundNumber = session.rounds.length + 1
    const newRound: OrderRoundRecord = {
      id: `round-${session.id}-${newRoundNumber}`,
      roundNumber: newRoundNumber,
      status: 'pending',
      taxRateSnapshot: 0.0825,
      subtotal: toDollars(subtotalCents),
      tax: toDollars(taxCents),
      total: toDollars(totalCents),
      items: items.map((it, idx) => ({
        id: `item-${Date.now()}-${idx}`,
        menuItemId: it.menuItemId,
        name: it.name,
        price: it.price,
        quantity: it.quantity,
        subtotal: toDollars(toCents(it.price) * it.quantity),
      })),
      idempotencyKey: cleanKey,
      createdAt: new Date().toISOString(),
    }

    session.rounds.push(newRound)
    session.subtotal += newRound.subtotal
    session.tax += newRound.tax
    session.totalAmount += newRound.total
    session.totalItemsCount += items.reduce((acc, it) => acc + it.quantity, 0)

    if (cleanKey) {
      this.idempotencyStore.set(`${sessionId}:${cleanKey}`, { session, newRound })
    }

    return { session, newRound, isReplay: false }
  }
}

// -----------------------------------------------------------------------------
// DATABASE STORED PROCEDURE EMULATOR (PostgreSQL Spec)
// -----------------------------------------------------------------------------
interface DbOrder {
  id: string
  guest_session_id: string
  property_id: string
  location_id: string
  round_number: number
  idempotency_key: string | null
  subtotal: number
  tax: number
  total: number
  status: string
}

class SimulatedPostgresDatabase {
  private orders: DbOrder[] = []
  private sessionLocks: Set<string> = new Set()
  private sessionTotals: Map<string, { subtotal: number; tax: number; total: number; count: number }> = new Map()

  constructor() {
    this.sessionTotals.set('session-db-100', { subtotal: 0, tax: 0, total: 0, count: 0 })
  }

  /**
   * Emulates `append_items_to_guest_tab` with FOR UPDATE row locking and idempotency
   */
  async appendItemsToGuestTabProc(
    sessionId: string,
    locationId: string,
    propertyId: string,
    items: { price: number; quantity: number }[],
    idempotencyKey?: string | null
  ): Promise<{ success: boolean; order_id: string; round_number: number; round_total: number; is_idempotent_replay: boolean }> {
    // 1. Emulate Row Lock (FOR UPDATE)
    while (this.sessionLocks.has(sessionId)) {
      await new Promise((r) => setTimeout(r, 10))
    }
    this.sessionLocks.add(sessionId)

    try {
      // 2. Idempotency Check: Return existing round if already created with this key
      if (idempotencyKey !== undefined && idempotencyKey !== null && idempotencyKey !== '') {
        const existing = this.orders.find(
          (o) => o.guest_session_id === sessionId && o.idempotency_key === idempotencyKey
        )
        if (existing) {
          const currentTotal = this.sessionTotals.get(sessionId)!
          return {
            success: true,
            order_id: existing.id,
            round_number: existing.round_number,
            round_total: existing.total,
            is_idempotent_replay: true,
          }
        }
      }

      // 3. Unique Constraint Check (simulating UNIQUE (guest_session_id, idempotency_key))
      if (idempotencyKey !== null && idempotencyKey !== undefined) {
        const duplicateKey = this.orders.find(
          (o) => o.guest_session_id === sessionId && o.idempotency_key === idempotencyKey
        )
        if (duplicateKey) {
          throw new Error('duplicate key value violates unique constraint "orders_guest_session_id_idempotency_key_key"')
        }
      }

      // 4. Calculate financials
      const subtotalCents = items.reduce((acc, it) => acc + toCents(it.price) * it.quantity, 0)
      const taxCents = calculateTaxCents(subtotalCents, 0.0825)
      const totalCents = subtotalCents + taxCents

      const existingRounds = this.orders.filter((o) => o.guest_session_id === sessionId)
      const nextRoundNum = existingRounds.length + 1

      const newOrder: DbOrder = {
        id: `order-db-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        guest_session_id: sessionId,
        property_id: propertyId,
        location_id: locationId,
        round_number: nextRoundNum,
        idempotency_key: idempotencyKey || null,
        subtotal: toDollars(subtotalCents),
        tax: toDollars(taxCents),
        total: toDollars(totalCents),
        status: 'pending',
      }

      this.orders.push(newOrder)

      const currentTotal = this.sessionTotals.get(sessionId)!
      currentTotal.subtotal += newOrder.subtotal
      currentTotal.tax += newOrder.tax
      currentTotal.total += newOrder.total
      currentTotal.count += items.reduce((acc, it) => acc + it.quantity, 0)

      return {
        success: true,
        order_id: newOrder.id,
        round_number: nextRoundNum,
        round_total: newOrder.total,
        is_idempotent_replay: false,
      }
    } finally {
      this.sessionLocks.delete(sessionId)
    }
  }

  getOrders(sessionId: string) {
    return this.orders.filter((o) => o.guest_session_id === sessionId)
  }

  getTotal(sessionId: string) {
    return this.sessionTotals.get(sessionId)
  }
}

async function runAdversarialIdempotencyAudit() {
  console.log('\n======================================================')
  console.log('⚔️ ADVERSARIAL PRODUCTION IDEMPOTENCY AUDIT')
  console.log('======================================================\n')

  // ---------------------------------------------------------------------------
  // ATTACK 1: In-Memory Store Multi-Instance Split-Brain Test
  // ---------------------------------------------------------------------------
  console.log('--- Test 1: Multi-Instance Split-Brain Test (Instance A vs Instance B) ---')
  const instanceA = new SimulatedAppInstance('App-Container-A')
  const instanceB = new SimulatedAppInstance('App-Container-B')

  const testKey = 'idem-cross-instance-key-1001'
  const items = [{ menuItemId: 'item-1', name: 'Dumplings', price: 14.50, quantity: 1 }]

  // Step 1: Request 1 hits Instance A
  const req1 = instanceA.appendOrderInInstance('session-room-404-multi-inst', items, testKey)
  assert(!req1.isReplay, 'Instance A successfully processes initial order')
  assert(req1.session.rounds.length === 1, 'Instance A has 1 round')

  // Step 2: Request 2 (Retry/Double-click routed by load balancer to Instance B)
  const req2 = instanceB.appendOrderInInstance('session-room-404-multi-inst', items, testKey)

  console.log(`\n💥 IN-MEMORY FAILURE DEMONSTRATED:`)
  console.log(`- Instance A round ID: ${req1.newRound.id}`)
  console.log(`- Instance B round ID: ${req2.newRound.id}`)
  console.log(`- Instance B isReplay: ${req2.isReplay} (Expected true, but in-memory was false!)`)

  if (!req2.isReplay) {
    console.log(`⚠️ CRITICAL VULNERABILITY CONFIRMED: In-memory idempotencyStore is process-local and NOT shared between application instances. Retries hitting a different container produce duplicate orders!`)
  }

  // ---------------------------------------------------------------------------
  // ATTACK 2: Application Restart / Serverless Cold-Start Test
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 2: Application Restart / Cold Start Test ---')
  const restartInstance = new SimulatedAppInstance('App-Container-Restart')
  const restartKey = 'idem-restart-key-2002'

  // Request 1 commits
  const restartReq1 = restartInstance.appendOrderInInstance('session-room-404-multi-inst', items, restartKey)
  assert(!restartReq1.isReplay, 'Initial request committed')

  // Application restarts / Lambda cold starts
  restartInstance.restart()

  // Client retries with same idempotency key
  const restartReq2 = restartInstance.appendOrderInInstance('session-room-404-multi-inst', items, restartKey)
  console.log(`- Post-restart retry isReplay: ${restartReq2.isReplay}`)
  if (!restartReq2.isReplay) {
    console.log(`⚠️ CRITICAL VULNERABILITY CONFIRMED: In-memory idempotencyStore is NOT persistent. Server restart wipes idempotency history!`)
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Database-Level Authoritative Idempotency Test
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 3: PostgreSQL Database-Level Authoritative Idempotency ---')
  const db = new SimulatedPostgresDatabase()
  const dbSessionId = 'session-db-100'
  const dbKey = 'idem-authoritative-db-key-3003'

  // Concurrent execution contexts
  console.log('Dispatching 5 concurrent requests with identical idempotency key to database stored procedure...')
  const concurrentDbResults = await Promise.all([
    db.appendItemsToGuestTabProc(dbSessionId, 'loc-404', 'prop-red-chilly', [{ price: 14.50, quantity: 2 }], dbKey),
    db.appendItemsToGuestTabProc(dbSessionId, 'loc-404', 'prop-red-chilly', [{ price: 14.50, quantity: 2 }], dbKey),
    db.appendItemsToGuestTabProc(dbSessionId, 'loc-404', 'prop-red-chilly', [{ price: 14.50, quantity: 2 }], dbKey),
    db.appendItemsToGuestTabProc(dbSessionId, 'loc-404', 'prop-red-chilly', [{ price: 14.50, quantity: 2 }], dbKey),
    db.appendItemsToGuestTabProc(dbSessionId, 'loc-404', 'prop-red-chilly', [{ price: 14.50, quantity: 2 }], dbKey),
  ])

  const firstOrderId = concurrentDbResults[0].order_id
  const replayCount = concurrentDbResults.filter((r) => r.is_idempotent_replay).length
  const createdCount = concurrentDbResults.filter((r) => !r.is_idempotent_replay).length

  assert(createdCount === 1, 'Exactly 1 logical order created in database')
  assert(replayCount === 4, '4 concurrent requests received idempotent replay')
  assert(concurrentDbResults.every((r) => r.order_id === firstOrderId), 'All 5 callers received identical order_id')

  const dbOrders = db.getOrders(dbSessionId)
  assert(dbOrders.length === 1, 'Database orders table contains exactly 1 row')

  // ---------------------------------------------------------------------------
  // TEST 4: Lost-Response Recovery & Delayed Retry
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 4: Lost-Response Recovery & Delayed Retry ---')
  // Request 1 succeeded on DB, but response was lost over network.
  // Client retries 5 seconds later with same idempotency key:
  const delayedRetry = await db.appendItemsToGuestTabProc(
    dbSessionId,
    'loc-404',
    'prop-red-chilly',
    [{ price: 14.50, quantity: 2 }],
    dbKey
  )

  assert(delayedRetry.is_idempotent_replay, 'Delayed retry recognized as replay')
  assert(delayedRetry.order_id === firstOrderId, 'Delayed retry returned original order ID')
  assert(db.getOrders(dbSessionId).length === 1, 'Database row count remains exactly 1')

  // ---------------------------------------------------------------------------
  // TEST 5: Edge Case: Empty String `''` vs NULL Idempotency Key
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 5: Edge Case: Empty String vs NULL Idempotency Key ---')
  console.log('Testing whether empty string `""` idempotency keys trigger UNIQUE constraint collisions...')

  // Insert order with empty string key
  const emptyKey1 = await db.appendItemsToGuestTabProc(
    dbSessionId,
    'loc-404',
    'prop-red-chilly',
    [{ price: 10.00, quantity: 1 }],
    '' // Empty string
  )
  assert(emptyKey1.success, 'First order with empty string key created')

  // Insert second order with empty string key
  const emptyKey2 = await db.appendItemsToGuestTabProc(
    dbSessionId,
    'loc-404',
    'prop-red-chilly',
    [{ price: 20.00, quantity: 1 }],
    '' // Empty string
  )
  assert(emptyKey2.success, 'Second order with empty string key created without collision')

  console.log('\n======================================================')
  console.log('📊 IDEMPOTENCY AUDIT SUMMARY COMPLETED')
  console.log('======================================================\n')
}

runAdversarialIdempotencyAudit().catch(console.error)
