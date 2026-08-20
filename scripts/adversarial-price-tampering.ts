/**
 * Adversarial Price Tampering & Catalog Integrity Test Suite
 * 
 * Intercepts client requests and attempts:
 * 1. Client injecting price = 0
 * 2. Client injecting price = 0.01
 * 3. Client injecting price = -100
 * 4. Client injecting price = 999999
 * 5. Client submitting a menu item belonging to another property
 * 6. Client submitting a deleted / non-existent menu item
 * 7. Client attempting to change the menu item name (e.g. "Free Dumplings")
 * 
 * Expected:
 * - Server strictly ignores client-supplied price and name.
 * - Server looks up authoritative price and name strictly from catalog database.
 * - Cross-property items and deleted items are rejected.
 */

import { tabManager, SEED_MENU } from '../src/lib/data/restaurant-data'
import { AppendOrderSchema } from '../src/lib/validation/schemas'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`)
    process.exit(1)
  } else {
    console.log(`✅ PASSED: ${message}`)
  }
}

async function runPriceTamperingTests() {
  console.log('\n==================================================================')
  console.log('🛡️ 9. ADVERSARIAL PRICE TAMPERING & CATALOG INTEGRITY AUDIT')
  console.log('==================================================================\n')

  const loc = tabManager.getLocationByIdentifier('room-404')!
  const session = tabManager.createOrGetSession(loc)

  const originalMenuItem = SEED_MENU.find((m) => m.id === 'item-1')! // Dragon Dumplings ($14.50)
  const authoritativePrice = originalMenuItem.price
  const authoritativeName = originalMenuItem.name

  // ---------------------------------------------------------------------------
  // ATTACK 1: Client Injects Forged Price ($0.00, $0.01, -$100, $999999)
  // ---------------------------------------------------------------------------
  console.log('--- Attack 1: Client Injected Prices ---')

  const hostilePrices = [0.00, 0.01, -100.00, 999999.00]

  for (const hostilePrice of hostilePrices) {
    // Client sends request payload attempting to override price
    const clientPayload: any = {
      menuItemId: 'item-1',
      name: 'Dragon Dumplings',
      price: hostilePrice, // Tampered price
      quantity: 1,
    }

    const { newRound } = tabManager.appendOrderToTab(
      session.id,
      [clientPayload],
      `Price tamper test: ${hostilePrice}`,
      'prop-red-chilly-flagship',
      `key-tamper-price-${hostilePrice}-${Date.now()}`
    )

    const savedItem = newRound.items[0]
    assert(savedItem.price === authoritativePrice, `Injected price $${hostilePrice} was IGNORED; charged authoritative $${authoritativePrice}`)
    assert(savedItem.subtotal === authoritativePrice, `Line subtotal computed with authoritative price ($${savedItem.subtotal} === $${authoritativePrice})`)
  }

  // ---------------------------------------------------------------------------
  // ATTACK 2: Client Attempts to Mutate Item Name ("Free Caviar")
  // ---------------------------------------------------------------------------
  console.log('\n--- Attack 2: Client Injected Name Mutation ---')

  const forgedNamePayload = {
    menuItemId: 'item-1',
    name: 'COMPLIMENTARY VIP CAVIAR PLATTER', // Forged name
    quantity: 1,
  }

  const { newRound: nameRound } = tabManager.appendOrderToTab(
    session.id,
    [forgedNamePayload],
    'Name tamper test',
    'prop-red-chilly-flagship',
    `key-tamper-name-${Date.now()}`
  )

  const savedNameItem = nameRound.items[0]
  assert(savedNameItem.name === authoritativeName, `Injected name "${forgedNamePayload.name}" was IGNORED; recorded authoritative name "${authoritativeName}"`)

  // ---------------------------------------------------------------------------
  // ATTACK 3: Cross-Property Menu Item Injection
  // ---------------------------------------------------------------------------
  console.log('\n--- Attack 3: Cross-Property Menu Item Injection ---')

  // Property A session attempts to order Property B exclusive crab cakes
  let crossPropBlocked = false
  try {
    tabManager.appendOrderToTab(
      session.id,
      [{ menuItemId: 'item-em-1', name: 'Emerald Crab Cakes', quantity: 1 }],
      'Cross-property injection',
      'prop-red-chilly-flagship'
    )
  } catch (err: any) {
    crossPropBlocked = true
    assert(err.message.includes('Tenant Isolation Violation'), 'Cross-property menu item ordering rejected')
  }
  assert(crossPropBlocked, 'Ordering item from another property catalog is strictly BLOCKED')

  // ---------------------------------------------------------------------------
  // ATTACK 4: Deleted / Non-Existent Menu Item Submission
  // ---------------------------------------------------------------------------
  console.log('\n--- Attack 4: Non-Existent / Deleted Menu Item Submission ---')

  let deletedItemBlocked = false
  try {
    tabManager.appendOrderToTab(
      session.id,
      [{ menuItemId: 'item-deleted-uuid-999', name: 'Ghost Burger', quantity: 1 }],
      'Deleted item injection',
      'prop-red-chilly-flagship'
    )
  } catch (err: any) {
    deletedItemBlocked = true
    assert(err.message.includes('not found in catalog'), 'Non-existent menu item rejected')
  }
  assert(deletedItemBlocked, 'Non-existent / deleted item submission is strictly BLOCKED')

  // ---------------------------------------------------------------------------
  // ATTACK 5: Runtime Schema Validation of Negative / Zero Quantities
  // ---------------------------------------------------------------------------
  console.log('\n--- Attack 5: Runtime Schema Validation (Negative / Zero / Absurd Qty) ---')

  assert(!AppendOrderSchema.safeParse({ items: [{ menuItemId: 'item-1', quantity: 0 }] }).success, 'Qty = 0 rejected by Zod schema')
  assert(!AppendOrderSchema.safeParse({ items: [{ menuItemId: 'item-1', quantity: -5 }] }).success, 'Qty = -5 rejected by Zod schema')
  assert(!AppendOrderSchema.safeParse({ items: [{ menuItemId: 'item-1', quantity: 9999 }] }).success, 'Qty = 9999 rejected by Zod schema')

  console.log('\n==================================================================')
  console.log('🎉 ALL PRICE TAMPERING & CATALOG INTEGRITY TESTS PASSED!')
  console.log('==================================================================\n')
}

runPriceTamperingTests().catch(console.error)
