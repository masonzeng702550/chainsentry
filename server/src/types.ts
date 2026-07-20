export type Chain = 'btc' | 'eth' | 'tron' | 'sol';

/** Wire shape accepted by POST /v1/reports (mirrors the extension's ScamReport). */
export interface IncomingReport {
  kind: 'site' | 'address';
  url?: string;
  domain?: string;
  chain?: Chain;
  address?: string;
  evidence?: string[];
  /** Anonymous, client-generated random id. Used only to dedupe and rate-limit. */
  reporterId: string;
}

export interface StoredReport {
  target: string; // canonical key: domain, or `${chain}:${address}`
  kind: 'site' | 'address';
  domain?: string;
  chain?: Chain;
  address?: string;
  reporterId: string;
  evidence: string[];
  ts: number;
}

export interface PromotedList {
  domains: string[];
  addresses: { chain: Chain; address: string }[];
  updatedAt: number;
}

export interface ModerationConfig {
  /** Distinct reporters required before an entry is published. */
  minDistinctReporters: number;
  /** Domains that can never be promoted, regardless of report volume. */
  protectedDomains: string[];
  /** Per-reporter submission cap within the rate window. */
  maxReportsPerWindow: number;
  rateWindowMs: number;
}

export const DEFAULT_CONFIG: ModerationConfig = {
  minDistinctReporters: 3,
  protectedDomains: [],
  maxReportsPerWindow: 30,
  rateWindowMs: 60 * 60 * 1000,
};
