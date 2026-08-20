/**
 * ============================================================================
 * ADVERSARIAL DATABASE CONCURRENCY & SETTLEMENT RACE STRESS TEST
 * ============================================================================
 * 
 * This script connects directly to a live Supabase PostgreSQL instance via
 * the service_role key and exercises the stored procedures under maximum
 * concurrent load to prove row-lock correctness.
 *
 * PHASE 1 — THE APPEND FLOOD:
 *   Fire 50 concurrent append_items_to_guest_tab RPCs at the exact same ms.
 *   Expected: All 50 serialize cleanly through SELECT ... FOR UPDATE.
 *   No deadlocks. No lost writes. No duplicate round numbers.
 *
 * PHASE 2 — THE SETTLEMENT RACE:
 *   Fire 50 concurrent appends + 1 settle_guest_tab simultaneously.
 *   Expected: The row lock is the absolute gatekeeper. Orders that acquire
 *   the lock BEFORE settlement succeed. Orders AFTER settlement hit AC001.
 *   The invoice total matches exactly the sum of successful appends.
 *
 * USAGE:
 *   Set environment variables in .env.local, then:
 *   npx tsx scripts/live-db-concurrency-race.ts
 * ============================================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || SUPABASE_URL.includes('your-project-id')) {
  console.error('❌ FATAL: NEXT_PUBLIC_SUPABASE_URL is not configured. Set real credentials in .env.local')
  process.exit(1)
}
if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.includes('your-service-role-key')) {
  console.error('❌ FATAL: SUPABASE_SERVICE_ROLE_KEY is not configured. Set real credentials in .env.local')
  process.exit(1)
}

function createServiceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`   ❌ FAILED: ${message}`)
    process.exitCode = 1
  } else {
    console.log(`   ✅ PASSED: ${message}`)
  }
}

interface AppendResult {
  index: number
  success: boolean
  orderId?: string
  roundNumber?: number
  roundTotal?: number
  tabTotal?: number
  isReplay?: boolean
  error?: string
  errorCode?: string
  durationMs: number
}

interface SettleResult {
  success: boolean
  invoiceNumber?: string
  totalAmount?: number
  alreadySettled?: boolean
  error?: string
  durationMs: number
}

// ── RPC Wrappers ────────────────────────────────────────────────────────────

async function rpcAppend(
  client: SupabaseClient,
  sessionId: string,
  locationId: string,
  menuItemId: string,
  quantity: number,
  idempotencyKey: string,
  index: number
): Promise<AppendResult> {
  const start = performance.now()
  try {
    const { data, error } = await client.rpc('append_items_to_guest_tab', {
      p_session_id: sessionId,
      p_location_id: locationId,
      p_items: JSON.stringify([{ menu_item_id: menuItemId, quantity }]),
      p_special_instructions: `Concurrent append #${index}`,
      p_idempotency_key: idempotencyKey,
    })

    const durationMs = Math.round(performance.now() - start)

    if (error) {
      // Extract PostgreSQL error code from message
      const codeMatch = error.message?.match(/AC\d{3}/)
      return {
        index,
        success: false,
        error: error.message,
        errorCode: codeMatch ? codeMatch[0] : undefined,
        durationMs,
      }
    }

    return {
      index,
      success: data?.success === true,
      orderId: data?.order_id,
      roundNumber: data?.round_number,
      roundTotal: data?.round_total ? Number(data.round_total) : undefined,
      tabTotal: data?.continuous_tab_total ? Number(data.continuous_tab_total) : undefined,
      isReplay: data?.is_idempotent_replay === true,
      durationMs,
    }
  } catch (err: unknown) {
    const durationMs = Math.round(performance.now() - start)
    const message = err instanceof Error ? err.message : String(err)
    return { index, success: false, error: message, durationMs }
  }
}

async function rpcSettle(
  client: SupabaseClient,
  sessionId: string,
  propertyId: string
): Promise<SettleResult> {
  const start = performance.now()
  try {
    const { data, error } = await client.rpc('settle_guest_tab', {
      p_session_id: sessionId,
      p_payment_method: 'room_folio',
      p_staff_note: 'Concurrency race test settlement',
      p_expected_property_id: propertyId,
    })

    const durationMs = Math.round(performance.now() - start)

    if (error) {
      return { success: false, error: error.message, durationMs }
    }

    return {
      success: data?.success === true,
      invoiceNumber: data?.invoice_number,
      totalAmount: data?.total_amount ? Number(data.total_amount) : undefined,
      alreadySettled: data?.already_settled === true,
      durationMs,
    }
  } catch (err: unknown) {
    const durationMs = Math.round(performance.now() - start)
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message, durationMs }
  }
}

// ── Test Fixture Setup & Teardown ───────────────────────────────────────────

async function setupTestFixture(client: SupabaseClient): Promise<{
  propertyId: string
  locationId: string
  sessionId: string
  menuItemId: string
  menuItemPrice: number
}> {
  console.log('\n🔧 Setting up test fixture...')

  // 1. Find or verify a property
  const { data: properties, error: propErr } = await client
    .from('properties')
    .select('id, name, tax_rate')
    .limit(1)
    .single()

  if (propErr || !properties) {
    console.error('❌ No properties found. Ensure the database is seeded.')
    process.exit(1)
  }

  const propertyId = properties.id
  console.log(`   Property: ${properties.name} (${propertyId})`)

  // 2. Find a menu item for this property
  const { data: menuItem, error: menuErr } = await client
    .from('menu_items')
    .select('id, name, price')
    .eq('property_id', propertyId)
    .eq('is_available', true)
    .limit(1)
    .single()

  if (menuErr || !menuItem) {
    console.error('❌ No available menu items found for property.')
    process.exit(1)
  }

  console.log(`   Menu Item: ${menuItem.name} @ $${menuItem.price} (${menuItem.id})`)

  // 3. Find a location for this property
  const { data: location, error: locErr } = await client
    .from('locations')
    .select('id, name, qr_code_identifier')
    .eq('property_id', propertyId)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (locErr || !location) {
    console.error('❌ No active locations found for property.')
    process.exit(1)
  }

  console.log(`   Location: ${location.name} (${location.id})`)

  // 4. Create a fresh test guest session
  const { data: session, error: sessErr } = await client
    .from('guest_sessions')
    .insert({
      property_id: propertyId,
      location_id: location.id,
      guest_name: 'Concurrency Stress Test Guest',
      status: 'active',
    })
    .select('id')
    .single()

  if (sessErr || !session) {
    console.error('❌ Failed to create test guest session:', sessErr?.message)
    process.exit(1)
  }

  console.log(`   Session: ${session.id} (status: active)`)

  return {
    propertyId,
    locationId: location.id,
    sessionId: session.id,
    menuItemId: menuItem.id,
    menuItemPrice: Number(menuItem.price),
  }
}

async function teardownTestFixture(client: SupabaseClient, sessionId: string): Promise<void> {
  // Note: We cannot delete settled sessions due to WORM triggers.
  // Mark as voided if still active, or leave settled for audit trail.
  const { data: session } = await client
    .from('guest_sessions')
    .select('status')
    .eq('id', sessionId)
    .single()

  if (session?.status === 'active') {
    await client
      .from('guest_sessions')
      .update({ status: 'voided' })
      .eq('id', sessionId)
  }

  console.log(`\n🧹 Teardown: Session ${sessionId} (status: ${session?.status ?? 'unknown'})`)
}

// ── PHASE 1: THE APPEND FLOOD ──────────────────────────────────────────────

async function runPhase1(
  client: SupabaseClient,
  fixture: Awaited<ReturnType<typeof setupTestFixture>>
): Promise<void> {
  console.log('\n' + '═'.repeat(70))
  console.log('⚡ PHASE 1: THE APPEND FLOOD — 50 Concurrent Order Appends')
  console.log('═'.repeat(70))

  const CONCURRENT_APPENDS = 50

  // Each request gets a UNIQUE idempotency key to ensure 50 distinct orders
  const appendPromises: Promise<AppendResult>[] = []
  for (let i = 0; i < CONCURRENT_APPENDS; i++) {
    appendPromises.push(
      rpcAppend(
        client,
        fixture.sessionId,
        fixture.locationId,
        fixture.menuItemId,
        1, // quantity
        `phase1-flood-${i}-${Date.now()}`, // unique key per request
        i
      )
    )
  }

  // Fire all 50 at the exact same instant
  const startTime = performance.now()
  const results = await Promise.all(appendPromises)
  const totalDuration = Math.round(performance.now() - startTime)

  // ── Analysis ──────────────────────────────────────────────────────────────
  const successful = results.filter((r) => r.success && !r.isReplay)
  const replays = results.filter((r) => r.success && r.isReplay)
  const failures = results.filter((r) => !r.success)
  const roundNumbers = successful.map((r) => r.roundNumber!).sort((a, b) => a - b)
  const uniqueRounds = new Set(roundNumbers)
  const uniqueOrderIds = new Set(successful.map((r) => r.orderId!))

  console.log(`\n   📊 Results (${totalDuration}ms total):`)
  console.log(`      Successful appends: ${successful.length}`)
  console.log(`      Idempotent replays: ${replays.length}`)
  console.log(`      Failures:           ${failures.length}`)
  console.log(`      Unique round #s:    ${uniqueRounds.size}`)
  console.log(`      Round range:        ${roundNumbers[0]} → ${roundNumbers[roundNumbers.length - 1]}`)

  if (failures.length > 0) {
    console.log(`\n   ⚠️  Failed requests:`)
    for (const f of failures.slice(0, 5)) {
      console.log(`      [#${f.index}] ${f.error} (${f.durationMs}ms)`)
    }
  }

  // Timing distribution
  const durations = results.map((r) => r.durationMs).sort((a, b) => a - b)
  console.log(`\n   ⏱️  Latency: min=${durations[0]}ms, median=${durations[Math.floor(durations.length / 2)]}ms, max=${durations[durations.length - 1]}ms`)

  // ── Assertions ────────────────────────────────────────────────────────────
  assert(successful.length === CONCURRENT_APPENDS, `All ${CONCURRENT_APPENDS} appends succeeded (got ${successful.length})`)
  assert(uniqueRounds.size === successful.length, `Every successful append got a unique round number (${uniqueRounds.size} unique / ${successful.length} successful)`)
  assert(uniqueOrderIds.size === successful.length, `Every successful append got a unique order ID`)
  assert(failures.length === 0, 'Zero failures during append flood')

  // Verify sequential round numbers (no gaps)
  if (roundNumbers.length > 1) {
    let isSequential = true
    for (let i = 1; i < roundNumbers.length; i++) {
      if (roundNumbers[i] !== roundNumbers[i - 1] + 1) {
        isSequential = false
        break
      }
    }
    assert(isSequential, `Round numbers are strictly sequential: ${roundNumbers[0]}..${roundNumbers[roundNumbers.length - 1]}`)
  }

  // ── Database State Verification ───────────────────────────────────────────
  console.log('\n   🔍 Verifying database state...')

  const { data: dbSession } = await client
    .from('guest_sessions')
    .select('subtotal, tax, total_amount, total_items_count, rounds_count, status')
    .eq('id', fixture.sessionId)
    .single()

  if (dbSession) {
    console.log(`      DB Session: status=${dbSession.status}, rounds=${dbSession.rounds_count}, items=${dbSession.total_items_count}, total=$${dbSession.total_amount}`)

    assert(dbSession.status === 'active', 'Session is still active after append flood')
    assert(dbSession.rounds_count === CONCURRENT_APPENDS, `rounds_count matches (${dbSession.rounds_count} === ${CONCURRENT_APPENDS})`)
    assert(dbSession.total_items_count === CONCURRENT_APPENDS, `total_items_count matches (${dbSession.total_items_count} === ${CONCURRENT_APPENDS})`)

    // Verify financial total: 50 items × price × (1 + tax_rate)
    const expectedSubtotal = Math.round(fixture.menuItemPrice * CONCURRENT_APPENDS * 100) / 100
    assert(
      Math.abs(Number(dbSession.subtotal) - expectedSubtotal) < 0.01,
      `Subtotal matches: $${dbSession.subtotal} ≈ $${expectedSubtotal}`
    )
  }

  // Count actual order rows
  const { count: orderCount } = await client
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('guest_session_id', fixture.sessionId)

  assert(orderCount === CONCURRENT_APPENDS, `Database has exactly ${CONCURRENT_APPENDS} order rows (got ${orderCount})`)

  // Count actual order_items rows
  const { data: orderIds } = await client
    .from('orders')
    .select('id')
    .eq('guest_session_id', fixture.sessionId)

  if (orderIds) {
    const { count: itemCount } = await client
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .in('order_id', orderIds.map((o) => o.id))

    assert(itemCount === CONCURRENT_APPENDS, `Database has exactly ${CONCURRENT_APPENDS} order_item rows (got ${itemCount})`)
  }
}

// ── PHASE 2: THE SETTLEMENT RACE ───────────────────────────────────────────

async function runPhase2(
  client: SupabaseClient,
  fixture: Awaited<ReturnType<typeof setupTestFixture>>
): Promise<void> {
  console.log('\n' + '═'.repeat(70))
  console.log('⚡ PHASE 2: THE SETTLEMENT RACE — 50 Appends + 1 Settle Simultaneously')
  console.log('═'.repeat(70))

  const CONCURRENT_APPENDS = 50

  // Build 50 append promises + 1 settle promise
  const appendPromises: Promise<AppendResult>[] = []
  for (let i = 0; i < CONCURRENT_APPENDS; i++) {
    appendPromises.push(
      rpcAppend(
        client,
        fixture.sessionId,
        fixture.locationId,
        fixture.menuItemId,
        1,
        `phase2-race-${i}-${Date.now()}`,
        i
      )
    )
  }

  const settlePromise = rpcSettle(client, fixture.sessionId, fixture.propertyId)

  // Fire ALL 51 requests at the exact same instant
  const startTime = performance.now()
  const [settleResult, ...appendResults] = await Promise.all([
    settlePromise,
    ...appendPromises,
  ])
  const totalDuration = Math.round(performance.now() - startTime)

  // ── Analysis ──────────────────────────────────────────────────────────────
  const appendsSucceeded = appendResults.filter((r) => r.success && !r.isReplay)
  const appendsRejected = appendResults.filter((r) => !r.success)
  const ac001Rejections = appendsRejected.filter((r) => r.errorCode === 'AC001' || r.error?.includes('settled'))

  console.log(`\n   📊 Results (${totalDuration}ms total):`)
  console.log(`      Settlement:      success=${settleResult.success}, invoice=${settleResult.invoiceNumber ?? 'N/A'}, total=$${settleResult.totalAmount ?? 'N/A'} (${settleResult.durationMs}ms)`)
  console.log(`      Appends won:     ${appendsSucceeded.length} (acquired lock BEFORE settlement)`)
  console.log(`      Appends rejected: ${appendsRejected.length} (acquired lock AFTER settlement → AC001)`)
  console.log(`      AC001 codes:     ${ac001Rejections.length}`)

  // ── Assertions ────────────────────────────────────────────────────────────
  assert(settleResult.success === true, 'Settlement succeeded')
  assert(!!settleResult.invoiceNumber, `Invoice number generated: ${settleResult.invoiceNumber}`)
  assert(
    appendsSucceeded.length + appendsRejected.length === CONCURRENT_APPENDS,
    `All ${CONCURRENT_APPENDS} appends accounted for (${appendsSucceeded.length} won + ${appendsRejected.length} rejected)`
  )
  assert(
    ac001Rejections.length === appendsRejected.length,
    `All rejected appends hit AC001 (settled tab), not deadlocks or crashes`
  )

  // ── CRITICAL INVARIANT: Invoice total = Phase 1 orders + Phase 2 pre-settlement orders ──
  console.log('\n   🔍 Verifying financial invariant...')

  const { data: dbSession } = await client
    .from('guest_sessions')
    .select('subtotal, tax, total_amount, total_items_count, rounds_count, status, invoice_number, invoice_checksum')
    .eq('id', fixture.sessionId)
    .single()

  if (dbSession) {
    console.log(`      DB Session: status=${dbSession.status}, rounds=${dbSession.rounds_count}, items=${dbSession.total_items_count}, total=$${dbSession.total_amount}`)
    console.log(`      Invoice: ${dbSession.invoice_number}`)
    console.log(`      Checksum: ${dbSession.invoice_checksum?.substring(0, 32)}...`)

    assert(dbSession.status === 'settled', 'Session status is "settled"')

    // Total rounds = Phase 1 (50) + Phase 2 pre-settlement wins
    const expectedTotalRounds = 50 + appendsSucceeded.length
    assert(
      dbSession.rounds_count === expectedTotalRounds,
      `rounds_count = Phase1(50) + Phase2(${appendsSucceeded.length}) = ${expectedTotalRounds} (got ${dbSession.rounds_count})`
    )

    // Financial verification: total = rounds × item_price × (1 + tax_rate)
    const totalOrdersProcessed = expectedTotalRounds
    const expectedSubtotal = Math.round(fixture.menuItemPrice * totalOrdersProcessed * 100) / 100
    assert(
      Math.abs(Number(dbSession.subtotal) - expectedSubtotal) < 0.01,
      `Subtotal exactly matches: $${dbSession.subtotal} ≈ $${expectedSubtotal} (${totalOrdersProcessed} items × $${fixture.menuItemPrice})`
    )

    // Verify the invoice total matches what settle_guest_tab returned
    if (settleResult.totalAmount !== undefined) {
      assert(
        Math.abs(Number(dbSession.total_amount) - settleResult.totalAmount) < 0.01,
        `DB total matches RPC return: $${dbSession.total_amount} ≈ $${settleResult.totalAmount}`
      )
    }
  }

  // Count all orders in DB
  const { count: totalOrders } = await client
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('guest_session_id', fixture.sessionId)

  const expectedOrders = 50 + appendsSucceeded.length
  assert(
    totalOrders === expectedOrders,
    `Total order rows in DB: ${totalOrders} === ${expectedOrders} (Phase1: 50, Phase2 wins: ${appendsSucceeded.length})`
  )

  // ── WORM Trigger Verification ─────────────────────────────────────────────
  console.log('\n   🔒 Verifying WORM trigger enforcement...')

  // Attempt to mutate a settled session's financial data
  const { error: updateErr } = await client
    .from('guest_sessions')
    .update({ total_amount: 0 })
    .eq('id', fixture.sessionId)

  assert(
    !!updateErr,
    `WORM: UPDATE guest_sessions.total_amount on settled session rejected: ${updateErr?.message?.substring(0, 80) ?? 'NO ERROR (VULNERABILITY!)'}`
  )

  // Attempt to delete an order item from settled session
  if (totalOrders && totalOrders > 0) {
    const { data: firstOrder } = await client
      .from('orders')
      .select('id')
      .eq('guest_session_id', fixture.sessionId)
      .limit(1)
      .single()

    if (firstOrder) {
      const { data: firstItem } = await client
        .from('order_items')
        .select('id')
        .eq('order_id', firstOrder.id)
        .limit(1)
        .single()

      if (firstItem) {
        const { error: deleteErr } = await client
          .from('order_items')
          .delete()
          .eq('id', firstItem.id)

        assert(
          !!deleteErr,
          `WORM: DELETE order_item on settled session rejected: ${deleteErr?.message?.substring(0, 80) ?? 'NO ERROR (VULNERABILITY!)'}`
        )
      }
    }
  }
}

// ── MAIN ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════════════╗')
  console.log('║  ADVERSARIAL DATABASE CONCURRENCY & SETTLEMENT RACE STRESS TEST    ║')
  console.log('║  Target: Live Supabase PostgreSQL via service_role RPC             ║')
  console.log('╚══════════════════════════════════════════════════════════════════════╝')
  console.log(`\n   Database: ${SUPABASE_URL}`)
  console.log(`   Time:     ${new Date().toISOString()}`)

  const client = createServiceClient()
  const fixture = await setupTestFixture(client)

  try {
    await runPhase1(client, fixture)
    await runPhase2(client, fixture)
  } finally {
    await teardownTestFixture(client, fixture.sessionId)
  }

  console.log('\n' + '═'.repeat(70))
  if (process.exitCode === 1) {
    console.log('💀 SOME TESTS FAILED — SEE ABOVE')
  } else {
    console.log('🎉 ALL CONCURRENCY & SETTLEMENT RACE TESTS PASSED')
  }
  console.log('═'.repeat(70) + '\n')
}

main().catch((err) => {
  console.error('💀 Unhandled fatal error:', err)
  process.exit(1)
})
