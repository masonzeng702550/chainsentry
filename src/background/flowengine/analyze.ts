import type { Chain } from '@/shared/chains';
import type { RefundAnalysis } from '@/shared/messages';
import type { Tx } from '../chaindata';
import { lookupEntity } from '../entities';
import type { RawGraph } from './graph';

const DAY = 86400;

/**
 * Refund verification — the core "send 1 get 2 back" buster.
 * senders  = external addresses that sent INTO root
 * refunded = senders that later received anything back FROM root
 */
export function refundAnalysis(
  chain: Chain,
  root: string,
  rootTxs: Tx[],
  windowSec = 30 * DAY,
): RefundAnalysis {
  const now = maxTs(rootTxs);
  const cutoff = now - windowSec;
  const senders = new Map<string, bigint>(); // addr -> received from them
  const paidOutTo = new Map<string, bigint>(); // addr -> we sent them
  const inTs = new Map<string, number>();
  const holdTimes: number[] = [];
  let totalIn = 0n;
  let totalOut = 0n;

  for (const tx of rootTxs) {
    if (tx.timestamp < cutoff) continue;
    const rootIsRecipient = tx.outputs.some((o) => eq(o.address, root, chain));
    const rootIsSender = tx.inputs.some((i) => eq(i.address, root, chain));
    if (rootIsRecipient) {
      for (const inp of tx.inputs) {
        if (eq(inp.address, root, chain)) continue;
        if (lookupEntity(chain, inp.address)) continue; // ignore exchange/mixer counterparts
        senders.set(inp.address, (senders.get(inp.address) ?? 0n) + inp.value);
        totalIn += inp.value;
        if (!inTs.has(inp.address)) inTs.set(inp.address, tx.timestamp);
      }
    }
    if (rootIsSender) {
      for (const out of tx.outputs) {
        if (eq(out.address, root, chain)) continue;
        paidOutTo.set(out.address, (paidOutTo.get(out.address) ?? 0n) + out.value);
        totalOut += out.value;
        const t0 = inTs.get(out.address);
        if (t0 !== undefined && tx.timestamp >= t0) holdTimes.push(tx.timestamp - t0);
      }
    }
  }

  let refundedCount = 0;
  let refundValue = 0n;
  for (const s of senders.keys()) {
    const back = paidOutTo.get(s);
    if (back && back > 0n) {
      refundedCount++;
      refundValue += back;
    }
  }

  const senderCount = senders.size;
  return {
    senderCount,
    refundedCount,
    refundRate: senderCount ? refundedCount / senderCount : 0,
    refundValueRatio: totalIn > 0n ? Number(refundValue) / Number(totalIn) : 0,
    medianHoldTimeSec: holdTimes.length ? median(holdTimes) : null,
  };
}

/** Cycle detection: DFS on aggregated edges (depth<=4) for paths returning to root. */
export function detectCycles(g: RawGraph, maxDepth = 4): string[][] {
  const adj = new Map<string, { to: string; firstTs: number; lastTs: number }[]>();
  for (const e of g.edges.values()) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from)!.push({ to: e.to, firstTs: e.firstTs, lastTs: e.lastTs });
  }
  const cycles: string[][] = [];
  const path: string[] = [g.root];

  const dfs = (node: string, depth: number, minTs: number) => {
    if (cycles.length >= 5 || depth > maxDepth) return;
    for (const nb of adj.get(node) ?? []) {
      if (nb.lastTs < minTs) continue; // must be time-forward
      if (nb.to === g.root) {
        // Close the loop only if the round trip completes inside the window.
        // The first hop's edge must exist; bail out rather than compare against
        // undefined, which silently produces NaN and drops every cycle.
        const firstHop = path.length >= 2 ? g.edges.get(`${g.root}->${path[1]}`) : undefined;
        if (firstHop && nb.lastTs - firstHop.firstTs < 7 * DAY) {
          cycles.push([...path, g.root]);
        }
        continue;
      }
      if (path.includes(nb.to)) continue;
      path.push(nb.to);
      dfs(nb.to, depth + 1, nb.firstTs);
      path.pop();
    }
  };
  dfs(g.root, 0, 0);
  return cycles;
}

/** Fast-split / peel-chain heuristic: how quickly inflow leaves, and whether it hits a mixer. */
export function fastSplit(
  chain: Chain,
  g: RawGraph,
  refund: RefundAnalysis,
): { outflowMedianSec: number | null; touchesMixer: boolean } {
  let touchesMixer = false;
  for (const n of g.nodes.values()) {
    if (n.hop <= 2 && (n.type === 'mixer' || lookupEntity(chain, n.id)?.type === 'mixer')) {
      touchesMixer = true;
      break;
    }
  }
  return { outflowMedianSec: refund.medianHoldTimeSec, touchesMixer };
}

function eq(a: string, b: string, chain: Chain): boolean {
  return chain === 'eth' ? a.toLowerCase() === b.toLowerCase() : a === b;
}
function maxTs(txs: Tx[]): number {
  return txs.reduce((m, t) => Math.max(m, t.timestamp), 0) || Math.floor(Date.now() / 1000);
}
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}
