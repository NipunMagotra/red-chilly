import crypto from 'crypto'

export interface OrganizationRecord {
  id: string
  name: string
  slug: string
}

export interface PropertyRecord {
  id: string
  organizationId: string
  name: string
  slug: string
  currency: string
  taxRate: number
  address?: string
  isActive: boolean
}

export interface LocationRecord {
  id: string
  propertyId: string
  propertyName: string
  name: string
  qrCodeIdentifier: string
  locationType: 'room' | 'table' | 'cabana' | 'bar'
  pinHash: string
  pinSalt: string
  tokenVersion: number
  accessPin?: string // Stored temporarily for admin reception welcome slip generation
  guestName: string
  isActive: boolean
}

export interface MenuItemRecord {
  id: string
  propertyId: string
  category: string
  name: string
  description: string
  price: number
  imageUrl?: string
  dietaryTags: string[]
  isAvailable: boolean
  isLateNight?: boolean
}

export interface OrderItemRecord {
  id: string
  menuItemId?: string
  name: string
  historicalMenuName?: string
  price: number // Authoritative unit price at order time
  quantity: number
  subtotal: number // Authoritative line total (price * quantity)
  notes?: string
  isVoided?: boolean
  voidReason?: string
}

export interface OrderRoundRecord {
  id: string
  roundNumber: number
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
  taxRateSnapshot: number
  subtotal: number
  tax: number
  total: number
  specialInstructions?: string
  items: OrderItemRecord[]
  idempotencyKey?: string
  createdAt: string
}

export interface GuestTabSession {
  id: string
  invoiceNumber?: string
  invoiceChecksum?: string
  invoiceSequenceNumber?: number
  propertyId: string
  propertyName: string
  locationId: string
  locationIdentifier: string
  locationName: string
  locationType: string
  guestName: string
  tokenVersion: number
  stayPin?: string
  status: 'active' | 'settled' | 'closed' | 'voided'
  subtotal: number
  tax: number
  totalAmount: number
  totalItemsCount: number
  rounds: OrderRoundRecord[]
  paymentMethod?: 'room_folio' | 'credit_card' | 'cash'
  staffNote?: string
  createdAt: string
  updatedAt: string
  settledAt?: string
}

// -----------------------------------------------------------------------------
// FINANCIAL MINOR-UNIT (PAISE) & MONEY CORRECTNESS HELPERS
// -----------------------------------------------------------------------------

export function toPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

// Aliases for backward compatibility with internal helpers
export const toCents = toPaise

export function toRupees(paise: number): number {
  return Math.round(paise) / 100
}

export const toDollars = toRupees

export function calculateLineTotalPaise(unitPricePaise: number, quantity: number): number {
  return unitPricePaise * quantity
}

export const calculateLineTotalCents = calculateLineTotalPaise

export function calculateTaxPaise(subtotalPaise: number, taxRate: number): number {
  return Math.round(subtotalPaise * taxRate)
}

export const calculateTaxCents = calculateTaxPaise

// -----------------------------------------------------------------------------
// STATE MACHINE TRANSITION VALIDATORS
// -----------------------------------------------------------------------------

export type SessionStatus = 'active' | 'settled' | 'closed' | 'voided'
export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'

const LEGAL_SESSION_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  active: ['settled', 'closed', 'voided'],
  settled: [], // Terminal state
  closed: [], // Terminal state
  voided: [], // Terminal state
}

const LEGAL_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  delivered: [], // Terminal state
  cancelled: [], // Terminal state
}

export function validateSessionTransition(current: SessionStatus, next: SessionStatus): boolean {
  if (current === next) return true
  return LEGAL_SESSION_TRANSITIONS[current]?.includes(next) ?? false
}

export function validateOrderTransition(current: OrderStatus, next: OrderStatus): boolean {
  if (current === next) return true
  return LEGAL_ORDER_TRANSITIONS[current]?.includes(next) ?? false
}

// -----------------------------------------------------------------------------
// CRYPTOGRAPHIC PIN HASHING & CONSTANT-TIME VERIFICATION HELPERS
// -----------------------------------------------------------------------------

export function generatePinSalt(): string {
  return crypto.randomBytes(16).toString('hex')
}

export function hashPin(pin: string, salt: string): string {
  return crypto.pbkdf2Sync(pin.trim(), salt, 10000, 32, 'sha256').toString('hex')
}

export function verifyPinConstantTime(candidatePin: string, salt: string, expectedHash: string): boolean {
  try {
    const candidateHash = hashPin(candidatePin, salt)
    const candidateBuf = Buffer.from(candidateHash, 'hex')
    const expectedBuf = Buffer.from(expectedHash, 'hex')
    if (candidateBuf.length !== expectedBuf.length) return false
    return crypto.timingSafeEqual(candidateBuf, expectedBuf)
  } catch {
    return false
  }
}

// Dummy salt & hash for anti-enumeration timing normalization
const DUMMY_SALT = '00112233445566778899aabbccddeeff'
const DUMMY_HASH = hashPin('0000', DUMMY_SALT)

export function dummyConstantTimeHash(candidatePin: string): boolean {
  return verifyPinConstantTime(candidatePin, DUMMY_SALT, DUMMY_HASH)
}

// -----------------------------------------------------------------------------
// MULTI-TENANT SEED DATA: ORGANIZATIONS & PROPERTIES
// -----------------------------------------------------------------------------

export const SEED_ORGANIZATIONS: OrganizationRecord[] = [
  {
    id: 'org-red-chilly-group',
    name: 'Red Chilly Hospitality Group',
    slug: 'red-chilly',
  },
  {
    id: 'org-emerald-hospitality',
    name: 'Emerald Bay Luxury Resorts',
    slug: 'emerald-bay',
  },
]

export const SEED_PROPERTIES: PropertyRecord[] = [
  {
    id: 'prop-red-chilly-flagship',
    organizationId: 'org-red-chilly-group',
    name: 'Red Chilly Luxury Resort & Dining',
    slug: 'red-chilly-flagship',
    currency: 'INR',
    taxRate: 0.0825,
    address: '100 Ocean Boulevard, Marina Bay',
    isActive: true,
  },
  {
    id: 'prop-emerald-bay-resort',
    organizationId: 'org-emerald-hospitality',
    name: 'Emerald Bay Seaside Resort & Spa',
    slug: 'emerald-bay-resort',
    currency: 'INR',
    taxRate: 0.095,
    address: '77 Palm Cove Drive, Emerald Bay',
    isActive: true,
  },
]

// Pre-computed salts & hashes for seed locations
const SALT_404 = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'
const SALT_201 = 'f0e1d2c3b4a5968778695a4b3c2d1e0f'
const SALT_12 = '11223344556677889900aabbccddeeff'
const SALT_7 = '99887766554433221100ffeeddccbbaa'
const SALT_EM101 = 'cafebabedeadbeef1234567890abcdef'
const SALT_EM5 = 'feedfacec001d00d0987654321fedcba'

export const SEED_LOCATIONS: LocationRecord[] = [
  // Tenant A: Red Chilly Flagship
  {
    id: 'loc-room-404',
    propertyId: 'prop-red-chilly-flagship',
    propertyName: 'Red Chilly Luxury Resort & Dining',
    name: 'Suite 404 (Ocean Villa)',
    qrCodeIdentifier: 'room-404',
    locationType: 'room',
    pinSalt: SALT_404,
    pinHash: hashPin('1234', SALT_404),
    tokenVersion: 1,
    accessPin: '1234',
    guestName: 'Alex & Jordan Mercer',
    isActive: true,
  },
  {
    id: 'loc-room-201',
    propertyId: 'prop-red-chilly-flagship',
    propertyName: 'Red Chilly Luxury Resort & Dining',
    name: 'Room 201 (Executive Suite)',
    qrCodeIdentifier: 'room-201',
    locationType: 'room',
    pinSalt: SALT_201,
    pinHash: hashPin('5678', SALT_201),
    tokenVersion: 1,
    accessPin: '5678',
    guestName: 'Elena Rostova',
    isActive: true,
  },
  {
    id: 'loc-table-12',
    propertyId: 'prop-red-chilly-flagship',
    propertyName: 'Red Chilly Luxury Resort & Dining',
    name: 'Table 12 (Main Dining Terrace)',
    qrCodeIdentifier: 'table-12',
    locationType: 'table',
    pinSalt: SALT_12,
    pinHash: hashPin('0000', SALT_12),
    tokenVersion: 1,
    accessPin: '0000',
    guestName: 'Table 12 Guests',
    isActive: true,
  },
  {
    id: 'loc-cabana-7',
    propertyId: 'prop-red-chilly-flagship',
    propertyName: 'Red Chilly Luxury Resort & Dining',
    name: 'Cabana 7 (Sunset Poolside)',
    qrCodeIdentifier: 'cabana-7',
    locationType: 'cabana',
    pinSalt: SALT_7,
    pinHash: hashPin('9999', SALT_7),
    tokenVersion: 1,
    accessPin: '9999',
    guestName: 'Marcus Vance',
    isActive: true,
  },

  // Tenant B: Emerald Bay Resort
  {
    id: 'loc-emerald-suite-101',
    propertyId: 'prop-emerald-bay-resort',
    propertyName: 'Emerald Bay Seaside Resort & Spa',
    name: 'Emerald Suite 101',
    qrCodeIdentifier: 'emerald-101',
    locationType: 'room',
    pinSalt: SALT_EM101,
    pinHash: hashPin('4444', SALT_EM101),
    tokenVersion: 1,
    accessPin: '4444',
    guestName: 'Lord & Lady Harrington',
    isActive: true,
  },
  {
    id: 'loc-emerald-table-5',
    propertyId: 'prop-emerald-bay-resort',
    propertyName: 'Emerald Bay Seaside Resort & Spa',
    name: 'Emerald Table 5 (Lagoon Deck)',
    qrCodeIdentifier: 'emerald-tab-5',
    locationType: 'table',
    pinSalt: SALT_EM5,
    pinHash: hashPin('7777', SALT_EM5),
    tokenVersion: 1,
    accessPin: '7777',
    guestName: 'Emerald VIP Diners',
    isActive: true,
  },
]

// -----------------------------------------------------------------------------
// SEED MENU ITEMS (Property A & Property B)
// -----------------------------------------------------------------------------

export const SEED_MENU: MenuItemRecord[] = [
  // --- Tenant A: Red Chilly Menu Items ---
  {
    id: 'item-1',
    propertyId: 'prop-red-chilly-flagship',
    category: 'Signature Starters',
    name: 'Red Chilly Dragon Dumplings',
    description: 'Handcrafted pork & shrimp dumplings bathed in spicy toasted chili crisp oil and black vinegar.',
    price: 450,
    dietaryTags: ['Spicy', 'House Special'],
    isAvailable: true,
  },
  {
    id: 'item-2',
    propertyId: 'prop-red-chilly-flagship',
    category: 'Signature Starters',
    name: 'Crispy Truffle Calamari',
    description: 'Flash-fried calamari tossed in black truffle salt, smoked yuzu aioli, and charred scallions.',
    price: 520,
    dietaryTags: ['Seafood'],
    isAvailable: true,
  },
  {
    id: 'item-3',
    propertyId: 'prop-red-chilly-flagship',
    category: 'Signature Starters',
    name: 'Avocado Tartare & Wonton Crisps',
    description: 'Hass avocado, ginger-tamari emulsion, sesame oil, and crispy fried wonton crackers.',
    price: 420,
    dietaryTags: ['Vegan', 'Gluten-Free Option'],
    isAvailable: true,
  },
  {
    id: 'item-4',
    propertyId: 'prop-red-chilly-flagship',
    category: 'Specialty Mains',
    name: 'Szechuan Fire Roasted Duck',
    description: 'Crispy skin roasted half duck served with steamed lotus buns, hoisin plum reduction, and cucumber matchsticks.',
    price: 1450,
    dietaryTags: ['Chef Choice', 'Signature'],
    isAvailable: true,
  },
  {
    id: 'item-5',
    propertyId: 'prop-red-chilly-flagship',
    category: 'Specialty Mains',
    name: 'Wagyu Beef Ribeye Dan Dan Noodles',
    description: 'Hand-pulled wheat noodles, dry-aged A5 wagyu mince, bok choy, crushed roasted peanuts in rich sesame broth.',
    price: 1250,
    dietaryTags: ['Spicy', 'Premium'],
    isAvailable: true,
  },
  {
    id: 'item-6',
    propertyId: 'prop-red-chilly-flagship',
    category: 'Specialty Mains',
    name: 'Miso Glazed Chilean Sea Bass',
    description: 'Pan-seared sea bass with sweet white miso glaze, ginger dashi reduction, and braised shiitake mushrooms.',
    price: 1650,
    dietaryTags: ['Gluten-Free', 'Seafood'],
    isAvailable: true,
  },
  {
    id: 'item-7',
    propertyId: 'prop-red-chilly-flagship',
    category: 'Late-Night Bites',
    name: 'Midnight Chilly Cheeseburger Sliders',
    description: 'Pair of prime beef sliders, pepper jack, spicy kimchi relish, and gochujang remoulade on brioche.',
    price: 550,
    dietaryTags: ['Late Night', 'Comfort'],
    isAvailable: true,
    isLateNight: true,
  },
  {
    id: 'item-8',
    propertyId: 'prop-red-chilly-flagship',
    category: 'Late-Night Bites',
    name: 'Loaded Chili Oil Truffle Fries',
    description: 'Crispy shoestring fries dusted with parmesan, scallions, garlic crunch, and chili oil drizzle.',
    price: 380,
    dietaryTags: ['Vegetarian', 'Late Night'],
    isAvailable: true,
    isLateNight: true,
  },
  {
    id: 'item-9',
    propertyId: 'prop-red-chilly-flagship',
    category: 'Late-Night Bites',
    name: 'Crispy Firecracker Chicken Wings',
    description: 'Double-fried wings tossed in spicy honey garlic chili glaze with cool cilantro buttermilk dip.',
    price: 520,
    dietaryTags: ['Spicy', 'Late Night'],
    isAvailable: true,
    isLateNight: true,
  },
  {
    id: 'item-10',
    propertyId: 'prop-red-chilly-flagship',
    category: 'Craft Drinks',
    name: 'Smoke & Spice Mezcalita',
    description: 'Artisanal mezcal, fresh lime, blood orange, smoked chili salt rim, and charred rosemary.',
    price: 590,
    dietaryTags: ['Alcohol 21+'],
    isAvailable: true,
  },
  {
    id: 'item-11',
    propertyId: 'prop-red-chilly-flagship',
    category: 'Craft Drinks',
    name: 'Lychee Dragonfruit Blossom Mocktail',
    description: 'Fresh lychee puree, dragonfruit nectar, sparkling yuzu water, and edible orchid.',
    price: 320,
    dietaryTags: ['Non-Alcoholic', 'Refreshing'],
    isAvailable: true,
  },
  {
    id: 'item-12',
    propertyId: 'prop-red-chilly-flagship',
    category: 'Desserts',
    name: 'Matcha Lava Cake & Black Sesame Gelato',
    description: 'Warm ceremonial matcha molten center with artisanal black sesame seed gelato.',
    price: 420,
    dietaryTags: ['Vegetarian', 'Sweet'],
    isAvailable: true,
  },

  // --- Tenant B: Emerald Bay Resort Menu Items ---
  {
    id: 'item-em-1',
    propertyId: 'prop-emerald-bay-resort',
    category: 'Coastal Appetizers',
    name: 'Emerald Coast Jumbo Crab Cakes',
    description: 'Pan-seared jumbo lump crab cakes with Meyer lemon remoulade and micro-herb salad.',
    price: 950,
    dietaryTags: ['Seafood', 'Signature'],
    isAvailable: true,
  },
  {
    id: 'item-em-2',
    propertyId: 'prop-emerald-bay-resort',
    category: 'Coastal Mains',
    name: 'Grilled Pacific Spiny Lobster Tail',
    description: 'Herb butter-basted lobster tail served with saffron risotto and grilled asparagus.',
    price: 2450,
    dietaryTags: ['Gluten-Free', 'Seafood'],
    isAvailable: true,
  },
  {
    id: 'item-em-3',
    propertyId: 'prop-emerald-bay-resort',
    category: 'Tropical Drinks',
    name: 'Emerald Lagoon Coconut Mojito',
    description: 'Aged white rum, fresh mint, cream of coconut, lime juice, topped with club soda.',
    price: 550,
    dietaryTags: ['Alcohol 21+'],
    isAvailable: true,
  },
]

// -----------------------------------------------------------------------------
// CONTINUOUS TAB MANAGER (With Money Correctness, State Machine & Invariant Enforcement)
// -----------------------------------------------------------------------------

class ContinuousTabManager {
  private sessions: Map<string, GuestTabSession> = new Map()
  private locations: Map<string, LocationRecord> = new Map()
  private idempotencyStore: Map<string, { session: GuestTabSession; newRound: OrderRoundRecord }> = new Map()
  private invoiceCounters: Map<string, number> = new Map()

  constructor() {
    // Initialize locations map
    for (const loc of SEED_LOCATIONS) {
      this.locations.set(loc.qrCodeIdentifier.toLowerCase(), { ...loc })
    }

    // Seed initial demo tab for Room 404 (Property A)
    const room404 = this.locations.get('room-404')
    if (room404) {
      const demoSession = this.createOrGetSession(room404)
      this.appendOrderToTab(demoSession.id, [
        { menuItemId: 'item-1', name: 'Red Chilly Dragon Dumplings', price: 450, quantity: 1 },
        { menuItemId: 'item-10', name: 'Smoke & Spice Mezcalita', price: 590, quantity: 1 }
      ], 'Please deliver to terrace')
    }

    // Seed initial demo tab for Emerald Suite 101 (Property B)
    const emerald101 = this.locations.get('emerald-101')
    if (emerald101) {
      const emeraldSession = this.createOrGetSession(emerald101)
      this.appendOrderToTab(emeraldSession.id, [
        { menuItemId: 'item-em-1', name: 'Emerald Coast Jumbo Crab Cakes', price: 950, quantity: 1 },
        { menuItemId: 'item-em-3', name: 'Emerald Lagoon Coconut Mojito', price: 550, quantity: 1 }
      ], 'VIP Suite Service')
    }
  }

  getAllLocations(): LocationRecord[] {
    return Array.from(this.locations.values())
  }

  getLocationsByProperty(propertyId: string): LocationRecord[] {
    return Array.from(this.locations.values()).filter((l) => l.propertyId === propertyId)
  }

  getLocationByIdentifier(identifier: string): LocationRecord | undefined {
    return this.locations.get(identifier.toLowerCase())
  }

  /**
   * Anti-Enumeration & Constant-Time PIN Verification
   * Performs dummy calculation if location does not exist to eliminate timing side channels.
   */
  verifyLocationPin(
    identifier: string,
    candidatePin: string
  ): { isValid: boolean; location?: LocationRecord } {
    const loc = this.locations.get(identifier.toLowerCase())

    if (!loc) {
      dummyConstantTimeHash(candidatePin)
      return { isValid: false }
    }

    const isValid = verifyPinConstantTime(candidatePin, loc.pinSalt, loc.pinHash)
    return { isValid, location: isValid ? loc : undefined }
  }

  getActiveSessionForLocation(locationId: string): GuestTabSession | undefined {
    for (const session of Array.from(this.sessions.values())) {
      if (session.locationId === locationId && session.status === 'active') {
        return session
      }
    }
    return undefined
  }

  getSessionById(sessionId: string): GuestTabSession | undefined {
    return this.sessions.get(sessionId)
  }

  getAllSessions(): GuestTabSession[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  getSessionsByProperty(propertyId: string): GuestTabSession[] {
    return Array.from(this.sessions.values())
      .filter((s) => s.propertyId === propertyId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  getMenuItemsByProperty(propertyId?: string): MenuItemRecord[] {
    if (!propertyId) {
      return SEED_MENU.filter((m) => m.isAvailable)
    }
    return SEED_MENU.filter((m) => m.propertyId === propertyId && m.isAvailable)
  }

  createOrGetSession(location: LocationRecord): GuestTabSession {
    const existing = this.getActiveSessionForLocation(location.id)
    if (existing) {
      return existing
    }

    const newSession: GuestTabSession = {
      id: `session-${location.qrCodeIdentifier}-${Date.now()}`,
      propertyId: location.propertyId,
      propertyName: location.propertyName,
      locationId: location.id,
      locationIdentifier: location.qrCodeIdentifier,
      locationName: location.name,
      locationType: location.locationType,
      guestName: location.guestName,
      tokenVersion: location.tokenVersion || 1,
      status: 'active',
      subtotal: 0,
      tax: 0,
      totalAmount: 0,
      totalItemsCount: 0,
      rounds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    this.sessions.set(newSession.id, newSession)
    return newSession
  }

  checkInGuest(
    locationIdentifier: string,
    guestName: string,
    newPin: string,
    expectedPropertyId?: string
  ): { location: LocationRecord; session: GuestTabSession } {
    const loc = this.locations.get(locationIdentifier.toLowerCase())
    if (!loc) {
      throw new Error(`Location ${locationIdentifier} not found.`)
    }

    // Strict Tenant Isolation Check
    if (expectedPropertyId && loc.propertyId !== expectedPropertyId) {
      throw new Error(`Tenant Isolation Violation: Location "${loc.name}" belongs to property "${loc.propertyId}", not "${expectedPropertyId}".`)
    }

    // 1. Close and invalidate any previous open session for this location (Session Fixation Defense)
    const previousSession = this.getActiveSessionForLocation(loc.id)
    if (previousSession) {
      previousSession.status = 'closed'
      previousSession.updatedAt = new Date().toISOString()
    }

    // 2. Rotate PIN & Token Version (Invalidates all existing guest tokens)
    const newSalt = generatePinSalt()
    const newHash = hashPin(newPin, newSalt)

    loc.guestName = guestName.trim() || 'Valued Guest'
    loc.pinSalt = newSalt
    loc.pinHash = newHash
    loc.accessPin = newPin // Retained in memory for the immediate welcome slip response
    loc.tokenVersion = (loc.tokenVersion || 1) + 1

    this.locations.set(locationIdentifier.toLowerCase(), loc)

    // 3. Initialize fresh new active session with incremented tokenVersion
    const newSession: GuestTabSession = {
      id: `session-${loc.qrCodeIdentifier}-${Date.now()}`,
      propertyId: loc.propertyId,
      propertyName: loc.propertyName,
      locationId: loc.id,
      locationIdentifier: loc.qrCodeIdentifier,
      locationName: loc.name,
      locationType: loc.locationType,
      guestName: loc.guestName,
      tokenVersion: loc.tokenVersion,
      status: 'active',
      subtotal: 0,
      tax: 0,
      totalAmount: 0,
      totalItemsCount: 0,
      rounds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    this.sessions.set(newSession.id, newSession)
    return { location: loc, session: newSession }
  }

  /**
   * ATOMIC ORDER APPEND WITH AUTHORITATIVE PRICING & HISTORICAL SNAPSHOTTING
   */
  appendOrderToTab(
    sessionId: string,
    items: { menuItemId?: string; name: string; price?: number; quantity: number; notes?: string }[],
    specialInstructions?: string,
    expectedPropertyId?: string,
    idempotencyKey?: string
  ): { session: GuestTabSession; newRound: OrderRoundRecord } {
    // 1. Idempotency Check
    const cleanIdempotencyKey = idempotencyKey?.trim()
    if (cleanIdempotencyKey) {
      const idempotencyId = `${sessionId}:${cleanIdempotencyKey}`
      const cached = this.idempotencyStore.get(idempotencyId)
      if (cached) {
        const latestSession = this.sessions.get(sessionId) || cached.session
        return { session: latestSession, newRound: cached.newRound }
      }
    }

    // 2. Strict Invariant & State Machine Checks
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('Continuous tab session not found.')
    }

    if (session.status === 'settled') {
      throw new Error('This room tab has already been settled at checkout and cannot accept new orders.')
    }

    if (session.status === 'closed') {
      throw new Error('This room tab is closed. Please scan your room QR code and re-enter your stay PIN.')
    }

    if (session.status !== 'active') {
      throw new Error(`Cannot append orders to a tab with status "${session.status}".`)
    }

    // Strict Tenant Isolation Check
    if (expectedPropertyId && session.propertyId !== expectedPropertyId) {
      throw new Error(`Tenant Isolation Violation: Session belongs to property "${session.propertyId}", not "${expectedPropertyId}".`)
    }

    const propertyTaxRate = session.propertyId === 'prop-emerald-bay-resort' ? 0.095 : 0.0825

    // 3. Process & Validate Items using Minor Units (Cents)
    let roundSubtotalCents = 0

    const orderItems: OrderItemRecord[] = items.map((it, idx) => {
      if (!it.menuItemId) {
        throw new Error('Missing menuItemId for order item.')
      }

      const serverMenuItem = SEED_MENU.find((m) => m.id === it.menuItemId)
      if (!serverMenuItem) {
        throw new Error(`Menu item "${it.menuItemId}" not found in catalog.`)
      }

      // STRICT TENANT ISOLATION CHECK ON MENU ITEM
      if (serverMenuItem.propertyId !== session.propertyId) {
        throw new Error(
          `Tenant Isolation Violation: Menu item "${serverMenuItem.name}" (${serverMenuItem.id}) belongs to property "${serverMenuItem.propertyId}", but this session belongs to property "${session.propertyId}". Cross-tenant ordering is forbidden.`
        )
      }

      const qty = Math.max(1, Math.min(50, Math.floor(it.quantity || 1)))
      const authoritativePrice = serverMenuItem.price // In rupees
      const authoritativePricePaise = toPaise(authoritativePrice)
      const lineTotalPaise = calculateLineTotalPaise(authoritativePricePaise, qty)
      const lineTotal = toRupees(lineTotalPaise)

      roundSubtotalCents += lineTotalPaise

      // Historical snapshot of item at order time
      return {
        id: `item-${Date.now()}-${idx}`,
        menuItemId: it.menuItemId,
        name: serverMenuItem.name,
        historicalMenuName: serverMenuItem.name,
        price: authoritativePrice,
        quantity: qty,
        subtotal: lineTotal,
        notes: it.notes,
        isVoided: false,
      }
    })

    const roundTaxCents = calculateTaxPaise(roundSubtotalCents, propertyTaxRate)
    const roundTotalCents = roundSubtotalCents + roundTaxCents

    const newRoundNumber = session.rounds.length + 1

    const newRound: OrderRoundRecord = {
      id: `round-${session.id}-${newRoundNumber}`,
      roundNumber: newRoundNumber,
      status: 'pending',
      taxRateSnapshot: propertyTaxRate,
      subtotal: toRupees(roundSubtotalCents),
      tax: toRupees(roundTaxCents),
      total: toRupees(roundTotalCents),
      specialInstructions,
      items: orderItems,
      idempotencyKey: cleanIdempotencyKey,
      createdAt: new Date().toISOString(),
    }

    session.rounds.push(newRound)
    this.recalculateSessionTotals(session)

    // Store in Idempotency Cache
    if (cleanIdempotencyKey) {
      const idempotencyId = `${sessionId}:${cleanIdempotencyKey}`
      this.idempotencyStore.set(idempotencyId, { session, newRound })
    }

    return { session, newRound }
  }

  /**
   * ATOMIC ORDER STATUS TRANSITION (State Machine Enforcement)
   */
  updateOrderStatus(
    sessionId: string,
    roundId: string,
    newStatus: OrderStatus,
    expectedPropertyId?: string
  ): OrderRoundRecord {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error('Session not found.')

    if (expectedPropertyId && session.propertyId !== expectedPropertyId) {
      throw new Error(`Tenant Isolation Violation: Cannot modify session from property "${session.propertyId}". Staff is from "${expectedPropertyId}".`)
    }

    const round = session.rounds.find((r) => r.id === roundId)
    if (!round) throw new Error('Order round not found.')

    if (!validateOrderTransition(round.status, newStatus)) {
      throw new Error(`Illegal Order State Transition: Cannot transition order from "${round.status}" to "${newStatus}".`)
    }

    round.status = newStatus
    session.updatedAt = new Date().toISOString()
    return round
  }

  /**
   * ATOMIC ORDER ITEM VOID (Excludes exactly once from financials)
   */
  voidOrderItem(
    sessionId: string,
    roundId: string,
    itemId: string,
    reason: string = 'Out of Stock / Voided by Reception',
    expectedPropertyId?: string
  ): GuestTabSession {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('Session not found.')
    }

    // Invariant Check: Cannot void on settled or closed tab
    if (session.status === 'settled' || session.status === 'closed') {
      throw new Error(`Cannot void items from a tab that is already ${session.status}.`)
    }

    // Strict Tenant Isolation Check
    if (expectedPropertyId && session.propertyId !== expectedPropertyId) {
      throw new Error(`Tenant Isolation Violation: Cannot modify session from property "${session.propertyId}". Staff is from "${expectedPropertyId}".`)
    }

    const round = session.rounds.find((r) => r.id === roundId)
    if (!round) {
      throw new Error('Order round not found.')
    }

    const item = round.items.find((i) => i.id === itemId)
    if (!item) {
      throw new Error('Item not found in round.')
    }

    if (item.isVoided) {
      return session // Already voided
    }

    item.isVoided = true
    item.voidReason = reason

    // Recalculate round using minor units (paise)
    let roundActiveSubtotalCents = 0
    for (const it of round.items) {
      if (!it.isVoided) {
        roundActiveSubtotalCents += toPaise(it.price) * it.quantity
      }
    }

    const roundTaxCents = calculateTaxPaise(roundActiveSubtotalCents, round.taxRateSnapshot)
    const roundTotalCents = roundActiveSubtotalCents + roundTaxCents

    round.subtotal = toRupees(roundActiveSubtotalCents)
    round.tax = toRupees(roundTaxCents)
    round.total = toRupees(roundTotalCents)

    this.recalculateSessionTotals(session)
    return session
  }

  /**
   * ATOMIC TAB SETTLEMENT & TAMPER-EVIDENT INVOICE GENERATION
   */
  settleAndCloseTab(
    sessionId: string,
    paymentMethod: 'room_folio' | 'credit_card' | 'cash' = 'room_folio',
    staffNote?: string,
    expectedPropertyId?: string
  ): GuestTabSession {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('Session not found.')
    }

    // Strict Tenant Isolation Check
    if (expectedPropertyId && session.propertyId !== expectedPropertyId) {
      throw new Error(`Tenant Isolation Violation: Cannot settle session from property "${session.propertyId}". Staff is from "${expectedPropertyId}".`)
    }

    if (session.status === 'settled') {
      return session
    }

    // State Machine Transition Validation
    if (!validateSessionTransition(session.status, 'settled')) {
      throw new Error(`Illegal Session Transition: Cannot settle session in status "${session.status}".`)
    }

    this.recalculateSessionTotals(session)

    // Sequential & Unique Invoice Numbering per Property
    const currentSeq = (this.invoiceCounters.get(session.propertyId) || 1000) + 1
    this.invoiceCounters.set(session.propertyId, currentSeq)

    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const propCode = session.propertyId === 'prop-emerald-bay-resort' ? 'EMB' : 'RDC'
    const cleanLocation = session.locationIdentifier.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const invoiceNumber = `INV-${propCode}-${datePrefix}-${cleanLocation}-${currentSeq}`

    const settledAt = new Date().toISOString()

    // Canonical Line-Item Digest (mirrors PostgreSQL settle_guest_tab deterministic ordering)
    // Each non-voided item: "name|unit_price|quantity|subtotal" joined by ";" across all rounds
    const lineItemParts: string[] = []
    for (const round of session.rounds) {
      const sortedItems = [...round.items]
        .filter((item) => !item.isVoided)
        .sort((a, b) => a.id.localeCompare(b.id))
      for (const item of sortedItems) {
        lineItemParts.push(
          `${item.name}|${item.price.toFixed(2)}|${item.quantity}|${item.subtotal.toFixed(2)}`
        )
      }
    }
    const lineItemsDigest = lineItemParts.join(';')

    // SHA-256 Digital Verification Checksum over full financial surface
    const checksumPayload = [
      invoiceNumber,
      session.id,
      session.propertyId,
      session.subtotal.toFixed(2),
      session.tax.toFixed(2),
      session.totalAmount.toFixed(2),
      paymentMethod,
      settledAt,
      lineItemsDigest,
    ].join(':')
    const invoiceChecksum = crypto.createHash('sha256').update(checksumPayload).digest('hex')

    // Atomic State Transition
    session.status = 'settled'
    session.paymentMethod = paymentMethod
    session.staffNote = staffNote
    session.invoiceNumber = invoiceNumber
    session.invoiceSequenceNumber = currentSeq
    session.invoiceChecksum = invoiceChecksum
    session.settledAt = settledAt
    session.updatedAt = settledAt

    return session
  }

  /**
   * Authoritative Tab Financial Aggregation in Minor Units (Cents)
   * Excludes voided items exactly once.
   */
  private recalculateSessionTotals(session: GuestTabSession) {
    let accumulatedSubtotalCents = 0
    let accumulatedTaxCents = 0
    let totalItems = 0

    for (const round of session.rounds) {
      let roundActiveSubtotalCents = 0

      for (const item of round.items) {
        if (!item.isVoided) {
          const itemTotalCents = toPaise(item.price) * item.quantity
          item.subtotal = toRupees(itemTotalCents)
          roundActiveSubtotalCents += itemTotalCents
          totalItems += item.quantity
        }
      }

      const roundTaxRate = round.taxRateSnapshot || (session.propertyId === 'prop-emerald-bay-resort' ? 0.095 : 0.0825)
      const roundTaxCents = calculateTaxPaise(roundActiveSubtotalCents, roundTaxRate)
      const roundTotalCents = roundActiveSubtotalCents + roundTaxCents

      round.subtotal = toRupees(roundActiveSubtotalCents)
      round.tax = toRupees(roundTaxCents)
      round.total = toRupees(roundTotalCents)

      accumulatedSubtotalCents += roundActiveSubtotalCents
      accumulatedTaxCents += roundTaxCents
    }

    session.subtotal = toRupees(accumulatedSubtotalCents)
    session.tax = toRupees(accumulatedTaxCents)
    session.totalAmount = toRupees(accumulatedSubtotalCents + accumulatedTaxCents)
    session.totalItemsCount = totalItems
    session.updatedAt = new Date().toISOString()
  }
}

// Global Singleton Instance
declare global {
  // eslint-disable-next-line no-var
  var globalTabManager: ContinuousTabManager | undefined
}

export const tabManager = globalThis.globalTabManager || new ContinuousTabManager()
if (process.env.NODE_ENV !== 'production') {
  globalThis.globalTabManager = tabManager
}
