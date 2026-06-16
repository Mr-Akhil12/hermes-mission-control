const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

// Periodic cleanup of expired entries to prevent memory leaks
let cleanupScheduled = false

function scheduleCleanup() {
  if (cleanupScheduled) return
  cleanupScheduled = true
  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of rateLimitMap) {
      if (now > record.resetTime) {
        rateLimitMap.delete(key)
      }
    }
  }, 60000) // Run every 60s
}

scheduleCleanup()

export function rateLimit(
  key: string,
  limit: number = 60,
  windowMs: number = 60000
): { success: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now()
  const record = rateLimitMap.get(key)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return { success: true, remaining: limit - 1 }
  }

  if (record.count >= limit) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000)
    return { success: false, remaining: 0, retryAfter }
  }

  record.count++
  return { success: true, remaining: limit - record.count }
}
