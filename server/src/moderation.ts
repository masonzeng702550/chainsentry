import type { IncomingReport, StoredReport, PromotedList, ModerationConfig, Chain } from './types';
import { registrableDomain } from '../../src/shared/domain';
import { BRAND_ALLOWLIST } from '../../src/shared/brands';

/** Domains that must never be promoted even if mass-reported (anti-griefing). */
export function protectedDomains(extra: string[] = []): string[] {
  return [...BRAND_ALLOWLIST, ...extra];
}

/** Canonical dedupe/aggregation key for a report target. */
export function targetKey(r: {
  kind: 'site' | 'address';
  domain?: string;
  chain?: Chain;
  address?: string;
}): string | null {
  if (r.kind === 'site') {
    if (!r.domain) return null;
    return registrableDomain(r.domain.toLowerCase().replace(/^www\./, ''));
  }
  if (!r.chain || !r.address) return null;
  const addr = r.chain === 'eth' ? r.address.toLowerCase() : r.address;
  return `${r.chain}:${addr}`;
}

export function isProtectedTarget(
  kind: 'site' | 'address',
  target: string,
  protectedList: string[],
): boolean {
  if (kind !== 'site') return false;
  return protectedList.includes(target);
}

/** Validate and normalize an incoming report. Returns null with a reason on reject. */
export function normalizeReport(
  input: unknown,
  now: number,
): { ok: true; report: StoredReport } | { ok: false; error: string } {
  const r = input as IncomingReport;
  if (!r || typeof r !== 'object') return { ok: false, error: 'body must be an object' };
  if (r.kind !== 'site' && r.kind !== 'address') {
    return { ok: false, error: 'kind must be "site" or "address"' };
  }
  if (typeof r.reporterId !== 'string' || r.reporterId.length < 8 || r.reporterId.length > 64) {
    return { ok: false, error: 'reporterId must be 8-64 chars' };
  }

  // Derive domain from url when the client only sent a url.
  let domain = r.domain;
  if (r.kind === 'site' && !domain && typeof r.url === 'string') {
    try {
      domain = new URL(r.url).hostname;
    } catch {
      /* ignore */
    }
  }

  const key = targetKey({ kind: r.kind, domain, chain: r.chain, address: r.address });
  if (!key) return { ok: false, error: 'report is missing a usable target' };

  const evidence = Array.isArray(r.evidence)
    ? r.evidence.filter((e): e is string => typeof e === 'string').slice(0, 10).map((e) => e.slice(0, 300))
    : [];

  return {
    ok: true,
    report: {
      target: key,
      kind: r.kind,
      domain: r.kind === 'site' ? key : undefined,
      chain: r.kind === 'address' ? r.chain : undefined,
      address: r.kind === 'address' ? r.address : undefined,
      reporterId: r.reporterId,
      evidence,
      ts: now,
    },
  };
}

/**
 * Promote a target only once enough DISTINCT reporters have flagged it, and never
 * if it is on the protected list. Distinct-reporter counting is what stops a single
 * actor from mass-reporting a legitimate site into the blocklist.
 */
export function computePromotions(
  reports: StoredReport[],
  cfg: ModerationConfig,
  now: number,
): PromotedList {
  const byTarget = new Map<string, StoredReport[]>();
  for (const r of reports) {
    if (!byTarget.has(r.target)) byTarget.set(r.target, []);
    byTarget.get(r.target)!.push(r);
  }

  const domains: string[] = [];
  const addresses: { chain: Chain; address: string }[] = [];

  for (const [target, group] of byTarget) {
    const distinct = new Set(group.map((g) => g.reporterId)).size;
    if (distinct < cfg.minDistinctReporters) continue;
    const kind = group[0].kind;
    if (isProtectedTarget(kind, target, cfg.protectedDomains)) continue;

    if (kind === 'site') {
      domains.push(target);
    } else {
      const [chain, ...rest] = target.split(':');
      addresses.push({ chain: chain as Chain, address: rest.join(':') });
    }
  }

  domains.sort();
  addresses.sort((a, b) => (a.address < b.address ? -1 : 1));
  return { domains, addresses, updatedAt: now };
}

/** True when this reporter has exceeded the submission cap in the current window. */
export function isRateLimited(
  recentByReporter: StoredReport[],
  cfg: ModerationConfig,
  now: number,
): boolean {
  const cutoff = now - cfg.rateWindowMs;
  return recentByReporter.filter((r) => r.ts >= cutoff).length >= cfg.maxReportsPerWindow;
}
