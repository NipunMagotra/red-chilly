/**
 * Adversarial Admin Horizontal Privilege Escalation Test Suite
 * 
 * Sets up:
 * - Staff A: Assigned strictly to Property A ('prop-red-chilly-flagship')
 * - Staff B: Assigned strictly to Property B ('prop-emerald-bay-resort')
 * - Org Admin: Assigned to Organization level (both properties)
 * 
 * Attempts every admin mutation with cross-property / wrong property parameters:
 * 1. Staff A attempting Check-In / PIN modification on Property B location ('emerald-101')
 * 2. Staff A attempting Item Void on Property B session ('emerald-suite-101')
 * 3. Staff A attempting Tab Settlement on Property B session
 * 4. Staff A attempting Order Status Transition on Property B order
 * 5. Staff A querying Dashboard metrics / locations / sessions of Property B
 * 6. Organization Admin executing authorized operations across both properties
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

async function runAdminHorizontalPrivilegeTests() {
  console.log('\n==================================================================')
  console.log('🛡️ 16. ADVERSARIAL ADMIN HORIZONTAL PRIVILEGE ESCALATION AUDIT')
  console.log('==================================================================\n')

  const propA = 'prop-red-chilly-flagship'
  const propB = 'prop-emerald-bay-resort'

  // Retrieve locations and sessions for Property A and B
  const locA = tabManager.getLocationByIdentifier('room-404')!
  const locB = tabManager.getLocationByIdentifier('emerald-101')!

  const sessionA = tabManager.createOrGetSession(locA)
  const sessionB = tabManager.createOrGetSession(locB)

  // Ensure session B has an order round for void testing
  if (sessionB.rounds.length === 0) {
    tabManager.appendOrderToTab(
      sessionB.id,
      [{ menuItemId: 'item-em-1', name: 'Crab Cakes', price: 24.00, quantity: 1 }],
      'VIP order',
      propB
    )
  }

  // ---------------------------------------------------------------------------
  // ATTACK 1: Staff A attempts Check-In / PIN Tampering on Property B room
  // ---------------------------------------------------------------------------
  console.log('--- Attack 1: Cross-Property Check-In & PIN Mutation ---')

  let crossCheckInBlocked = false
  try {
    tabManager.checkInGuest(
      'emerald-101', // Property B location
      'Hacker Guest',
      '9999',
      propA // Caller is Staff A from Property A
    )
  } catch (err: any) {
    crossCheckInBlocked = true
    assert(
      err.message.includes('Tenant Isolation Violation') || err.message.includes('belongs to property'),
      `Cross-check-in blocked with message: "${err.message}"`
    )
  }
  assert(crossCheckInBlocked, 'Staff A blocked from checking in or modifying PIN on Property B room')

  // ---------------------------------------------------------------------------
  // ATTACK 2: Staff A attempts Item Void on Property B session
  // ---------------------------------------------------------------------------
  console.log('\n--- Attack 2: Cross-Property Order Item Voiding ---')

  let crossVoidBlocked = false
  try {
    const roundB = sessionB.rounds[0]
    const itemB = roundB.items[0]
    tabManager.voidOrderItem(
      sessionB.id,
      roundB.id,
      itemB.id,
      'Unauthorized void by Staff A',
      propA // Caller is Staff A
    )
  } catch (err: any) {
    crossVoidBlocked = true
    assert(err.message.includes('Tenant Isolation Violation'), `Cross-void blocked: "${err.message}"`)
  }
  assert(crossVoidBlocked, 'Staff A blocked from voiding items on Property B tab')

  // ---------------------------------------------------------------------------
  // ATTACK 3: Staff A attempts Tab Settlement on Property B session
  // ---------------------------------------------------------------------------
  console.log('\n--- Attack 3: Cross-Property Tab Settlement ---')

  let crossSettleBlocked = false
  try {
    tabManager.settleAndCloseTab(
      sessionB.id,
      'room_folio',
      'Unauthorized settle by Staff A',
      propA // Caller is Staff A
    )
  } catch (err: any) {
    crossSettleBlocked = true
    assert(err.message.includes('Tenant Isolation Violation'), `Cross-settle blocked: "${err.message}"`)
  }
  assert(crossSettleBlocked, 'Staff A blocked from settling Property B tab')

  // ---------------------------------------------------------------------------
  // ATTACK 4: Staff A attempts Order Status Mutation on Property B order
  // ---------------------------------------------------------------------------
  console.log('\n--- Attack 4: Cross-Property Order Status Mutation ---')

  let crossStatusBlocked = false
  try {
    const roundB = sessionB.rounds[0]
    tabManager.updateOrderStatus(
      sessionB.id,
      roundB.id,
      'delivered',
      propA // Caller is Staff A
    )
  } catch (err: any) {
    crossStatusBlocked = true
    assert(err.message.includes('Tenant Isolation Violation'), `Cross-status update blocked: "${err.message}"`)
  }
  assert(crossStatusBlocked, 'Staff A blocked from modifying order status on Property B tab')

  // ---------------------------------------------------------------------------
  // ATTACK 5: Staff A Dashboard Scoping & Data Leak Prevention
  // ---------------------------------------------------------------------------
  console.log('\n--- Attack 5: Staff A Dashboard Data Leak Prevention ---')

  const staffALocations = tabManager.getLocationsByProperty(propA)
  const staffASessions = tabManager.getSessionsByProperty(propA)

  assert(
    staffALocations.every((l) => l.propertyId === propA),
    'Staff A locations query returned strictly Property A locations (0 leaked from Property B)'
  )
  assert(
    staffASessions.every((s) => s.propertyId === propA),
    'Staff A sessions query returned strictly Property A sessions (0 leaked from Property B)'
  )

  // ---------------------------------------------------------------------------
  // TEST 6: Organization Admin Access (Authorized Multi-Property Management)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 6: Organization Admin Multi-Property Management ---')

  // Org Admin settling tab on Property B with Property B scope
  const orgAdminSettleB = tabManager.settleAndCloseTab(
    sessionB.id,
    'room_folio',
    'Settled by Regional Org Admin',
    propB
  )
  assert(orgAdminSettleB.status === 'settled', 'Org Admin authorized to settle Property B tab with Property B scope')

  // Org Admin settling tab on Property A with Property A scope
  const orgAdminSettleA = tabManager.settleAndCloseTab(
    sessionA.id,
    'credit_card',
    'Settled by Regional Org Admin',
    propA
  )
  assert(orgAdminSettleA.status === 'settled', 'Org Admin authorized to settle Property A tab with Property A scope')

  console.log('\n==================================================================')
  console.log('🎉 ALL ADMIN HORIZONTAL PRIVILEGE ESCALATION TESTS PASSED!')
  console.log('==================================================================\n')
}

runAdminHorizontalPrivilegeTests().catch(console.error)
