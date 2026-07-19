import { describe, it, expect } from 'vitest';
import { refundAnalysis } from './analyze';
import type { Tx } from '../chaindata';

const ROOT = '0xScamRoot';
function tx(from: string, to: string, value: bigint, ts: number): Tx {
  return { hash: `${from}-${to}-${ts}`, timestamp: ts, inputs: [{ address: from, value }], outputs: [{ address: to, value }] };
}

describe('refundAnalysis', () => {
  it('reports zero refunds for a classic giveaway scam', () => {
    const now = 1_700_000_000;
    const txs: Tx[] = [
      tx('0xVictimA', ROOT, 1_000n, now - 100),
      tx('0xVictimB', ROOT, 2_000n, now - 90),
      tx('0xVictimC', ROOT, 500n, now - 80),
      // root moves everything out to a fresh address, never back to victims
      tx(ROOT, '0xLaunder', 3_400n, now - 10),
    ];
    const r = refundAnalysis('eth', ROOT, txs);
    expect(r.senderCount).toBe(3);
    expect(r.refundedCount).toBe(0);
    expect(r.refundRate).toBe(0);
  });

  it('detects genuine refunds when they exist', () => {
    const now = 1_700_000_000;
    const txs: Tx[] = [
      tx('0xUserA', ROOT, 1_000n, now - 100),
      tx(ROOT, '0xUserA', 900n, now - 50), // refunded back to sender
    ];
    const r = refundAnalysis('eth', ROOT, txs);
    expect(r.senderCount).toBe(1);
    expect(r.refundedCount).toBe(1);
    expect(r.refundRate).toBe(1);
  });
});
