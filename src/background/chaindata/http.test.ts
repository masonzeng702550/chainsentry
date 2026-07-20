import { describe, it, expect } from 'vitest';
import { RateLimiter } from './http';

describe('RateLimiter', () => {
  it('grants burst capacity immediately', async () => {
    const rl = new RateLimiter(5, 3);
    const start = Date.now();
    await rl.acquire();
    await rl.acquire();
    await rl.acquire();
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('queues beyond the burst and drains without losing callers', async () => {
    const rl = new RateLimiter(50, 2); // fast rate so the test stays quick
    await rl.acquire();
    await rl.acquire();

    let done = 0;
    const waiters = Array.from({ length: 5 }, () => rl.acquire().then(() => void done++));
    // All five exceed the burst, so they must be queued rather than resolved.
    expect(rl.pending()).toBe(5);

    await Promise.all(waiters);
    expect(done).toBe(5);
    expect(rl.pending()).toBe(0);
  });

  it('runs a single drain timer regardless of how many callers queue', async () => {
    // Regression: each queued caller used to start its own timer chain, and the
    // parallel chains drained tokens faster than the configured rate.
    const real = globalThis.setTimeout;
    let live = 0;
    let peak = 0;
    (globalThis as any).setTimeout = (fn: () => void, ms?: number) => {
      live++;
      peak = Math.max(peak, live);
      return real(() => {
        live--;
        fn();
      }, ms);
    };
    try {
      const rl = new RateLimiter(50, 1);
      await rl.acquire();
      await Promise.all(Array.from({ length: 8 }, () => rl.acquire()));
      expect(peak).toBe(1);
    } finally {
      (globalThis as any).setTimeout = real;
    }
  });
});
