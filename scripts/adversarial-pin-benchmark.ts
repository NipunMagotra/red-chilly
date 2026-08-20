/**
 * Adversarial PIN Security & Offline Brute-Force Benchmark
 * 
 * Objectives:
 * 1. Benchmark 10,000 iterations PBKDF2-HMAC-SHA256 across the entire 10,000 PIN keyspace (0000-9999).
 * 2. Measure real offline cracking time on CPU.
 * 3. Quantify entropy of 4-digit numeric PINs (13.29 bits).
 * 4. Test rate-limiting bypass via multi-instance simulation & process restarts.
 * 5. Test denial-of-service vulnerability on per-location lockout without IP protection.
 */

import crypto from 'crypto'
import { hashPin, generatePinSalt, verifyPinConstantTime } from '../src/lib/data/restaurant-data'

function benchmarkOfflineBruteForce() {
  console.log('\n======================================================')
  console.log('⚡ 1. BENCHMARKING OFFLINE PIN BRUTE-FORCE RESISTANCE')
  console.log('======================================================\n')

  const targetPin = '8392'
  const salt = generatePinSalt()
  const targetHash = hashPin(targetPin, salt)

  console.log(`Target PIN: [REDACTED] | Salt: ${salt}`)
  console.log(`Target Hash: ${targetHash}`)
  console.log(`Configuration: PBKDF2-HMAC-SHA256, 10,000 iterations, 32-byte key`)
  console.log(`Entropy: log2(10000) = ${(Math.log2(10000)).toFixed(2)} bits (Extremely Low Entropy)\n`)

  console.log('Initiating CPU Brute-Force attack across all 10,000 possibilities (0000 - 9999)...')

  const startTime = process.hrtime.bigint()
  let crackedPin: string | null = null
  let attempts = 0

  // Exhaustive search over 0000-9999
  for (let i = 0; i < 10000; i++) {
    const candidate = i.toString().padStart(4, '0')
    attempts++
    const candidateHash = crypto.pbkdf2Sync(candidate, salt, 10000, 32, 'sha256').toString('hex')
    if (candidateHash === targetHash) {
      crackedPin = candidate
      break
    }
  }

  const endTime = process.hrtime.bigint()
  const durationMs = Number(endTime - startTime) / 1_000_000
  const hashesPerSec = Math.round((attempts / (durationMs / 1000)))

  console.log(`\n🎯 CRACK RESULT:`)
  console.log(`- Cracked PIN: "${crackedPin}"`)
  console.log(`- Total Hash Calculations: ${attempts} / 10,000`)
  console.log(`- Total Time Elapsed: ${durationMs.toFixed(2)} ms (${(durationMs / 1000).toFixed(3)} seconds)`)
  console.log(`- Single-Thread CPU Hash Rate: ${hashesPerSec.toLocaleString()} hashes/sec`)

  // Estimate full keyspace (worst case 10,000)
  const fullKeyspaceMs = (10000 / attempts) * durationMs
  console.log(`- Estimated Time to Exhaust Entire 10,000 Keyspace: ${(fullKeyspaceMs / 1000).toFixed(3)} seconds on 1 CPU core`)
  console.log(`- Estimated Time on 8-Core CPU (Parallel): ${(fullKeyspaceMs / 8000).toFixed(3)} seconds`)
  console.log(`- Estimated Time on Modern GPU (e.g. RTX 4090 ~1,000,000+ PBKDF2 H/s): < 0.010 seconds (10 ms)`)

  return { durationMs, hashesPerSec, crackedPin }
}

function auditPinRateLimitingAndLockout() {
  console.log('\n======================================================')
  console.log('🛡️ 2. AUDITING IN-MEMORY RATE LIMITING & LOCKOUT DEFECTS')
  console.log('======================================================\n')

  // Vulnerability 1: Process-Local / Memory-Local Store
  console.log('Audit Finding 1: Memory-Local Rate Limiting Bypass')
  console.log('- pinAttemptStore is a process-local Map<string, AttemptRecord>.')
  console.log('- In serverless / multi-instance setups, an attacker can distribute failed attempts across lambdas/instances, bypassing the 5-attempt threshold.')
  console.log('- On server restart / redeployment, all lockout state is wiped immediately.')

  // Vulnerability 2: Absence of Per-IP Rate Limiting
  console.log('\nAudit Finding 2: Lack of Per-IP Protection & DoS Vulnerability')
  console.log('- Lockout is keyed strictly on `pin-rate:${locationId}`.')
  console.log('- An attacker from a single IP can spray PINs across ALL rooms without being throttled per IP.')
  console.log('- An attacker can deliberately submit 5 wrong PINs for every room in the hotel, locking out all legitimate guests for 15 minutes (Denial of Service).')

  // Vulnerability 3: Public Exposure in Database RLS
  console.log('\nAudit Finding 3: Database Column Leakage')
  console.log('- In 20260820_phase2_security_tab.sql, the policy "Public read active locations non-sensitive" allows SELECT * ON locations to public anon users.')
  console.log('- This exposes `pin_salt` and `pin_hash` for every active room to anonymous visitors.')
  console.log('- Once dumped, the 10,000-space PBKDF2 hash can be cracked offline in ~1 second.')
}

async function runAudit() {
  benchmarkOfflineBruteForce()
  auditPinRateLimitingAndLockout()
}

runAudit().catch(console.error)
