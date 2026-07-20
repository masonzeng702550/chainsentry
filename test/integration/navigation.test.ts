// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { watchNavigation } from '@/content/navigation';

afterEach(() => {
  vi.useRealTimers();
  history.pushState({}, '', '/');
});

describe('watchNavigation', () => {
  it('fires when a SPA route change swaps the URL without a document load', () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    const stop = watchNavigation((u) => seen.push(u), 100);

    history.pushState({}, '', '/watch?v=scam-livestream');
    vi.advanceTimersByTime(150);

    expect(seen).toHaveLength(1);
    expect(seen[0]).toContain('/watch?v=scam-livestream');
    stop();
  });

  it('does not fire while the URL is unchanged', () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    const stop = watchNavigation(() => seen.push('x'), 100);

    vi.advanceTimersByTime(1000);

    expect(seen).toHaveLength(0);
    stop();
  });

  it('reports each successive navigation exactly once', () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    const stop = watchNavigation((u) => seen.push(u), 100);

    history.pushState({}, '', '/watch?v=one');
    vi.advanceTimersByTime(150);
    // Polling again with no change must not re-fire for the same URL.
    vi.advanceTimersByTime(300);
    history.pushState({}, '', '/watch?v=two');
    vi.advanceTimersByTime(150);

    expect(seen).toHaveLength(2);
    expect(seen[1]).toContain('v=two');
    stop();
  });

  it('stops firing after the returned disposer runs', () => {
    vi.useFakeTimers();
    const seen: string[] = [];
    const stop = watchNavigation(() => seen.push('x'), 100);
    stop();

    history.pushState({}, '', '/watch?v=after-stop');
    vi.advanceTimersByTime(500);

    expect(seen).toHaveLength(0);
  });
});
