// Token-bucket rate limiter + fetch helper with timeout and simple retry/backoff.

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private queue: Array<() => void> = [];

  constructor(
    private readonly ratePerSec: number,
    private readonly burst: number,
  ) {
    this.tokens = burst;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.burst, this.tokens + elapsed * this.ratePerSec);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    await new Promise<void>((resolve) => {
      this.queue.push(resolve);
      this.schedule();
    });
  }

  private schedule() {
    const waitMs = Math.max(50, (1 / this.ratePerSec) * 1000);
    setTimeout(() => {
      this.refill();
      while (this.tokens >= 1 && this.queue.length) {
        this.tokens -= 1;
        this.queue.shift()!();
      }
      if (this.queue.length) this.schedule();
    }, waitMs);
  }
}

export async function getJson<T>(
  url: string,
  opts: { timeoutMs?: number; retries?: number; headers?: Record<string, string> } = {},
): Promise<T> {
  const { timeoutMs = 8000, retries = 2, headers } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers });
      clearTimeout(timer);
      if (res.status === 429) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return (await res.json()) as T;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      await sleep(300 * (attempt + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
