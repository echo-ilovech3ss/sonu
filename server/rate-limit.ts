interface Window {
  count: number;
  resetAt: number;
}

/**
 * Small in-process fixed-window limiter. This is intentionally per-instance:
 * a single Bun process is the deployment target. A multi-instance deployment
 * should move counters to Redis or the database.
 */
export class FixedWindowLimiter {
  private readonly hits = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  take(key: string): boolean {
    const now = Date.now();

    if (this.hits.size > 5_000) this.prune(now);

    const current = this.hits.get(key);
    if (!current || current.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (current.count >= this.limit) return false;

    current.count += 1;
    return true;
  }

  private prune(now: number): void {
    for (const [key, window] of this.hits) {
      if (window.resetAt <= now) this.hits.delete(key);
    }

    if (this.hits.size > 10_000) this.hits.clear();
  }
}
