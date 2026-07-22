import { describe, it, expect, vi } from 'vitest';

// Simulate a provider that cannot answer (e.g. Etherscan without an API key).
vi.mock('../chaindata', () => ({
  getSummary: vi.fn(async () => {
    throw new Error('Missing/Invalid API Key');
  }),
  getTransactions: vi.fn(async () => {
    throw new Error('Missing/Invalid API Key');
  }),
}));

import { analyzeAddress, briefAddress } from './index';

const ADDR = '0x28C6c06298d514Db089934071355E5743bf21d60';

describe('unreachable chain data', () => {
  it('reports unknown rather than a clean score', async () => {
    const r = await analyzeAddress('eth', ADDR, {
      hops: 1,
      perNodeTxLimit: 10,
      onDangerPage: false,
    });
    expect(r.dataAvailable).toBe(false);
    expect(r.risk).toBe('unknown');
    expect(r.score).toBe(0);
  });

  it('explains why it could not check', async () => {
    // Regression: the UI showed "Not checked" with an empty reason list, so the
    // user was never told the lookup failed or that a key is needed.
    const r = await analyzeAddress('eth', ADDR, {
      hops: 1,
      perNodeTxLimit: 10,
      onDangerPage: false,
    });
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.reasons.join(' ')).toMatch(/not checked|could not reach/i);
    expect(r.reasons.join(' ')).toMatch(/api key/i);
  });

  it('marks the inline badge as unchecked too', async () => {
    const b = await briefAddress('eth', ADDR, false);
    expect(b.dataAvailable).toBe(false);
    expect(b.risk).toBe('unknown');
    expect(b.reasons.length).toBeGreaterThan(0);
  });
});
