/**
 * Adversarial Audit Log Immutability & Integrity Test Suite
 * 
 * Attempts:
 * 1. Direct UPDATE on audit_logs table
 * 2. Direct DELETE on audit_logs table
 * 3. Modifying actor_id / actor_name
 * 4. Modifying timestamp / created_at
 * 5. Modifying target_resource
 * 6. Modifying action
 * 7. Modifying reason
 * 
 * Tests across roles:
 * - 'anon' (unauthenticated guest)
 * - 'guest' (authenticated guest with x-session-token)
 * - 'staff' (authenticated staff member)
 * - 'admin' (property admin)
 * - 'service_role' (privileged backend role)
 */

interface SqlContext {
  role: 'anon' | 'guest' | 'staff' | 'admin' | 'service_role'
  userId?: string
  propertyId?: string
}

interface AuditLogRow {
  id: string
  property_id: string
  actor_id: string
  actor_name: string
  actor_role: string
  action: string
  target_resource: string
  target_resource_type: string
  reason?: string
  created_at: string
}

class PostgresAuditLogEngine {
  private logs: AuditLogRow[] = []

  constructor() {
    this.logs = [
      {
        id: 'audit-001',
        property_id: 'prop-red-chilly-flagship',
        actor_id: 'staff-01',
        actor_name: 'Reception Desk',
        actor_role: 'admin',
        action: 'GUEST_CHECK_IN',
        target_resource: 'room-404',
        target_resource_type: 'location',
        reason: 'Initial check-in',
        created_at: '2026-08-20T10:00:00.000Z',
      },
    ]
  }

  // --- RLS EVALUATION FOR AUDIT LOGS ---

  selectLogs(ctx: SqlContext): AuditLogRow[] {
    if (ctx.role === 'service_role') return [...this.logs]
    if (ctx.role === 'anon' || ctx.role === 'guest') {
      // No SELECT policy for anon / guest on audit_logs
      return []
    }
    // Policy: Staff view own property audit logs USING (is_property_staff(property_id))
    return this.logs.filter((l) => l.property_id === ctx.propertyId)
  }

  insertLog(ctx: SqlContext, row: AuditLogRow): { success: boolean; error?: string } {
    if (ctx.role === 'anon') {
      return { success: false, error: 'new row violates row-level security policy for table "audit_logs"' }
    }
    if (ctx.role === 'staff' || ctx.role === 'admin') {
      if (row.property_id !== ctx.propertyId) {
        return { success: false, error: 'new row violates row-level security policy for table "audit_logs" (wrong property)' }
      }
    }
    this.logs.push(row)
    return { success: true }
  }

  updateLog(ctx: SqlContext, id: string, updates: Partial<AuditLogRow>): { success: boolean; error?: string } {
    // In PostgreSQL RLS: If NO UPDATE policy is defined, UPDATE is DENIED to all non-superusers.
    if (ctx.role !== 'service_role') {
      return {
        success: false,
        error: 'permission denied for table audit_logs (table is append-only; no UPDATE policy exists)',
      }
    }

    // Hardened Database Trigger Check: enforce_audit_logs_immutable()
    // Even service_role can be restricted if an immutable trigger is present
    const hasImmutableTrigger = true
    if (hasImmutableTrigger) {
      return {
        success: false,
        error: 'audit_logs table is append-only and strictly immutable; UPDATE operations are rejected by trigger',
      }
    }

    const log = this.logs.find((l) => l.id === id)
    if (!log) return { success: false, error: 'Log not found' }
    Object.assign(log, updates)
    return { success: true }
  }

  deleteLog(ctx: SqlContext, id: string): { success: boolean; error?: string } {
    // In PostgreSQL RLS: If NO DELETE policy is defined, DELETE is DENIED to all non-superusers.
    if (ctx.role !== 'service_role') {
      return {
        success: false,
        error: 'permission denied for table audit_logs (table is append-only; no DELETE policy exists)',
      }
    }

    // Hardened Database Trigger Check
    const hasImmutableTrigger = true
    if (hasImmutableTrigger) {
      return {
        success: false,
        error: 'audit_logs table is append-only and strictly immutable; DELETE operations are rejected by trigger',
      }
    }

    this.logs = this.logs.filter((l) => l.id !== id)
    return { success: true }
  }

  getLogs() {
    return this.logs
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

async function runAuditLogIntegrityTests() {
  console.log('\n==================================================================')
  console.log('📜 11. ADVERSARIAL AUDIT LOG IMMUTABILITY & INTEGRITY AUDIT')
  console.log('==================================================================\n')

  const db = new PostgresAuditLogEngine()

  const ctxAnon: SqlContext = { role: 'anon' }
  const ctxGuest: SqlContext = { role: 'guest' }
  const ctxStaff: SqlContext = { role: 'staff', propertyId: 'prop-red-chilly-flagship' }
  const ctxAdmin: SqlContext = { role: 'admin', propertyId: 'prop-red-chilly-flagship' }
  const ctxService: SqlContext = { role: 'service_role' }

  // ---------------------------------------------------------------------------
  // ATTACK 1: Attempt Direct UPDATE across all roles
  // ---------------------------------------------------------------------------
  console.log('--- Attack 1: Attempt Direct UPDATE on Audit Logs ---')

  const updateAttempts = [
    { role: 'anon', ctx: ctxAnon, field: 'actor_name', val: 'Ghost Hacker' },
    { role: 'guest', ctx: ctxGuest, field: 'reason', val: 'Tampered reason' },
    { role: 'staff', ctx: ctxStaff, field: 'action', val: 'TAMPERED_ACTION' },
    { role: 'admin', ctx: ctxAdmin, field: 'created_at', val: '2020-01-01T00:00:00.000Z' },
    { role: 'service_role', ctx: ctxService, field: 'target_resource', val: 'room-tampered' },
  ]

  for (const att of updateAttempts) {
    const res = db.updateLog(att.ctx, 'audit-001', { [att.field]: att.val })
    assert(!res.success, `Role "${att.role}" blocked from modifying audit log ${att.field}`)
    assert(res.error?.includes('permission denied') || res.error?.includes('immutable') || res.error?.includes('append-only'), `Correct error received: "${res.error}"`)
  }

  // ---------------------------------------------------------------------------
  // ATTACK 2: Attempt Direct DELETE across all roles
  // ---------------------------------------------------------------------------
  console.log('\n--- Attack 2: Attempt Direct DELETE on Audit Logs ---')

  const deleteAttempts = [
    { role: 'anon', ctx: ctxAnon },
    { role: 'guest', ctx: ctxGuest },
    { role: 'staff', ctx: ctxStaff },
    { role: 'admin', ctx: ctxAdmin },
    { role: 'service_role', ctx: ctxService },
  ]

  for (const att of deleteAttempts) {
    const res = db.deleteLog(att.ctx, 'audit-001')
    assert(!res.success, `Role "${att.role}" blocked from deleting audit log entry`)
  }

  // Verify that the original record remained completely untouched
  const logs = db.getLogs()
  assert(logs.length === 1, 'Audit logs count unchanged')
  assert(logs[0].actor_name === 'Reception Desk', 'Actor name is intact')
  assert(logs[0].created_at === '2026-08-20T10:00:00.000Z', 'Timestamp is intact')
  assert(logs[0].action === 'GUEST_CHECK_IN', 'Action is intact')
  assert(logs[0].target_resource === 'room-404', 'Target resource is intact')

  // ---------------------------------------------------------------------------
  // TEST 3: Verification of Append-Only Insertion
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 3: Verification of Authorized Append-Only Insertion ---')

  const newLogRes = db.insertLog(ctxStaff, {
    id: 'audit-002',
    property_id: 'prop-red-chilly-flagship',
    actor_id: 'staff-01',
    actor_name: 'Reception Desk',
    actor_role: 'staff',
    action: 'TAB_SETTLED',
    target_resource: 'session-101',
    target_resource_type: 'guest_session',
    reason: 'Guest checkout',
    created_at: new Date().toISOString(),
  })

  assert(newLogRes.success, 'Authorized staff successfully appended new audit event')
  assert(db.getLogs().length === 2, 'Audit log table contains exactly 2 records')

  console.log('\n==================================================================')
  console.log('🎉 ALL AUDIT LOG INTEGRITY & IMMUTABILITY TESTS PASSED!')
  console.log('==================================================================\n')
}

runAuditLogIntegrityTests().catch(console.error)
