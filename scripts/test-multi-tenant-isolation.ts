/**
 * Multi-Tenant Isolation & Horizontal IDOR Attack Test Suite
 * Validates that Tenant A cannot read, modify, or inject data into Tenant B.
 */

import { tabManager, SEED_LOCATIONS, SEED_MENU } from '../src/lib/data/restaurant-data'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`)
    process.exit(1)
  } else {
    console.log(`✅ PASSED: ${message}`)
  }
}

async function runMultiTenantIdorTests() {
  console.log('\n======================================================')
  console.log('🛡️ RUNNING MULTI-TENANT ISOLATION & IDOR ATTACK AUDIT')
  console.log('======================================================\n')

  // Setup Test Tenants:
  // Tenant A: Red Chilly Flagship ('prop-red-chilly-flagship')
  // Tenant B: Emerald Bay Resort ('prop-emerald-bay-resort')

  const tenantALocation = tabManager.getLocationByIdentifier('room-404')!
  const tenantBLocation = tabManager.getLocationByIdentifier('emerald-101')!

  assert(!!tenantALocation, 'Tenant A location (room-404) exists')
  assert(!!tenantBLocation, 'Tenant B location (emerald-101) exists')
  assert(tenantALocation.propertyId === 'prop-red-chilly-flagship', 'Tenant A propertyId matches')
  assert(tenantBLocation.propertyId === 'prop-emerald-bay-resort', 'Tenant B propertyId matches')

  // 1. Initialize Sessions for Both Tenants
  const sessionA = tabManager.createOrGetSession(tenantALocation)
  const sessionB = tabManager.createOrGetSession(tenantBLocation)

  assert(sessionA.propertyId === 'prop-red-chilly-flagship', 'Session A belongs to Tenant A')
  assert(sessionB.propertyId === 'prop-emerald-bay-resort', 'Session B belongs to Tenant B')

  // ---------------------------------------------------------------------------
  // ATTACK SCENARIO 1: Cross-Tenant Menu Item Injection
  // Guest A tries to order Tenant B's exclusive Crab Cakes ('item-em-1')
  // ---------------------------------------------------------------------------
  console.log('\n--- Attack 1: Cross-Tenant Menu Item Injection ---')
  let attack1Blocked = false
  try {
    tabManager.appendOrderToTab(
      sessionA.id,
      [{ menuItemId: 'item-em-1', name: 'Emerald Coast Crab Cakes', quantity: 1 }],
      'Injected cross-tenant item',
      'prop-red-chilly-flagship'
    )
  } catch (err: any) {
    attack1Blocked = true
    assert(
      err.message.includes('Tenant Isolation Violation') || err.message.includes('belongs to property'),
      `Attack 1 correctly blocked: "${err.message}"`
    )
  }
  assert(attack1Blocked, 'Guest A cannot order Tenant B menu items')

  // ---------------------------------------------------------------------------
  // ATTACK SCENARIO 2: Cross-Tenant Session Appending / Tampering
  // Guest A tries to append an order to Tenant B's active session
  // ---------------------------------------------------------------------------
  console.log('\n--- Attack 2: Cross-Tenant Session IDOR Appending ---')
  let attack2Blocked = false
  try {
    tabManager.appendOrderToTab(
      sessionB.id,
      [{ menuItemId: 'item-1', name: 'Red Chilly Dragon Dumplings', quantity: 1 }],
      'Attacker injecting order into Tenant B tab',
      'prop-red-chilly-flagship' // Caller is authenticated as Tenant A
    )
  } catch (err: any) {
    attack2Blocked = true
    assert(
      err.message.includes('Tenant Isolation Violation'),
      `Attack 2 correctly blocked: "${err.message}"`
    )
  }
  assert(attack2Blocked, 'Tenant A cannot append orders to Tenant B session')

  // ---------------------------------------------------------------------------
  // ATTACK SCENARIO 3: Staff Dashboard Data Scoping
  // Staff of Tenant A queries dashboard -> Must receive ONLY Tenant A data
  // ---------------------------------------------------------------------------
  console.log('\n--- Attack 3: Staff Dashboard Cross-Tenant Data Leak ---')
  const staffALocations = tabManager.getLocationsByProperty('prop-red-chilly-flagship')
  const staffASessions = tabManager.getSessionsByProperty('prop-red-chilly-flagship')

  const leakedLocations = staffALocations.filter((l) => l.propertyId !== 'prop-red-chilly-flagship')
  const leakedSessions = staffASessions.filter((s) => s.propertyId !== 'prop-red-chilly-flagship')

  assert(leakedLocations.length === 0, 'Staff A sees 0 locations from Tenant B')
  assert(leakedSessions.length === 0, 'Staff A sees 0 sessions from Tenant B')
  assert(
    staffALocations.every((l) => l.propertyId === 'prop-red-chilly-flagship'),
    'All returned locations belong strictly to Tenant A'
  )

  // ---------------------------------------------------------------------------
  // ATTACK SCENARIO 4: Cross-Tenant Check-In & PIN Tampering
  // Staff of Tenant A tries to change PIN on Tenant B's room ('emerald-101')
  // ---------------------------------------------------------------------------
  console.log('\n--- Attack 4: Cross-Tenant Check-In & PIN Tampering ---')
  let attack4Blocked = false
  try {
    tabManager.checkInGuest(
      'emerald-101',
      'Hacker Guest',
      '0000',
      'prop-red-chilly-flagship' // Staff from Tenant A
    )
  } catch (err: any) {
    attack4Blocked = true
    assert(
      err.message.includes('Tenant Isolation Violation'),
      `Attack 4 correctly blocked: "${err.message}"`
    )
  }
  assert(attack4Blocked, 'Staff A cannot check in or modify PIN on Tenant B room')

  // ---------------------------------------------------------------------------
  // ATTACK SCENARIO 5: Cross-Tenant Order Item Voiding
  // Staff of Tenant A tries to void an item in Tenant B's tab
  // ---------------------------------------------------------------------------
  console.log('\n--- Attack 5: Cross-Tenant Item Voiding ---')
  let attack5Blocked = false
  try {
    const roundB = sessionB.rounds[0]
    const itemB = roundB?.items[0]
    if (roundB && itemB) {
      tabManager.voidOrderItem(
        sessionB.id,
        roundB.id,
        itemB.id,
        'Unauthorized void attempt',
        'prop-red-chilly-flagship' // Staff from Tenant A
      )
    }
  } catch (err: any) {
    attack5Blocked = true
    assert(
      err.message.includes('Tenant Isolation Violation'),
      `Attack 5 correctly blocked: "${err.message}"`
    )
  }
  assert(attack5Blocked, 'Staff A cannot void items from Tenant B tab')

  // ---------------------------------------------------------------------------
  // ATTACK SCENARIO 6: Cross-Tenant Tab Settlement
  // Staff of Tenant A tries to settle Tenant B's tab
  // ---------------------------------------------------------------------------
  console.log('\n--- Attack 6: Cross-Tenant Tab Settlement ---')
  let attack6Blocked = false
  try {
    tabManager.settleAndCloseTab(
      sessionB.id,
      'room_folio',
      'Unauthorized settlement attempt',
      'prop-red-chilly-flagship' // Staff from Tenant A
    )
  } catch (err: any) {
    attack6Blocked = true
    assert(
      err.message.includes('Tenant Isolation Violation'),
      `Attack 6 correctly blocked: "${err.message}"`
    )
  }
  assert(attack6Blocked, 'Staff A cannot settle Tenant B tab')

  console.log('\n======================================================')
  console.log('🎉 ALL MULTI-TENANT ISOLATION & IDOR ATTACK TESTS PASSED!')
  console.log('======================================================\n')
}

runMultiTenantIdorTests().catch((e) => {
  console.error(e)
  process.exit(1)
})
