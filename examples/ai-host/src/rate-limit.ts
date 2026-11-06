export interface FixedWindowOptions {
  readonly limit: number
  readonly windowMs: number
  readonly maxEntries?: number
  readonly now?: () => number
}

interface Window {
  count: number
  startedAt: number
  lastSeenAt: number
}

/** Bounded fixed-window limiter for requests, sessions and SSE connections. */
export class FixedWindowLimiter {
  private readonly limit: number
  private readonly windowMs: number
  private readonly maxEntries: number
  private readonly now: () => number
  private readonly windows = new Map<string, Window>()

  constructor(options: FixedWindowOptions) {
    this.limit = options.limit
    this.windowMs = options.windowMs
    this.maxEntries = options.maxEntries ?? 10_000
    this.now = options.now ?? Date.now
  }

  allow(key: string): boolean {
    const now = this.now()
    const current = this.windows.get(key)
    if (!current || current.startedAt + this.windowMs <= now) {
      this.windows.set(key, {
        count: 1,
        startedAt: now,
        lastSeenAt: now,
      })
      this.prune(now)
      return true
    }
    current.lastSeenAt = now
    if (current.count >= this.limit) {
      this.prune(now)
      return false
    }
    current.count += 1
    this.prune(now)
    return true
  }

  size(): number {
    return this.windows.size
  }

  private prune(now: number): void {
    for (const [key, window] of this.windows) {
      if (window.startedAt + this.windowMs <= now) this.windows.delete(key)
    }
    while (this.windows.size > this.maxEntries) {
      const oldest = this.windows.keys().next().value
      if (oldest === undefined) break
      this.windows.delete(oldest)
    }
  }
}
