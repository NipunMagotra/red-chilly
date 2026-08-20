import 'server-only'
import crypto from 'crypto'

/**
 * Distributed Edge Redis Rate Limiter for 4-Digit Stay PIN Verification.
 * 
 * SECURITY & ARCHITECTURAL INVARIANTS:
 * 1. Production Mode (`NODE_ENV === 'production'`):
 *    - Uses Upstash Redis HTTP/REST API (serverless connectionless HTTP, zero TCP idle drop).
 *    - Sliding-window algorithm: 5 failed attempts per 15 minutes (900s).
 *    - Key format: `dinescan:pin-rate:${propertyId}:${locationIdentifier}` (prevents cross-tenant collisions).
 *    - FAIL-CLOSED POLICY: If Redis is unavailable or unconfigured in production, logins fail closed
 *      to strictly protect the 10,000-combination PIN space from brute force.
 * 2. Development Mode (`NODE_ENV !== 'production'`):
 *    - Falls back to in-memory Node.js Map if Upstash credentials are not set, allowing local dev.
 */

const MAX_FAILED_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const WINDOW_SECONDS = 900 // 15 minutes in seconds

export interface RateLimitResult {
  isLocked: boolean
  remainingSeconds: number
  attemptsLeft: number
  count: number
}

// In-Memory Dev Store
interface DevAttemptRecord {
  timestamps: number[]
  lockoutUntil: number | null
}
const devAttemptStore = new Map<string, DevAttemptRecord>()

function getRedisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    return null
  }

  return { url: url.replace(/\/$/, ''), token }
}

function buildRateLimitKey(propertyId: string, locationIdentifier: string): string {
  const cleanProp = propertyId.trim().toLowerCase()
  const cleanLoc = locationIdentifier.trim().toLowerCase()
  return `dinescan:pin-rate:${cleanProp}:${cleanLoc}`
}

/**
 * Execute atomic pipeline on Upstash Redis via HTTP REST
 */
async function executeUpstashPipeline(
  url: string,
  token: string,
  commands: (string | number)[][]
): Promise<unknown[]> {
  const response = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Upstash Redis HTTP error: ${response.status} ${response.statusText}`)
  }

  const results = (await response.json()) as Array<{ result?: unknown } | unknown>
  return results.map((r) => (r && typeof r === 'object' && 'result' in r ? r.result : r))
}

/**
 * Checks current rate limit status without recording an attempt
 */
export async function checkPinRateLimit(
  propertyId: string,
  locationIdentifier: string
): Promise<RateLimitResult> {
  const isProduction = process.env.NODE_ENV === 'production'
  const redisConfig = getRedisConfig()
  const key = buildRateLimitKey(propertyId, locationIdentifier)
  const now = Date.now()

  // 1. Production Mode: Redis HTTP REST with Fail-Closed Invariant
  if (isProduction || redisConfig) {
    if (!redisConfig) {
      console.error(
        `[CRITICAL_SECURITY_ALERT]: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN missing in production. Failing closed on PIN verification.`
      )
      return {
        isLocked: true,
        remainingSeconds: WINDOW_SECONDS,
        attemptsLeft: 0,
        count: MAX_FAILED_ATTEMPTS,
      }
    }

    try {
      const windowStart = now - WINDOW_MS
      const commands = [
        ['ZREMRANGEBYSCORE', key, '0', String(windowStart)],
        ['ZCARD', key],
        ['ZRANGE', key, '0', '0', 'WITHSCORES'],
      ]

      const [, countResult, oldestResult] = await executeUpstashPipeline(
        redisConfig.url,
        redisConfig.token,
        commands
      )

      const count = typeof countResult === 'number' ? countResult : 0

      if (count >= MAX_FAILED_ATTEMPTS) {
        let remainingSeconds = WINDOW_SECONDS
        if (Array.isArray(oldestResult) && oldestResult.length >= 2) {
          const oldestScore = Number(oldestResult[1])
          if (!isNaN(oldestScore)) {
            remainingSeconds = Math.max(1, Math.ceil((oldestScore + WINDOW_MS - now) / 1000))
          }
        }
        return {
          isLocked: true,
          remainingSeconds,
          attemptsLeft: 0,
          count,
        }
      }

      return {
        isLocked: false,
        remainingSeconds: 0,
        attemptsLeft: Math.max(0, MAX_FAILED_ATTEMPTS - count),
        count,
      }
    } catch (err) {
      console.error(
        `[CRITICAL_SECURITY_ALERT]: Upstash Redis network failure during PIN check. Failing closed to protect PIN space.`,
        err
      )
      // Strict Fail-Closed in production
      return {
        isLocked: true,
        remainingSeconds: WINDOW_SECONDS,
        attemptsLeft: 0,
        count: MAX_FAILED_ATTEMPTS,
      }
    }
  }

  // 2. Development Mode: In-Memory Sliding Window Fallback
  const record = devAttemptStore.get(key)
  if (!record) {
    return { isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_FAILED_ATTEMPTS, count: 0 }
  }

  // Filter expired timestamps
  const activeTimestamps = record.timestamps.filter((t) => now - t < WINDOW_MS)
  record.timestamps = activeTimestamps

  if (activeTimestamps.length >= MAX_FAILED_ATTEMPTS) {
    const oldest = activeTimestamps[0]
    const remainingSeconds = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000))
    return {
      isLocked: true,
      remainingSeconds,
      attemptsLeft: 0,
      count: activeTimestamps.length,
    }
  }

  return {
    isLocked: false,
    remainingSeconds: 0,
    attemptsLeft: MAX_FAILED_ATTEMPTS - activeTimestamps.length,
    count: activeTimestamps.length,
  }
}

/**
 * Records a failed PIN attempt atomically and returns updated lock status
 */
export async function recordPinFailedAttempt(
  propertyId: string,
  locationIdentifier: string
): Promise<RateLimitResult> {
  const isProduction = process.env.NODE_ENV === 'production'
  const redisConfig = getRedisConfig()
  const key = buildRateLimitKey(propertyId, locationIdentifier)
  const now = Date.now()
  const memberId = `${now}-${crypto.randomUUID().substring(0, 8)}`

  // 1. Production Mode: Atomic ZADD in Upstash Redis
  if (isProduction || redisConfig) {
    if (!redisConfig) {
      console.error(
        `[CRITICAL_SECURITY_ALERT]: Missing Redis credentials in production. Failing closed.`
      )
      return { isLocked: true, remainingSeconds: WINDOW_SECONDS, attemptsLeft: 0, count: MAX_FAILED_ATTEMPTS }
    }

    try {
      const windowStart = now - WINDOW_MS
      const commands = [
        ['ZREMRANGEBYSCORE', key, '0', String(windowStart)],
        ['ZADD', key, String(now), memberId],
        ['EXPIRE', key, String(WINDOW_SECONDS)],
        ['ZCARD', key],
        ['ZRANGE', key, '0', '0', 'WITHSCORES'],
      ]

      const [, , , countResult, oldestResult] = await executeUpstashPipeline(
        redisConfig.url,
        redisConfig.token,
        commands
      )

      const count = typeof countResult === 'number' ? countResult : 1
      const isLocked = count >= MAX_FAILED_ATTEMPTS

      let remainingSeconds = 0
      if (isLocked) {
        remainingSeconds = WINDOW_SECONDS
        if (Array.isArray(oldestResult) && oldestResult.length >= 2) {
          const oldestScore = Number(oldestResult[1])
          if (!isNaN(oldestScore)) {
            remainingSeconds = Math.max(1, Math.ceil((oldestScore + WINDOW_MS - now) / 1000))
          }
        }
      }

      return {
        isLocked,
        remainingSeconds,
        attemptsLeft: Math.max(0, MAX_FAILED_ATTEMPTS - count),
        count,
      }
    } catch (err) {
      console.error(
        `[CRITICAL_SECURITY_ALERT]: Upstash Redis write failure. Failing closed.`,
        err
      )
      return { isLocked: true, remainingSeconds: WINDOW_SECONDS, attemptsLeft: 0, count: MAX_FAILED_ATTEMPTS }
    }
  }

  // 2. Development Mode
  let record = devAttemptStore.get(key)
  if (!record) {
    record = { timestamps: [], lockoutUntil: null }
    devAttemptStore.set(key, record)
  }

  const activeTimestamps = record.timestamps.filter((t) => now - t < WINDOW_MS)
  activeTimestamps.push(now)
  record.timestamps = activeTimestamps

  const isLocked = activeTimestamps.length >= MAX_FAILED_ATTEMPTS
  const oldest = activeTimestamps[0]
  const remainingSeconds = isLocked ? Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000)) : 0

  return {
    isLocked,
    remainingSeconds,
    attemptsLeft: Math.max(0, MAX_FAILED_ATTEMPTS - activeTimestamps.length),
    count: activeTimestamps.length,
  }
}

/**
 * Resets failed attempts upon successful PIN authentication
 */
export async function resetPinFailedAttempts(
  propertyId: string,
  locationIdentifier: string
): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production'
  const redisConfig = getRedisConfig()
  const key = buildRateLimitKey(propertyId, locationIdentifier)

  if (isProduction || redisConfig) {
    if (!redisConfig) return
    try {
      await fetch(`${redisConfig.url}/del/${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${redisConfig.token}`,
        },
        cache: 'no-store',
      })
    } catch (err) {
      console.error(`[RATE_LIMIT_RESET_ERROR]: Failed to clear Redis key ${key}`, err)
    }
    return
  }

  devAttemptStore.delete(key)
}
