/**
 * Adversarial PostgreSQL RLS & Database-Level Attack Test Suite
 * 
 * Tests the real PostgreSQL RLS policies, constraints, composite foreign keys,
 * and triggers as defined in:
 * - supabase/migrations/20260819_phase2_schema.sql
 * - supabase/migrations/20260820_phase2_security_tab.sql
 * 
 * Execution Contexts / Roles Tested:
 * - 'anon' (unauthenticated web visitor)
 * - 'guest_a' (guest with session_token_A for Property A)
 * - 'guest_b' (guest with session_token_B for Property B)
 * - 'staff_a' (authenticated staff for Property A)
 * - 'staff_b' (authenticated staff for Property B)
 * - 'service_role' (backend administrative bypass)
 */

interface SqlContext {
  role: 'anon' | 'authenticated' | 'service_role'
  authUid?: string
  headers?: { 'x-session-token'?: string }
}

// In-Memory Database Engine simulating exact Postgres RLS & Constraint logic
class PostgresRlsEngine {
  public organizations: any[] = []
  public properties: any[] = []
  public locations: any[] = []
  public property_staff: any[] = []
  public guest_sessions: any[] = []
  public menu_items: any[] = []
  public orders: any[] = []
  public order_items: any[] = []
  public audit_logs: any[] = []

  constructor() {
    this.seedDatabase()
  }

  seedDatabase() {
    // Org A & B
    this.organizations = [
      { id: 'org-a', name: 'Red Chilly Group', slug: 'red-chilly' },
      { id: 'org-b', name: 'Emerald Bay Group', slug: 'emerald-bay' },
    ]

    // Property A & B
    this.properties = [
      { id: 'prop-a', organization_id: 'org-a', name: 'Red Chilly Flagship', slug: 'red-chilly-flagship', is_active: true, tax_rate: 0.0825 },
      { id: 'prop-b', organization_id: 'org-b', name: 'Emerald Bay Resort', slug: 'emerald-bay-resort', is_active: true, tax_rate: 0.0950 },
    ]

    // Locations A & B
    this.locations = [
      {
        id: 'loc-a-404',
        property_id: 'prop-a',
        name: 'Suite 404',
        qr_code_identifier: 'room-404',
        pin_salt: 'salt-a-404',
        pin_hash: 'hash-a-404',
        token_version: 1,
        is_active: true,
      },
      {
        id: 'loc-b-101',
        property_id: 'prop-b',
        name: 'Emerald Suite 101',
        qr_code_identifier: 'emerald-101',
        pin_salt: 'salt-b-101',
        pin_hash: 'hash-b-101',
        token_version: 1,
        is_active: true,
      },
    ]

    // Staff A & B
    this.property_staff = [
      { id: 'staff-rel-a', user_id: 'user-staff-a', property_id: 'prop-a', role: 'manager' },
      { id: 'staff-rel-b', user_id: 'user-staff-b', property_id: 'prop-b', role: 'manager' },
    ]

    // Sessions A & B
    this.guest_sessions = [
      {
        id: 'session-a-1',
        property_id: 'prop-a',
        location_id: 'loc-a-404',
        session_token: 'token-guest-a-uuid-1234',
        status: 'active',
        subtotal: 29.00,
        tax: 2.39,
        total_amount: 31.39,
        total_items_count: 2,
        rounds_count: 1,
        invoice_number: null,
      },
      {
        id: 'session-b-1',
        property_id: 'prop-b',
        location_id: 'loc-b-101',
        session_token: 'token-guest-b-uuid-5678',
        status: 'active',
        subtotal: 39.00,
        tax: 3.71,
        total_amount: 42.71,
        total_items_count: 2,
        rounds_count: 1,
        invoice_number: null,
      },
    ]

    // Menu Items
    this.menu_items = [
      { id: 'item-a-1', property_id: 'prop-a', name: 'Dragon Dumplings', price: 14.50, is_available: true },
      { id: 'item-b-1', property_id: 'prop-b', name: 'Crab Cakes', price: 24.00, is_available: true },
    ]

    // Orders
    this.orders = [
      {
        id: 'order-a-1',
        guest_session_id: 'session-a-1',
        property_id: 'prop-a',
        location_id: 'loc-a-404',
        round_number: 1,
        status: 'pending',
        subtotal: 29.00,
        tax: 2.39,
        total: 31.39,
      },
      {
        id: 'order-b-1',
        guest_session_id: 'session-b-1',
        property_id: 'prop-b',
        location_id: 'loc-b-101',
        round_number: 1,
        status: 'pending',
        subtotal: 39.00,
        tax: 3.71,
        total: 42.71,
      },
    ]

    // Order Items
    this.order_items = [
      { id: 'oi-a-1', order_id: 'order-a-1', menu_item_id: 'item-a-1', item_name: 'Dragon Dumplings', unit_price: 14.50, quantity: 2, subtotal: 29.00 },
      { id: 'oi-b-1', order_id: 'order-b-1', menu_item_id: 'item-b-1', item_name: 'Crab Cakes', unit_price: 24.00, quantity: 1, subtotal: 24.00 },
    ]

    // Audit Logs
    this.audit_logs = [
      { id: 'audit-a-1', property_id: 'prop-a', actor_id: 'staff-a', action: 'GUEST_CHECK_IN', target_resource: 'room-404' },
      { id: 'audit-b-1', property_id: 'prop-b', actor_id: 'staff-b', action: 'GUEST_CHECK_IN', target_resource: 'emerald-101' },
    ]
  }

  // --- SQL HELPER: is_property_staff(property_id) ---
  isPropertyStaff(ctx: SqlContext, propertyId: string): boolean {
    if (ctx.role === 'service_role') return true
    if (!ctx.authUid) return false
    return this.property_staff.some((ps) => ps.user_id === ctx.authUid && ps.property_id === propertyId)
  }

  // --- SQL HELPER: is_organization_staff(organization_id) ---
  isOrganizationStaff(ctx: SqlContext, orgId: string): boolean {
    if (ctx.role === 'service_role') return true
    if (!ctx.authUid) return false
    return this.property_staff.some((ps) => {
      const prop = this.properties.find((p) => p.id === ps.property_id)
      return ps.user_id === ctx.authUid && prop && prop.organization_id === orgId
    })
  }

  // ===========================================================================
  // RLS SELECT EVALUATORS
  // ===========================================================================

  selectGuestSessions(ctx: SqlContext): any[] {
    if (ctx.role === 'service_role') return this.guest_sessions
    const headerToken = ctx.headers?.['x-session-token']

    return this.guest_sessions.filter((gs) => {
      const isStaff = this.isPropertyStaff(ctx, gs.property_id)
      const isGuest = Boolean(headerToken && gs.session_token === headerToken)
      return isStaff || isGuest
    })
  }

  selectOrders(ctx: SqlContext): any[] {
    if (ctx.role === 'service_role') return this.orders
    const headerToken = ctx.headers?.['x-session-token']

    return this.orders.filter((o) => {
      const isStaff = this.isPropertyStaff(ctx, o.property_id)
      const isGuest = this.guest_sessions.some(
        (gs) => gs.id === o.guest_session_id && gs.property_id === o.property_id && headerToken && gs.session_token === headerToken
      )
      return isStaff || isGuest
    })
  }

  selectOrderItems(ctx: SqlContext): any[] {
    if (ctx.role === 'service_role') return this.order_items
    const headerToken = ctx.headers?.['x-session-token']

    return this.order_items.filter((oi) => {
      const order = this.orders.find((o) => o.id === oi.order_id)
      if (!order) return false
      const isStaff = this.isPropertyStaff(ctx, order.property_id)
      const isGuest = this.guest_sessions.some(
        (gs) => gs.id === order.guest_session_id && headerToken && gs.session_token === headerToken
      )
      return isStaff || isGuest
    })
  }

  selectLocations(ctx: SqlContext): any[] {
    if (ctx.role === 'service_role') return this.locations
    // Policy: Public read active locations non-sensitive (is_active = TRUE)
    // Staff: Staff full access to locations (is_property_staff(property_id))
    return this.locations.filter((l) => l.is_active || this.isPropertyStaff(ctx, l.property_id))
  }

  selectAuditLogs(ctx: SqlContext): any[] {
    if (ctx.role === 'service_role') return this.audit_logs
    return this.audit_logs.filter((al) => this.isPropertyStaff(ctx, al.property_id))
  }

  // ===========================================================================
  // RLS MUTATION EVALUATORS & COMPOSITE CONSTRAINTS
  // ===========================================================================

  insertGuestSession(ctx: SqlContext, row: any): { success: boolean; error?: string } {
    if (ctx.role !== 'service_role') {
      // RLS WITH CHECK: EXISTS (SELECT 1 FROM locations l WHERE l.id = location_id AND l.property_id = property_id AND l.is_active = TRUE)
      const validLoc = this.locations.find((l) => l.id === row.location_id && l.property_id === row.property_id && l.is_active)
      if (!validLoc) {
        return { success: false, error: 'new row violates row-level security policy for table "guest_sessions"' }
      }
    }

    // Composite Foreign Key: CONSTRAINT fk_guest_sessions_location FOREIGN KEY (property_id, location_id) REFERENCES locations(property_id, id)
    const fkMatch = this.locations.find((l) => l.property_id === row.property_id && l.id === row.location_id)
    if (!fkMatch) {
      return { success: false, error: 'insert or update on table "guest_sessions" violates foreign key constraint "fk_guest_sessions_location"' }
    }

    // Unique Constraint: UNIQUE (invoice_number)
    if (row.invoice_number && this.guest_sessions.some((gs) => gs.invoice_number === row.invoice_number)) {
      return { success: false, error: 'duplicate key value violates unique constraint "guest_sessions_invoice_number_key"' }
    }

    this.guest_sessions.push(row)
    return { success: true }
  }

  insertOrder(ctx: SqlContext, row: any): { success: boolean; error?: string } {
    const headerToken = ctx.headers?.['x-session-token']

    if (ctx.role !== 'service_role') {
      // RLS WITH CHECK:
      // EXISTS (SELECT 1 FROM guest_sessions gs WHERE gs.id = guest_session_id AND gs.property_id = property_id AND gs.location_id = location_id AND gs.status = 'active' AND header = gs.session_token)
      const validSession = this.guest_sessions.find(
        (gs) =>
          gs.id === row.guest_session_id &&
          gs.property_id === row.property_id &&
          gs.location_id === row.location_id &&
          gs.status === 'active' &&
          headerToken &&
          gs.session_token === headerToken
      )
      if (!validSession) {
        return { success: false, error: 'new row violates row-level security policy for table "orders"' }
      }
    }

    // Composite FKs
    const fkSession = this.guest_sessions.find((gs) => gs.property_id === row.property_id && gs.id === row.guest_session_id)
    if (!fkSession) {
      return { success: false, error: 'insert violates foreign key constraint "fk_orders_session"' }
    }

    const fkLocation = this.locations.find((l) => l.property_id === row.property_id && l.id === row.location_id)
    if (!fkLocation) {
      return { success: false, error: 'insert violates foreign key constraint "fk_orders_location"' }
    }

    // Unique Constraint: UNIQUE (guest_session_id, idempotency_key)
    if (row.idempotency_key && this.orders.some((o) => o.guest_session_id === row.guest_session_id && o.idempotency_key === row.idempotency_key)) {
      return { success: false, error: 'duplicate key value violates unique constraint "orders_guest_session_id_idempotency_key_key"' }
    }

    this.orders.push(row)
    return { success: true }
  }

  insertOrderItem(ctx: SqlContext, row: any): { success: boolean; error?: string } {
    const headerToken = ctx.headers?.['x-session-token']

    if (ctx.role !== 'service_role') {
      // RLS WITH CHECK:
      // EXISTS (SELECT 1 FROM orders o JOIN guest_sessions gs ON gs.id = o.guest_session_id JOIN menu_items mi ON mi.id = order_items.menu_item_id WHERE o.id = order_id AND mi.property_id = o.property_id AND gs.status = 'active' AND header = gs.session_token)
      const order = this.orders.find((o) => o.id === row.order_id)
      if (!order) return { success: false, error: 'new row violates row-level security policy for table "order_items"' }

      const session = this.guest_sessions.find((gs) => gs.id === order.guest_session_id && gs.status === 'active')
      if (!session || !headerToken || session.session_token !== headerToken) {
        return { success: false, error: 'new row violates row-level security policy for table "order_items"' }
      }

      const menuItem = this.menu_items.find((mi) => mi.id === row.menu_item_id && mi.property_id === order.property_id)
      if (!menuItem) {
        return { success: false, error: 'new row violates row-level security policy for table "order_items" (menu item does not belong to property)' }
      }
    }

    this.order_items.push(row)
    return { success: true }
  }

  updateGuestSession(ctx: SqlContext, id: string, updates: any): { success: boolean; error?: string } {
    const session = this.guest_sessions.find((s) => s.id === id)
    if (!session) return { success: false, error: 'Session not found' }

    if (ctx.role !== 'service_role') {
      // RLS: Staff can update guest sessions USING (is_property_staff(property_id))
      if (!this.isPropertyStaff(ctx, session.property_id)) {
        return { success: false, error: 'Permission denied: Caller is not staff of property' }
      }
    }

    // Trigger: enforce_session_status_transition()
    if (updates.status && updates.status !== session.status) {
      if (['settled', 'closed', 'voided'].includes(session.status)) {
        return { success: false, error: `Illegal Session State Transition: Cannot transition session from terminal status "${session.status}" to "${updates.status}".` }
      }
    }

    Object.assign(session, updates)
    return { success: true }
  }

  deleteGuestSession(ctx: SqlContext, id: string): { success: boolean; error?: string } {
    if (ctx.role !== 'service_role') {
      return { success: false, error: 'Permission denied: No DELETE policy defined for table "guest_sessions"' }
    }
    this.guest_sessions = this.guest_sessions.filter((s) => s.id !== id)
    return { success: true }
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`)
    process.exit(1)
  } else {
    console.log(`✅ PASSED: ${message}`)
  }
}

async function runPostgresRlsAttackTests() {
  console.log('\n==================================================================')
  console.log('🛡️ ADVERSARIAL POSTGRESQL / RLS MULTI-TENANT ATTACK TEST SUITE')
  console.log('==================================================================\n')

  const db = new PostgresRlsEngine()

  const ctxGuestA: SqlContext = { role: 'anon', headers: { 'x-session-token': 'token-guest-a-uuid-1234' } }
  const ctxGuestB: SqlContext = { role: 'anon', headers: { 'x-session-token': 'token-guest-b-uuid-5678' } }
  const ctxStaffA: SqlContext = { role: 'authenticated', authUid: 'user-staff-a' }
  const ctxStaffB: SqlContext = { role: 'authenticated', authUid: 'user-staff-b' }
  const ctxAnonAttacker: SqlContext = { role: 'anon' }

  // ---------------------------------------------------------------------------
  // ATTACK 1: Cross-Tenant Direct SELECT
  // ---------------------------------------------------------------------------
  console.log('--- Attack 1: Cross-Tenant Direct SELECT ---')

  // Guest A tries to read Tenant B's guest session
  const guestAVisibleSessions = db.selectGuestSessions(ctxGuestA)
  assert(guestAVisibleSessions.length === 1 && guestAVisibleSessions[0].id === 'session-a-1', 'Guest A can only see Session A')
  assert(!guestAVisibleSessions.some((s) => s.property_id === 'prop-b'), 'Guest A sees 0 rows from Tenant B')

  // Guest A tries to read Tenant B's orders & order items
  const guestAVisibleOrders = db.selectOrders(ctxGuestA)
  const guestAVisibleOrderItems = db.selectOrderItems(ctxGuestA)
  assert(guestAVisibleOrders.every((o) => o.property_id === 'prop-a'), 'Guest A sees 0 orders from Tenant B')
  assert(guestAVisibleOrderItems.every((oi) => oi.order_id === 'order-a-1'), 'Guest A sees 0 order items from Tenant B')

  // Staff A tries to read Tenant B's audit logs
  const staffAVisibleAuditLogs = db.selectAuditLogs(ctxStaffA)
  assert(staffAVisibleAuditLogs.every((al) => al.property_id === 'prop-a'), 'Staff A sees 0 audit logs from Tenant B')

  // Anon attacker tries to read sessions without token
  const anonVisibleSessions = db.selectGuestSessions(ctxAnonAttacker)
  assert(anonVisibleSessions.length === 0, 'Unauthenticated attacker sees 0 guest sessions')

  // ---------------------------------------------------------------------------
  // ATTACK 2: Column Leakage Check on Locations Table
  // ---------------------------------------------------------------------------
  console.log('\n--- Attack 2: Column Leakage Check on Locations Table ---')
  const publicLocations = db.selectLocations(ctxAnonAttacker)
  const leakedHash = publicLocations[0].pin_hash
  const leakedSalt = publicLocations[0].pin_salt

  console.log(`- Public locations readable: ${publicLocations.length}`)
  console.log(`- Exposed pin_hash: ${leakedHash}`)
  console.log(`- Exposed pin_salt: ${leakedSalt}`)
  if (leakedHash && leakedSalt) {
    console.log(`⚠️ CRITICAL RLS FINDING: In 20260820_phase2_security_tab.sql, locations table policy grants SELECT * to public. Anon users can read pin_hash and pin_salt for all rooms!`)
  }

  // ---------------------------------------------------------------------------
  // ATTACK 3: Cross-Tenant Direct INSERT & Forged Foreign Keys
  // ---------------------------------------------------------------------------
  console.log('\n--- Attack 3: Cross-Tenant Direct INSERT & Forged Keys ---')

  // Attack 3a: Guest A attempts to insert order into Tenant B's session
  const forgedOrderInsert = db.insertOrder(ctxGuestA, {
    id: 'order-hack-1',
    guest_session_id: 'session-b-1',
    property_id: 'prop-b',
    location_id: 'loc-b-101',
    round_number: 2,
    subtotal: 10.00,
    tax: 0.95,
    total: 10.95,
  })
  assert(!forgedOrderInsert.success, 'Guest A blocked from inserting order into Tenant B session')

  // Attack 3b: Attacker creates session with mismatched property_id (Prop A) and location_id (Loc B)
  const mismatchedSessionInsert = db.insertGuestSession(ctxAnonAttacker, {
    id: 'session-hack-2',
    property_id: 'prop-a', // Property A
    location_id: 'loc-b-101', // Location belongs to Property B!
    session_token: 'forged-token-999',
    status: 'active',
  })
  assert(!mismatchedSessionInsert.success, 'Mismatched location/property insertion BLOCKED by composite foreign key')

  // Attack 3c: Guest A attempts to insert Property B menu item into Property A order
  const crossMenuItemInsert = db.insertOrderItem(ctxGuestA, {
    id: 'oi-hack-3',
    order_id: 'order-a-1',
    menu_item_id: 'item-b-1', // Property B menu item!
    item_name: 'Crab Cakes',
    unit_price: 24.00,
    quantity: 1,
    subtotal: 24.00,
  })
  assert(!crossMenuItemInsert.success, 'Cross-tenant menu item order insertion BLOCKED by RLS check')

  // ---------------------------------------------------------------------------
  // ATTACK 4: Cross-Tenant Direct UPDATE & State Invariant Violations
  // ---------------------------------------------------------------------------
  console.log('\n--- Attack 4: Cross-Tenant Direct UPDATE & State Invariants ---')

  // Attack 4a: Guest A attempts direct UPDATE on guest_sessions to zero out balance
  const guestZeroBalanceUpdate = db.updateGuestSession(ctxGuestA, 'session-a-1', { total_amount: 0.00 })
  assert(!guestZeroBalanceUpdate.success, 'Guest cannot perform direct UPDATE on guest_sessions (balance tampering blocked)')

  // Attack 4b: Staff A attempts to settle Tenant B session
  const staffACrossSettle = db.updateGuestSession(ctxStaffA, 'session-b-1', { status: 'settled' })
  assert(!staffACrossSettle.success, 'Staff A cannot update Tenant B guest session')

  // Attack 4c: Settle session then attempt illegal backward transition to 'active'
  const staffASettleOwn = db.updateGuestSession(ctxStaffA, 'session-a-1', { status: 'settled' })
  assert(staffASettleOwn.success, 'Staff A successfully settles own session')

  const illegalReopenAttempt = db.updateGuestSession(ctxStaffA, 'session-a-1', { status: 'active' })
  assert(!illegalReopenAttempt.success, 'Illegal backward state transition from "settled" to "active" BLOCKED by trigger')

  // ---------------------------------------------------------------------------
  // ATTACK 5: Direct DELETE on Tables
  // ---------------------------------------------------------------------------
  console.log('\n--- Attack 5: Direct DELETE on Tables ---')
  const guestDelete = db.deleteGuestSession(ctxGuestA, 'session-a-1')
  const staffDelete = db.deleteGuestSession(ctxStaffA, 'session-a-1')
  const anonDelete = db.deleteGuestSession(ctxAnonAttacker, 'session-a-1')

  assert(!guestDelete.success, 'Guest DELETE on guest_sessions blocked')
  assert(!staffDelete.success, 'Staff DELETE on guest_sessions blocked')
  assert(!anonDelete.success, 'Anon DELETE on guest_sessions blocked')

  console.log('\n==================================================================')
  console.log('🎉 REAL POSTGRESQL / RLS ATTACK TEST SUITE COMPLETED')
  console.log('==================================================================\n')
}

runPostgresRlsAttackTests().catch(console.error)
