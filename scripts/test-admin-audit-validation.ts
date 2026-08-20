/**
 * Admin Authorization, Audit Logging & Runtime Input Validation Test Suite
 */

import {
  VerifyPinSchema,
  AppendOrderSchema,
  CheckInGuestSchema,
  VoidItemSchema,
  SettleTabSchema,
} from '../src/lib/validation/schemas'
import { auditLogger } from '../src/lib/logging/audit-logger'
import { tabManager } from '../src/lib/data/restaurant-data'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`)
    process.exit(1)
  } else {
    console.log(`✅ PASSED: ${message}`)
  }
}

async function runAdminAuditValidationTests() {
  console.log('\n==================================================================')
  console.log('🛡️ RUNNING ADMIN AUTHORIZATION, AUDIT LOGGING & RUNTIME VALIDATION')
  console.log('==================================================================\n')

  // ---------------------------------------------------------------------------
  // TEST 1: Runtime Zod Input Validation (Rejection of Malformed / Hostile Input)
  // ---------------------------------------------------------------------------
  console.log('--- Test 1: Runtime Input Validation (Zod Schemas) ---')

  // 1a. Stay PIN Validation
  const validPin = VerifyPinSchema.safeParse({ locationIdentifier: 'room-404', pin: '1234' })
  assert(validPin.success, 'Valid PIN and location accepted')

  const shortPin = VerifyPinSchema.safeParse({ locationIdentifier: 'room-404', pin: '12' })
  assert(!shortPin.success, 'Short PIN (2 digits) rejected')

  const alphaPin = VerifyPinSchema.safeParse({ locationIdentifier: 'room-404', pin: 'abcd' })
  assert(!alphaPin.success, 'Alphabetical PIN rejected')

  const sqlInjLocation = VerifyPinSchema.safeParse({ locationIdentifier: 'room-404; DROP TABLE locations;--', pin: '1234' })
  assert(!sqlInjLocation.success, 'SQL injection characters in location rejected')

  // 1b. Order Append Validation
  const validOrder = AppendOrderSchema.safeParse({
    items: [{ menuItemId: 'item-1', quantity: 2, notes: 'No cilantro' }],
    specialInstructions: 'Deliver hot',
  })
  assert(validOrder.success, 'Valid order items accepted')

  const zeroQtyOrder = AppendOrderSchema.safeParse({
    items: [{ menuItemId: 'item-1', quantity: 0 }],
  })
  assert(!zeroQtyOrder.success, 'Zero quantity rejected')

  const negativeQtyOrder = AppendOrderSchema.safeParse({
    items: [{ menuItemId: 'item-1', quantity: -3 }],
  })
  assert(!negativeQtyOrder.success, 'Negative quantity rejected')

  const absurdQtyOrder = AppendOrderSchema.safeParse({
    items: [{ menuItemId: 'item-1', quantity: 9999 }],
  })
  assert(!absurdQtyOrder.success, 'Absurd quantity (> 50) rejected')

  const oversizedNoteOrder = AppendOrderSchema.safeParse({
    items: [{ menuItemId: 'item-1', quantity: 1, notes: 'A'.repeat(300) }],
  })
  assert(!oversizedNoteOrder.success, 'Oversized item note (> 200 chars) rejected')

  // 1c. Payment Method Enum Validation
  const validSettle = SettleTabSchema.safeParse({
    sessionId: 'session-123',
    paymentMethod: 'room_folio',
  })
  assert(validSettle.success, 'Valid payment method (room_folio) accepted')

  const invalidSettleEnum = SettleTabSchema.safeParse({
    sessionId: 'session-123',
    paymentMethod: 'bitcoin',
  })
  assert(!invalidSettleEnum.success, 'Invalid payment method (bitcoin) rejected')

  // ---------------------------------------------------------------------------
  // TEST 2: Admin Authorization & Horizontal Multi-Tenant Enforcement
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 2: Admin Authorization & Multi-Tenant Scoping ---')

  const propA = 'prop-red-chilly-flagship'
  const propB = 'prop-emerald-bay-resort'

  // Staff A attempts check-in on Tenant B room
  let crossCheckInBlocked = false
  try {
    tabManager.checkInGuest('emerald-101', 'Attacker Guest', '9999', propA)
  } catch (err: any) {
    crossCheckInBlocked = true
    assert(err.message.includes('Tenant Isolation Violation'), 'Staff A cannot check-in Tenant B room')
  }
  assert(crossCheckInBlocked, 'Cross-tenant check-in rejected')

  // Staff A attempts to void item on Tenant B session
  const tenantBSession = tabManager.getAllSessions().find((s) => s.propertyId === propB)!
  let crossVoidBlocked = false
  try {
    const round = tenantBSession.rounds[0]
    const item = round.items[0]
    tabManager.voidOrderItem(tenantBSession.id, round.id, item.id, 'Malicious void', propA)
  } catch (err: any) {
    crossVoidBlocked = true
    assert(err.message.includes('Tenant Isolation Violation'), 'Staff A cannot void items from Tenant B tab')
  }
  assert(crossVoidBlocked, 'Cross-tenant void rejected')

  // Staff A attempts to settle Tenant B session
  let crossSettleBlocked = false
  try {
    tabManager.settleAndCloseTab(tenantBSession.id, 'room_folio', 'Malicious settle', propA)
  } catch (err: any) {
    crossSettleBlocked = true
    assert(err.message.includes('Tenant Isolation Violation'), 'Staff A cannot settle Tenant B tab')
  }
  assert(crossSettleBlocked, 'Cross-tenant settlement rejected')

  // ---------------------------------------------------------------------------
  // TEST 3: Immutable Audit Trail Logging
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 3: Immutable Audit Trail Logging ---')

  // Log a simulated sensitive check-in action
  const checkInEvent = auditLogger.logEvent({
    actorId: 'staff-red-chilly-01',
    actorName: 'Red Chilly Reception',
    actorRole: 'admin',
    propertyId: propA,
    action: 'GUEST_CHECK_IN',
    targetResource: 'room-404',
    targetResourceType: 'location',
    reason: 'Guest check-in at front desk',
    newState: { guestName: 'Alice Johnson', tokenVersion: 2 },
  })

  assert(checkInEvent.id.startsWith('audit-'), 'Audit record generated unique audit ID')
  assert(Boolean(checkInEvent.timestamp), 'Audit record has timestamp')

  // Log a simulated item void action
  const voidEvent = auditLogger.logEvent({
    actorId: 'staff-red-chilly-01',
    actorName: 'Red Chilly Reception',
    actorRole: 'admin',
    propertyId: propA,
    action: 'ITEM_VOID',
    targetResource: 'round-1:item-2',
    targetResourceType: 'order_item',
    reason: 'Kitchen 86-ed dragon dumplings',
  })

  assert(voidEvent.action === 'ITEM_VOID', 'Void event recorded')
  assert(voidEvent.reason === 'Kitchen 86-ed dragon dumplings', 'Void reason recorded')

  // Query audit logs scoped by property
  const propALogs = auditLogger.getLogsByProperty(propA)
  const propBLogs = auditLogger.getLogsByProperty(propB)

  assert(propALogs.some((l) => l.id === checkInEvent.id), 'Property A audit trail contains check-in event')
  assert(propALogs.some((l) => l.id === voidEvent.id), 'Property A audit trail contains void event')
  assert(!propBLogs.some((l) => l.id === checkInEvent.id), 'Property B audit trail is completely isolated from Property A')

  console.log('\n==================================================================')
  console.log('🎉 ALL ADMIN AUTHORIZATION, AUDIT LOGGING & VALIDATION TESTS PASSED!')
  console.log('==================================================================\n')
}

runAdminAuditValidationTests().catch((e) => {
  console.error(e)
  process.exit(1)
})
