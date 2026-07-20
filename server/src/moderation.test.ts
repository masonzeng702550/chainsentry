import { describe, it, expect } from 'vitest';
import { normalizeReport, computePromotions, targetKey, isRateLimited } from './moderation';
import { DEFAULT_CONFIG, type StoredReport, type ModerationConfig } from './types';
import { protectedDomains } from './moderation';

const CFG: ModerationConfig = { ...DEFAULT_CONFIG, protectedDomains: protectedDomains() };
const NOW = 1_800_000_000_000;

function rep(target: string, reporterId: string, kind: 'site' | 'address' = 'site'): StoredReport {
  const [chain, ...rest] = target.split(':');
  return {
    target,
    kind,
    domain: kind === 'site' ? target : undefined,
    chain: kind === 'address' ? (chain as any) : undefined,
    address: kind === 'address' ? rest.join(':') : undefined,
    reporterId,
    evidence: [],
    ts: NOW,
  };
}

describe('targetKey', () => {
  it('canonicalizes site targets to the registrable domain', () => {
    expect(targetKey({ kind: 'site', domain: 'www.Claim.Tesla-Event.IO' })).toBe('tesla-event.io');
  });
  it('lowercases EVM addresses but preserves BTC casing', () => {
    expect(targetKey({ kind: 'address', chain: 'eth', address: '0xAbCd' })).toBe('eth:0xabcd');
    expect(targetKey({ kind: 'address', chain: 'btc', address: '1A1zP1' })).toBe('btc:1A1zP1');
  });
  it('rejects targets with nothing usable', () => {
    expect(targetKey({ kind: 'site' })).toBeNull();
    expect(targetKey({ kind: 'address', chain: 'eth' })).toBeNull();
  });
});

describe('normalizeReport', () => {
  it('derives the domain from a url', () => {
    const r = normalizeReport(
      { kind: 'site', url: 'https://claim.scam-site.top/x', reporterId: 'reporter-0001' },
      NOW,
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.report.target).toBe('scam-site.top');
  });
  it('rejects a missing/short reporterId', () => {
    const r = normalizeReport({ kind: 'site', domain: 'a.com', reporterId: 'x' }, NOW);
    expect(r.ok).toBe(false);
  });
  it('rejects an unknown kind', () => {
    const r = normalizeReport({ kind: 'nonsense', reporterId: 'reporter-0001' }, NOW);
    expect(r.ok).toBe(false);
  });
  it('caps evidence entries', () => {
    const r = normalizeReport(
      {
        kind: 'site',
        domain: 'a.com',
        reporterId: 'reporter-0001',
        evidence: Array.from({ length: 50 }, () => 'x'.repeat(1000)),
      },
      NOW,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.report.evidence.length).toBeLessThanOrEqual(10);
      expect(r.report.evidence[0].length).toBeLessThanOrEqual(300);
    }
  });
});

describe('computePromotions', () => {
  it('does not promote below the distinct-reporter threshold', () => {
    const reports = [rep('scam.top', 'a'), rep('scam.top', 'b')];
    expect(computePromotions(reports, CFG, NOW).domains).toEqual([]);
  });

  it('promotes once enough distinct reporters agree', () => {
    const reports = [rep('scam.top', 'a'), rep('scam.top', 'b'), rep('scam.top', 'c')];
    expect(computePromotions(reports, CFG, NOW).domains).toEqual(['scam.top']);
  });

  it('ignores repeat votes from the same reporter (anti-ballot-stuffing)', () => {
    const reports = [
      rep('scam.top', 'a'),
      rep('scam.top', 'a'),
      rep('scam.top', 'a'),
      rep('scam.top', 'a'),
    ];
    expect(computePromotions(reports, CFG, NOW).domains).toEqual([]);
  });

  it('never promotes a protected brand domain even when mass-reported', () => {
    const reports = Array.from({ length: 25 }, (_, i) => rep('binance.com', `reporter-${i}`));
    expect(computePromotions(reports, CFG, NOW).domains).toEqual([]);
  });

  it('promotes scam addresses with chain preserved', () => {
    const reports = [
      rep('eth:0xdead', 'a', 'address'),
      rep('eth:0xdead', 'b', 'address'),
      rep('eth:0xdead', 'c', 'address'),
    ];
    const out = computePromotions(reports, CFG, NOW);
    expect(out.addresses).toEqual([{ chain: 'eth', address: '0xdead' }]);
  });
});

describe('isRateLimited', () => {
  it('limits a reporter over the cap inside the window', () => {
    const recent = Array.from({ length: DEFAULT_CONFIG.maxReportsPerWindow }, () =>
      rep('x.com', 'a'),
    );
    expect(isRateLimited(recent, CFG, NOW)).toBe(true);
  });
  it('ignores submissions outside the window', () => {
    const old = Array.from({ length: 100 }, () => ({
      ...rep('x.com', 'a'),
      ts: NOW - CFG.rateWindowMs - 1,
    }));
    expect(isRateLimited(old, CFG, NOW)).toBe(false);
  });
});
