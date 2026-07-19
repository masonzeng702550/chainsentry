import type { Chain } from './chains';
export type { Chain } from './chains';

export type RiskLevel = 'safe' | 'warn' | 'danger' | 'unknown';

export interface AddressBrief {
  chain: Chain;
  address: string;
  risk: RiskLevel;
  score: number;
  totalReceived: string; // formatted
  refundedCount: number;
  senderCount: number;
  reasons: string[];
}

export interface UrlVerdict {
  level: RiskLevel;
  reasons: string[];
}

export interface FlowNode {
  id: string; // address
  chain: Chain;
  label?: string;
  type?: 'root' | 'exchange' | 'mixer' | 'scam' | 'defi' | 'bridge' | 'unknown';
  received: string;
  sent: string;
  hop: number;
}

export interface FlowEdge {
  from: string;
  to: string;
  value: string; // formatted
  txCount: number;
  firstTs: number;
  lastTs: number;
}

export interface RefundAnalysis {
  senderCount: number;
  refundedCount: number;
  refundRate: number;
  refundValueRatio: number;
  medianHoldTimeSec: number | null;
}

export interface FlowResult {
  chain: Chain;
  root: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  refund: RefundAnalysis;
  cycles: string[][];
  fastSplit: { outflowMedianSec: number | null; touchesMixer: boolean };
  score: number;
  risk: RiskLevel;
  reasons: string[];
  truncated: boolean;
}

// ---- content <-> service worker messages ----

export type Msg =
  | { t: 'ADDR_FOUND'; chain: Chain; address: string }
  | { t: 'PAGE_SIGNALS'; giveawayHit: boolean; countdownHit: boolean; celebrityHit: boolean }
  | { t: 'CHECK_URL'; url: string }
  | { t: 'FAKE_FEED_VERIFY'; rows: { address?: string; hash?: string; chain: Chain }[] }
  | { t: 'GET_PAGE_STATE'; tabId?: number };

export type MsgResponse =
  | { t: 'ADDR_BRIEF'; brief: AddressBrief }
  | { t: 'URL_VERDICT'; verdict: UrlVerdict }
  | { t: 'FAKE_FEED_RESULT'; fake: boolean; evidence: string[] }
  | { t: 'PAGE_STATE'; verdict: UrlVerdict; addresses: AddressBrief[] }
  | { t: 'ERR'; message: string };

// port protocol for streamed flow analysis
export type FlowRequest = { chain: Chain; address: string; hops: number };
export type FlowStream =
  | { t: 'partial'; nodes: FlowNode[]; edges: FlowEdge[] }
  | { t: 'done'; result: FlowResult }
  | { t: 'error'; message: string };
