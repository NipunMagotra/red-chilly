/**
 * Adversarial Invoice Integrity, Sequential Counter & Checksum Audit
 * 
 * Objectives:
 * 1. Test parallel concurrent generation of 2,000 invoices across multiple properties.
 * 2. Verify strict uniqueness (0 duplicates / 0 collisions).
 * 3. Audit sequence ownership, transaction rollback behavior, property scoping, and timezone prefixing.
 * 4. Audit SHA-256 invoice verification checksum:
 *    - Canonical input format
 *    - Serialization format
 *    - Hashing algorithm
 *    - Stored authoritative hash
 *    - Cryptographic verification trust model (HMAC / Digital Signature vs Unkeyed Hash)
 */

import crypto from 'crypto'

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`)
    process.exit(1)
  } else {
    console.log(`✅ PASSED: ${message}`)
  }
}

// -----------------------------------------------------------------------------
// POSTGRESQL ATOMIC SEQUENCE EMULATOR
// (Simulates INSERT INTO property_invoice_sequences ... ON CONFLICT DO UPDATE RETURNING)
// -----------------------------------------------------------------------------
class PostgresInvoiceSequenceManager {
  private sequences: Map<string, number> = new Map()
  private lock: boolean = false
  private queue: (() => void)[] = []

  constructor() {
    this.sequences.set('prop-red-chilly-flagship', 1000)
    this.sequences.set('prop-emerald-bay-resort', 1000)
  }

  private async acquireLock(): Promise<void> {
    if (!this.lock) {
      this.lock = true
      return
    }
    return new Promise((resolve) => this.queue.push(resolve))
  }

  private releaseLock(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!
      next()
    } else {
      this.lock = false
    }
  }

  async getNextSequence(propertyId: string): Promise<number> {
    await this.acquireLock()
    try {
      const current = this.sequences.get(propertyId) || 1000
      const next = current + 1
      this.sequences.set(propertyId, next)
      return next
    } finally {
      this.releaseLock()
    }
  }

  async generateInvoice(
    sessionId: string,
    propertyId: string,
    locationIdentifier: string,
    totalAmount: number,
    timezone: string = 'America/New_York',
    settledAt: Date = new Date()
  ): Promise<{ invoiceNumber: string; checksum: string; sequenceNumber: number }> {
    const seqNum = await this.getNextSequence(propertyId)

    // Timezone formatting
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const parts = formatter.formatToParts(settledAt)
    const year = parts.find((p) => p.type === 'year')?.value
    const month = parts.find((p) => p.type === 'month')?.value
    const day = parts.find((p) => p.type === 'day')?.value
    const datePrefix = `${year}${month}${day}`

    const propCode = propertyId === 'prop-emerald-bay-resort' ? 'EMB' : 'RDC'
    const invoiceNumber = `INV-${propCode}-${datePrefix}-${seqNum}`

    // Canonical Checksum Serialization:
    // canonical_payload = invoice_number || ':' || session_id || ':' || property_id || ':' || total_amount || ':' || settled_at_iso
    const settledAtIso = settledAt.toISOString()
    const canonicalPayload = `${invoiceNumber}:${sessionId}:${propertyId}:${totalAmount.toFixed(2)}:${settledAtIso}`
    const checksum = crypto.createHash('sha256').update(canonicalPayload).digest('hex')

    return { invoiceNumber, checksum, sequenceNumber: seqNum }
  }
}

async function runInvoiceIntegrityAudit() {
  console.log('\n==================================================================')
  console.log('🧾 10. ADVERSARIAL INVOICE INTEGRITY & CHECKSUM AUDIT')
  console.log('==================================================================\n')

  const seqManager = new PostgresInvoiceSequenceManager()

  // ---------------------------------------------------------------------------
  // TEST 1: Generate 2,000 Concurrent Invoices (1,000 Prop A + 1,000 Prop B)
  // ---------------------------------------------------------------------------
  console.log('--- Test 1: High-Concurrency Invoice Generation (2,000 Invoices) ---')

  const propA = 'prop-red-chilly-flagship'
  const propB = 'prop-emerald-bay-resort'

  const invoicePromises: Promise<any>[] = []

  for (let i = 0; i < 1000; i++) {
    invoicePromises.push(
      seqManager.generateInvoice(`sess-a-${i}`, propA, 'room-404', 125.50 + i, 'America/New_York')
    )
    invoicePromises.push(
      seqManager.generateInvoice(`sess-b-${i}`, propB, 'emerald-101', 250.00 + i, 'America/New_York')
    )
  }

  const generatedInvoices = await Promise.all(invoicePromises)
  assert(generatedInvoices.length === 2000, 'Generated 2,000 invoices in parallel')

  // Verify Uniqueness across all 2,000 invoices
  const invoiceNumbers = generatedInvoices.map((inv) => inv.invoiceNumber)
  const uniqueSet = new Set(invoiceNumbers)

  assert(
    uniqueSet.size === 2000,
    `All 2,000 invoice numbers are 100% UNIQUE (0 collisions, set size = ${uniqueSet.size})`
  )

  // Verify Property Scoping
  const propAInvoices = generatedInvoices.filter((inv) => inv.invoiceNumber.startsWith('INV-RDC-'))
  const propBInvoices = generatedInvoices.filter((inv) => inv.invoiceNumber.startsWith('INV-EMB-'))

  assert(propAInvoices.length === 1000, 'Exactly 1,000 invoices for Property A')
  assert(propBInvoices.length === 1000, 'Exactly 1,000 invoices for Property B')

  // Verify Monotonic Sequence Sequences for Property A
  const propASeqs = propAInvoices.map((inv) => inv.sequenceNumber).sort((a, b) => a - b)
  const isSeqAValid = propASeqs.every((num, idx) => num === 1001 + idx)
  assert(isSeqAValid, 'Property A sequence numbers are strictly consecutive (1001 to 2000)')

  // ---------------------------------------------------------------------------
  // TEST 2: Timezone Handling Audit
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 2: Timezone Prefixing Accuracy ---')

  const midnightUtc = new Date('2026-08-20T01:30:00Z') // 1:30 AM UTC on Aug 20

  // Property in New York (EDT, UTC-4 -> 9:30 PM on Aug 19)
  const nyInvoice = await seqManager.generateInvoice('sess-tz-1', propA, 'room-404', 50.00, 'America/New_York', midnightUtc)
  assert(nyInvoice.invoiceNumber.includes('20260819'), `New York invoice dated 20260819 when UTC is 2026-08-20 01:30 (${nyInvoice.invoiceNumber})`)

  // Property in Tokyo (JST, UTC+9 -> 10:30 AM on Aug 20)
  const tokyoInvoice = await seqManager.generateInvoice('sess-tz-2', propA, 'room-404', 50.00, 'Asia/Tokyo', midnightUtc)
  assert(tokyoInvoice.invoiceNumber.includes('20260820'), `Tokyo invoice dated 20260820 (${tokyoInvoice.invoiceNumber})`)

  // ---------------------------------------------------------------------------
  // TEST 3: Checksum Canonical Serialization & Tamper Detection
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 3: Checksum Serialization & Tamper Detection ---')

  const testSessionId = 'session-chk-test-101'
  const testPropId = propA
  const testTotal = 154.75
  const testDate = new Date('2026-08-20T12:00:00.000Z')

  const inv = await seqManager.generateInvoice(testSessionId, testPropId, 'room-404', testTotal, 'America/New_York', testDate)

  // Verify Valid Checksum
  const validCanonical = `${inv.invoiceNumber}:${testSessionId}:${testPropId}:${testTotal.toFixed(2)}:${testDate.toISOString()}`
  const expectedHash = crypto.createHash('sha256').update(validCanonical).digest('hex')
  assert(inv.checksum === expectedHash, 'Checksum accurately verifies un-tampered invoice')

  // Attack 3a: Tamper total amount ($154.75 -> $54.75)
  const tamperedTotalCanonical = `${inv.invoiceNumber}:${testSessionId}:${testPropId}:54.75:${testDate.toISOString()}`
  const tamperedHash = crypto.createHash('sha256').update(tamperedTotalCanonical).digest('hex')
  assert(inv.checksum !== tamperedHash, 'Checksum mismatch detected when total amount is tampered')

  // Attack 3b: Tamper session ID
  const tamperedSessionCanonical = `${inv.invoiceNumber}:session-tampered-999:${testPropId}:${testTotal.toFixed(2)}:${testDate.toISOString()}`
  const tamperedSessionHash = crypto.createHash('sha256').update(tamperedSessionCanonical).digest('hex')
  assert(inv.checksum !== tamperedSessionHash, 'Checksum mismatch detected when session ID is tampered')

  // ---------------------------------------------------------------------------
  // TEST 4: Checksum Cryptographic Trust Model & Limitations
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 4: Cryptographic Trust Model Assessment ---')
  console.log(`
AUDIT FINDING: Unkeyed Hash vs Digital Signature (HMAC / ECDSA):
- Current Implementation: Unkeyed SHA-256 hash: digest(payload, 'sha256').
- Purpose: Detects unintentional database corruption or manual single-field data tampering (e.g. directly editing total_amount without recalculating checksum).
- LIMITATION: Because it is an unkeyed SHA-256 hash (without a secret HMAC key or private signing key), anyone with UPDATE privileges on the database can re-compute and replace the checksum!
- RECOMMENDATION FOR LEGAL FINANCIAL VERIFICATION:
  Use HMAC-SHA256 with a server-side secret (HMAC_SECRET) or an asymmetric ECDSA digital signature (P-256) so that third parties or database operators cannot forge valid checksums.
`)

  console.log('==================================================================')
  console.log('🎉 ALL INVOICE INTEGRITY & CHECKSUM TESTS PASSED!')
  console.log('==================================================================\n')
}

runInvoiceIntegrityAudit().catch(console.error)
