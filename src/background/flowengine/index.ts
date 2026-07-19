import type { Chain } from '@/shared/chains';
import { formatAmount } from '@/shared/chains';
import type { FlowResult, FlowNode, FlowEdge, AddressBrief } from '@/shared/messages';
import { reasonText } from '@/shared/i18n';
import { getSummary } from '../chaindata';
import { lookupEntity } from '../entities';
import { buildFlowGraph, stripRaw } from './graph';
import { refundAnalysis, detectCycles, fastSplit } from './analyze';
import { scoreAddress } from './score';

export interface AnalyzeOptions {
  hops: number;
  perNodeTxLimit: number;
  onDangerPage: boolean;
  onPartial?: (nodes: FlowNode[], edges: FlowEdge[]) => void;
}

export async function analyzeAddress(
  chain: Chain,
  address: string,
  opts: AnalyzeOptions,
): Promise<FlowResult> {
  const g = await buildFlowGraph(
    chain,
    address,
    opts.hops,
    opts.perNodeTxLimit,
    opts.onPartial,
  );

  const refund = refundAnalysis(chain, g.root, g.rootTxs);
  const cycles = detectCycles(g);
  const split = fastSplit(chain, g, refund);

  const summary = await getSummary(chain, address).catch(() => null);
  const ageSec =
    summary?.firstSeen != null ? Math.floor(Date.now() / 1000) - summary.firstSeen : null;

  const scamLabeled = lookupEntity(chain, g.root)?.type === 'scam';
  const { score, risk, reasons } = scoreAddress({
    isScamLabeled: scamLabeled,
    refund,
    touchesMixer: split.touchesMixer,
    fastSplit: true,
    addressAgeSec: ageSec,
    inflowCount: refund.senderCount,
    onDangerPage: opts.onDangerPage,
  });

  return {
    chain,
    root: g.root,
    nodes: [...g.nodes.values()],
    edges: stripRaw(g.edges),
    refund,
    cycles,
    fastSplit: split,
    score,
    risk,
    reasons: reasons.map(reasonText),
    truncated: g.truncated,
  };
}

/** Fast, shallow analysis used for inline badges (1 hop, small tx window). */
export async function briefAddress(
  chain: Chain,
  address: string,
  onDangerPage: boolean,
): Promise<AddressBrief> {
  const result = await analyzeAddress(chain, address, {
    hops: 1,
    perNodeTxLimit: 50,
    onDangerPage,
  });
  const summary = await getSummary(chain, address).catch(() => null);
  return {
    chain,
    address: result.root,
    risk: result.risk,
    score: result.score,
    totalReceived: summary ? formatAmount(summary.totalReceived, chain) : '0',
    refundedCount: result.refund.refundedCount,
    senderCount: result.refund.senderCount,
    reasons: result.reasons,
  };
}
