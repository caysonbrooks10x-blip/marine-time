/**
 * Simple in-memory rate limiter for serverless API routes.
 *
 * Note: each serverless instance has its own Map, so this isn't
 * globally consistent across instances. For stronger guarantees,
 * use Upstash Redis or similar. This still blocks rapid brute-force
 * within a single instance lifetime.
 */

const store = new Map<string, { count: number; resetAt: number }>()

// Periodically clean expired entries to prevent memory leaks
const CLEANUP_INTERVAL = 60_000
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key)
  }
}

export function checkRateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  cleanup()
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterMs: 0 }
  }

  if (entry.count >= maxAttempts) {
    return { allowed: false, retryAfterMs: entry.resetAt - now }
  }

  entry.count++
  return { allowed: true, retryAfterMs: 0 }
}
