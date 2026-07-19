// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { detectPageSignals } from '@/content/signals';
import { scanText } from '@/shared/address';
import { findFeedContainers, isCyclicSequence, hashRow } from '@/content/fakefeed-core';
import { detectImpersonation } from '@/shared/impersonation';
import { BRAND_ALLOWLIST } from '@/shared/brands';

const FIXTURE = resolve(__dirname, '../fixtures/scam-giveaway.html');

/** Load only the <body> markup (no script execution) into jsdom's document. */
function loadFixtureBody(): string {
  const html = readFileSync(FIXTURE, 'utf8');
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)![1];
  document.body.innerHTML = body.replace(/<script[\s\S]*?<\/script>/gi, '');
  return document.body.innerText || document.body.textContent || '';
}

describe('scam giveaway page — end to end detection', () => {
  let text = '';
  beforeAll(() => {
    text = loadFixtureBody();
  });

  it('flags giveaway + countdown + celebrity signals', () => {
    const sig = detectPageSignals(text);
    expect(sig.giveawayHit).toBe(true);
    expect(sig.countdownHit).toBe(true);
    expect(sig.celebrityHit).toBe(true);
  });

  it('detects the wallet addresses embedded in the page', () => {
    const found = scanText(text, { chains: { btc: true, eth: true, tron: true, sol: false } });
    const addrs = found.map((f) => f.address);
    expect(addrs).toContain('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
    expect(addrs).toContain('0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936');
    // both chains represented
    expect(new Set(found.map((f) => f.chain))).toEqual(new Set(['btc', 'eth']));
  });

  it('identifies the "live transactions" widget as a feed candidate', () => {
    const feeds = findFeedContainers(document);
    expect(feeds.length).toBeGreaterThanOrEqual(1);
    expect(feeds[0].rows.length).toBeGreaterThanOrEqual(5);
  });

  it('recognises a replayed fixed-array ticker as cyclic', () => {
    // Simulate the inline script replaying the same 6 rows in a loop.
    const base = ['a', 'b', 'c', 'd', 'e', 'f'];
    const seq: string[] = [];
    for (let i = 0; i < 24; i++) seq.push(hashRow(base[i % base.length]));
    expect(isCyclicSequence(seq)).toBe(true);
    // Genuinely unique live data should not look cyclic.
    const live = Array.from({ length: 24 }, (_, i) => hashRow('unique-' + i));
    expect(isCyclicSequence(live)).toBe(false);
  });
});

describe('link guard — impersonation on the same campaign', () => {
  it('flags a typosquat of tesla.com', () => {
    expect(detectImpersonation('teslla.com', 'teslla.com', BRAND_ALLOWLIST)).toBe('typosquat');
  });
  it('flags a subdomain spoof', () => {
    expect(
      detectImpersonation('tesla.claim-event.io', 'claim-event.io', BRAND_ALLOWLIST),
    ).toBe('subdomain_spoof');
  });
  it('flags a cyrillic homoglyph of tesla.com', () => {
    // "teslа.com" with a Cyrillic 'а'
    expect(detectImpersonation('teslа.com', 'teslа.com', BRAND_ALLOWLIST)).toBe('homoglyph');
  });
  it('does not flag the legitimate brand domain', () => {
    expect(detectImpersonation('tesla.com', 'tesla.com', BRAND_ALLOWLIST)).toBeNull();
  });
});
