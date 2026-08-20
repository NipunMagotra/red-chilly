import crypto from 'crypto'

export interface LocationRecord {
  id: string
  name: string
  qrCodeIdentifier: string
  locationType: 'room' | 'table' | 'cabana' | 'bar'
  pinHash: string
  pinSalt: string
  tokenVersion: number
  accessPin?: string // Stored in memory for reception welcome slip generation
  guestName: string
  isActive: boolean
}

export interface MenuItemRecord {
  id: string
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

export const toCents = toPaise

export function toRupees(paise: number): number {
  return Math.round(paise) / 100
}

export const toDollars = toRupees

export function calculateLineTotalPaise(unitPricePaise: number, quantity: number): number {
  return unitPricePaise * quantity
}

export const calculateLineTotalCents = calculateLineTotalPaise

export function calculateTaxPaise(subtotalPaise: number, taxRate: number = 0.0825): number {
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

const DUMMY_SALT = '00112233445566778899aabbccddeeff'
const DUMMY_HASH = hashPin('0000', DUMMY_SALT)

export function dummyConstantTimeHash(candidatePin: string): boolean {
  return verifyPinConstantTime(candidatePin, DUMMY_SALT, DUMMY_HASH)
}

// -----------------------------------------------------------------------------
// SINGLE-TENANT SEED DATA: LOCATIONS & MENU
// -----------------------------------------------------------------------------

const SALT_404 = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'
const SALT_201 = 'f0e1d2c3b4a5968778695a4b3c2d1e0f'
const SALT_12 = '11223344556677889900aabbccddeeff'
const SALT_7 = '99887766554433221100ffeeddccbbaa'

export const SEED_LOCATIONS: LocationRecord[] = [
  {
    id: 'loc-room-404',
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
]

export const SEED_MENU: MenuItemRecord[] = [
  {
    id: 'item-1',
    category: 'Signature Starters',
    name: 'Red Chilly Dragon Dumplings',
    description: 'Handcrafted pork & shrimp dumplings bathed in spicy toasted chili crisp oil and black vinegar.',
    price: 450,
    dietaryTags: ['Spicy', 'House Special'],
    isAvailable: true,
  },
  {
    id: 'item-2',
    category: 'Signature Starters',
    name: 'Crispy Truffle Calamari',
    description: 'Flash-fried calamari tossed in black truffle salt, smoked yuzu aioli, and charred scallions.',
    price: 520,
    dietaryTags: ['Seafood'],
    isAvailable: true,
  },
  {
    id: 'item-3',
    category: 'Signature Starters',
    name: 'Avocado Tartare & Wonton Crisps',
    description: 'Hass avocado, ginger-tamari emulsion, sesame oil, and crispy fried wonton crackers.',
    price: 420,
    dietaryTags: ['Vegan', 'Gluten-Free Option'],
    isAvailable: true,
  },
  {
    id: 'item-4',
    category: 'Specialty Mains',
    name: 'Szechuan Fire Roasted Duck',
    description: 'Crispy skin roasted half duck served with steamed lotus buns, hoisin plum reduction, and cucumber matchsticks.',
    price: 1450,
    dietaryTags: ['Chef Choice', 'Signature'],
    isAvailable: true,
  },
  {
    id: 'item-5',
    category: 'Specialty Mains',
    name: 'Wagyu Beef Ribeye Dan Dan Noodles',
    description: 'Hand-pulled wheat noodles, dry-aged A5 wagyu mince, bok choy, crushed roasted peanuts in rich sesame broth.',
    price: 1250,
    dietaryTags: ['Spicy', 'Premium'],
    isAvailable: true,
  },
  {
    id: 'item-6',
    category: 'Specialty Mains',
    name: 'Miso Glazed Chilean Sea Bass',
    description: 'Pan-seared sea bass with sweet white miso glaze, ginger dashi reduction, and braised shiitake mushrooms.',
    price: 1650,
    dietaryTags: ['Gluten-Free', 'Seafood'],
    isAvailable: true,
  },
  {
    id: 'item-7',
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
    category: 'Craft Drinks',
    name: 'Smoke & Spice Mezcalita',
    description: 'Artisanal mezcal, fresh lime, blood orange, smoked chili salt rim, and charred rosemary.',
    price: 590,
    dietaryTags: ['Alcohol 21+'],
    isAvailable: true,
  },
  {
    id: 'item-11',
    category: 'Craft Drinks',
    name: 'Lychee Dragonfruit Blossom Mocktail',
    description: 'Fresh lychee puree, dragonfruit nectar, sparkling yuzu water, and edible orchid.',
    price: 320,
    dietaryTags: ['Non-Alcoholic', 'Refreshing'],
    isAvailable: true,
  },
  {
    id: 'item-12',
    category: 'Desserts',
    name: 'Matcha Lava Cake & Black Sesame Gelato',
    description: 'Warm ceremonial matcha molten center with artisanal black sesame seed gelato.',
    price: 420,
    dietaryTags: ['Vegetarian', 'Sweet'],
    isAvailable: true,
  },
]

// -----------------------------------------------------------------------------
// CONTINUOUS TAB MANAGER
// -----------------------------------------------------------------------------

class ContinuousTabManager {
  private sessions: Map<string, GuestTabSession> = new Map()
  private locations: Map<string, LocationRecord> = new Map()
  private idempotencyStore: Map<string, { session: GuestTabSession; newRound: OrderRoundRecord }> = new Map()
  private invoiceCounter: number = 1000

  constructor() {
    for (const loc of SEED_LOCATIONS) {
      this.locations.set(loc.qrCodeIdentifier.toLowerCase(), { ...loc })
    }

    // Seed initial demo tab for Suite 404
    const room404 = this.locations.get('room-404')
    if (room404) {
      const demoSession = this.createOrGetSession(room404)
      this.appendOrderToTab(demoSession.id, [
        { menuItemId: 'item-1', name: 'Red Chilly Dragon Dumplings', price: 450, quantity: 1 },
        { menuItemId: 'item-10', name: 'Smoke & Spice Mezcalita', price: 590, quantity: 1 }
      ], 'Please deliver to terrace')
    }
  }

  getAllLocations(): LocationRecord[] {
    return Array.from(this.locations.values())
  }

  getLocationByIdentifier(identifier: string): LocationRecord | undefined {
    return this.locations.get(identifier.toLowerCase())
  }

  /**
   * Anti-Enumeration & Constant-Time PIN Verification
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

  getMenuItems(): MenuItemRecord[] {
    return SEED_MENU.filter((m) => m.isAvailable)
  }

  // Compatibility aliases
  getMenuItemsByProperty(): MenuItemRecord[] {
    return this.getMenuItems()
  }

  getLocationsByProperty(): LocationRecord[] {
    return this.getAllLocations()
  }

  getSessionsByProperty(): GuestTabSession[] {
    return this.getAllSessions()
  }

  createOrGetSession(location: LocationRecord): GuestTabSession {
    const existing = this.getActiveSessionForLocation(location.id)
    if (existing) {
      return existing
    }

    const newSession: GuestTabSession = {
      id: `session-${location.qrCodeIdentifier}-${Date.now()}`,
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
    newPin: string
  ): { location: LocationRecord; session: GuestTabSession } {
    const loc = this.locations.get(locationIdentifier.toLowerCase())
    if (!loc) {
      throw new Error(`Location ${locationIdentifier} not found.`)
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
    loc.accessPin = newPin
    loc.tokenVersion = (loc.tokenVersion || 1) + 1

    this.locations.set(locationIdentifier.toLowerCase(), loc)

    // 3. Initialize fresh new active session with incremented tokenVersion
    const newSession: GuestTabSession = {
      id: `session-${loc.qrCodeIdentifier}-${Date.now()}`,
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

    const standardTaxRate = 0.0825 // 8.25% standard dining tax

    // 3. Process & Validate Items using Minor Units (Paise)
    let roundSubtotalPaise = 0

    const orderItems: OrderItemRecord[] = items.map((it, idx) => {
      if (!it.menuItemId) {
        throw new Error('Missing menuItemId for order item.')
      }

      const serverMenuItem = SEED_MENU.find((m) => m.id === it.menuItemId)
      if (!serverMenuItem) {
        throw new Error(`Menu item "${it.menuItemId}" not found in catalog.`)
      }

      const qty = Math.max(1, Math.min(50, Math.floor(it.quantity || 1)))
      const authoritativePrice = serverMenuItem.price
      const authoritativePricePaise = toPaise(authoritativePrice)
      const lineTotalPaise = calculateLineTotalPaise(authoritativePricePaise, qty)
      const lineTotal = toRupees(lineTotalPaise)

      roundSubtotalPaise += lineTotalPaise

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

    const roundTaxPaise = calculateTaxPaise(roundSubtotalPaise, standardTaxRate)
    const roundTotalPaise = roundSubtotalPaise + roundTaxPaise

    const newRoundNumber = session.rounds.length + 1

    const newRound: OrderRoundRecord = {
      id: `round-${session.id}-${newRoundNumber}`,
      roundNumber: newRoundNumber,
      status: 'pending',
      taxRateSnapshot: standardTaxRate,
      subtotal: toRupees(roundSubtotalPaise),
      tax: toRupees(roundTaxPaise),
      total: toRupees(roundTotalPaise),
      specialInstructions,
      items: orderItems,
      idempotencyKey: cleanIdempotencyKey,
      createdAt: new Date().toISOString(),
    }

    session.rounds.push(newRound)
    this.recalculateSessionTotals(session)

    if (cleanIdempotencyKey) {
      const idempotencyId = `${sessionId}:${cleanIdempotencyKey}`
      this.idempotencyStore.set(idempotencyId, { session, newRound })
    }

    return { session, newRound }
  }

  /**
   * ATOMIC ORDER STATUS TRANSITION
   */
  updateOrderStatus(
    sessionId: string,
    roundId: string,
    newStatus: OrderStatus
  ): OrderRoundRecord {
    const session = this.sessions.get(sessionId)
    if (!session) throw new Error('Session not found.')

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
   * ATOMIC ORDER ITEM VOID
   */
  voidOrderItem(
    sessionId: string,
    roundId: string,
    itemId: string,
    reason: string = 'Out of Stock / Voided by Reception'
  ): GuestTabSession {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('Session not found.')
    }

    if (session.status === 'settled' || session.status === 'closed') {
      throw new Error(`Cannot void items from a tab that is already ${session.status}.`)
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
      return session
    }

    item.isVoided = true
    item.voidReason = reason

    let roundActiveSubtotalPaise = 0
    for (const it of round.items) {
      if (!it.isVoided) {
        roundActiveSubtotalPaise += toPaise(it.price) * it.quantity
      }
    }

    const roundTaxPaise = calculateTaxPaise(roundActiveSubtotalPaise, round.taxRateSnapshot)
    const roundTotalPaise = roundActiveSubtotalPaise + roundTaxPaise

    round.subtotal = toRupees(roundActiveSubtotalPaise)
    round.tax = toRupees(roundTaxPaise)
    round.total = toRupees(roundTotalPaise)

    this.recalculateSessionTotals(session)
    return session
  }

  /**
   * ATOMIC TAB SETTLEMENT & TAMPER-EVIDENT INVOICE GENERATION
   */
  settleAndCloseTab(
    sessionId: string,
    paymentMethod: 'room_folio' | 'credit_card' | 'cash' = 'room_folio',
    staffNote?: string
  ): GuestTabSession {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('Session not found.')
    }

    if (session.status === 'settled') {
      return session
    }

    if (!validateSessionTransition(session.status, 'settled')) {
      throw new Error(`Illegal Session Transition: Cannot settle session in status "${session.status}".`)
    }

    this.recalculateSessionTotals(session)

    this.invoiceCounter += 1
    const currentSeq = this.invoiceCounter

    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const cleanLocation = session.locationIdentifier.toUpperCase().replace(/[^A-Z0-9]/g, '')
    const invoiceNumber = `INV-RDC-${datePrefix}-${cleanLocation}-${currentSeq}`

    const settledAt = new Date().toISOString()

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

    const checksumPayload = [
      invoiceNumber,
      session.id,
      session.subtotal.toFixed(2),
      session.tax.toFixed(2),
      session.totalAmount.toFixed(2),
      paymentMethod,
      settledAt,
      lineItemsDigest,
    ].join(':')
    const invoiceChecksum = crypto.createHash('sha256').update(checksumPayload).digest('hex')

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

  private recalculateSessionTotals(session: GuestTabSession) {
    let accumulatedSubtotalPaise = 0
    let accumulatedTaxPaise = 0
    let totalItems = 0

    for (const round of session.rounds) {
      let roundActiveSubtotalPaise = 0

      for (const item of round.items) {
        if (!item.isVoided) {
          const itemTotalPaise = toPaise(item.price) * item.quantity
          item.subtotal = toRupees(itemTotalPaise)
          roundActiveSubtotalPaise += itemTotalPaise
          totalItems += item.quantity
        }
      }

      const roundTaxRate = round.taxRateSnapshot || 0.0825
      const roundTaxPaise = calculateTaxPaise(roundActiveSubtotalPaise, roundTaxRate)
      const roundTotalPaise = roundActiveSubtotalPaise + roundTaxPaise

      round.subtotal = toRupees(roundActiveSubtotalPaise)
      round.tax = toRupees(roundTaxPaise)
      round.total = toRupees(roundTotalPaise)

      accumulatedSubtotalPaise += roundActiveSubtotalPaise
      accumulatedTaxPaise += roundTaxPaise
    }

    session.subtotal = toRupees(accumulatedSubtotalPaise)
    session.tax = toRupees(accumulatedTaxPaise)
    session.totalAmount = toRupees(accumulatedSubtotalPaise + accumulatedTaxPaise)
    session.totalItemsCount = totalItems
    session.updatedAt = new Date().toISOString()
  }
}

declare global {
  // eslint-disable-next-line no-var
  var globalTabManager: ContinuousTabManager | undefined
}

export const tabManager = globalThis.globalTabManager || new ContinuousTabManager()
if (process.env.NODE_ENV !== 'production') {
  globalThis.globalTabManager = tabManager
}
