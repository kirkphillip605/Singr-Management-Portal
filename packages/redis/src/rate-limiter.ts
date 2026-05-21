import { redis } from './client'

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number // Unix timestamp in ms
}

/**
 * Redis-backed sliding window rate limiter.
 *
 * @param key      Unique identifier (e.g. `ratelimit:api:${ip}`)
 * @param max      Maximum requests allowed in the window
 * @param windowMs Window duration in milliseconds
 */
export async function rateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now()
  const windowStart = now - windowMs

  const pipeline = redis.pipeline()

  // Remove entries outside the current window
  pipeline.zremrangebyscore(key, 0, windowStart)
  // Count current entries
  pipeline.zcard(key)
  // Add the current request
  pipeline.zadd(key, now.toString(), `${now}:${Math.random().toString(36).slice(2)}`)
  // Set expiry on the key
  pipeline.pexpire(key, windowMs)

  const results = await pipeline.exec()

  // zcard result is at index 1
  const currentCount = (results?.[1]?.[1] as number) ?? 0
  const allowed = currentCount < max
  const remaining = Math.max(0, max - currentCount - (allowed ? 1 : 0))
  const resetAt = now + windowMs

  // If not allowed, remove the entry we just added
  if (!allowed) {
    await redis.zremrangebyscore(key, now, now)
  }

  return { allowed, remaining, resetAt }
}

/**
 * Express/Next.js-style rate limit headers.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': result.remaining.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
    'Retry-After': result.allowed
      ? ''
      : Math.ceil((result.resetAt - Date.now()) / 1000).toString(),
  }
}
