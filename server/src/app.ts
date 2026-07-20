import type { Store } from './store';
import type { ModerationConfig } from './types';
import { DEFAULT_CONFIG } from './types';
import {
  normalizeReport,
  computePromotions,
  isRateLimited,
  protectedDomains,
} from './moderation';

export interface ApiContext {
  store: Store;
  config: ModerationConfig;
  now: () => number;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

export function makeContext(store: Store, overrides: Partial<ModerationConfig> = {}): ApiContext {
  return {
    store,
    config: {
      ...DEFAULT_CONFIG,
      ...overrides,
      // The built-in brand allowlist is always protected; callers may extend it.
      protectedDomains: protectedDomains(overrides.protectedDomains),
    },
    now: () => Date.now(),
  };
}

/** Framework-free router so the same logic runs on Node, Workers, or in tests. */
export async function handleRequest(
  method: string,
  path: string,
  body: unknown,
  ctx: ApiContext,
): Promise<ApiResponse> {
  if (method === 'GET' && path === '/v1/health') {
    return { status: 200, body: { ok: true } };
  }

  if (method === 'GET' && path === '/v1/blocklist') {
    const reports = await ctx.store.allReports();
    const list = computePromotions(reports, ctx.config, ctx.now());
    return { status: 200, body: list };
  }

  if (method === 'POST' && path === '/v1/reports') {
    const now = ctx.now();
    const parsed = normalizeReport(body, now);
    if (!parsed.ok) return { status: 400, body: { error: parsed.error } };
    const report = parsed.report;

    const recent = await ctx.store.reportsByReporter(report.reporterId);
    if (isRateLimited(recent, ctx.config, now)) {
      return { status: 429, body: { error: 'rate limit exceeded' } };
    }

    const already = await ctx.store.hasReported(report.reporterId, report.target);
    await ctx.store.addReport(report);

    return {
      status: 202,
      body: { accepted: true, target: report.target, duplicate: already },
    };
  }

  return { status: 404, body: { error: 'not found' } };
}
