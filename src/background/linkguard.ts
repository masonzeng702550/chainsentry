import type { UrlVerdict, RiskLevel } from '@/shared/messages';
import type { ReasonCode } from '@/shared/i18n';
import { reasonText } from '@/shared/i18n';
import { BRAND_ALLOWLIST } from '@/shared/brands';
import { hostname, registrableDomain } from '@/shared/domain';
import { detectImpersonation } from '@/shared/impersonation';
import { isBlocked } from './blocklist';
import { getSettings } from './storage';

const SUSPICIOUS_TLDS = new Set(['top', 'xyz', 'icu', 'click', 'gq', 'cf', 'tk', 'ml', 'work', 'live']);

export interface PageSignals {
  giveawayHit: boolean;
  countdownHit: boolean;
  hasDangerAddress: boolean;
}

export async function checkUrl(url: string, signals?: PageSignals): Promise<UrlVerdict> {
  const host = hostname(url);
  if (!host) return { level: 'unknown', reasons: [] };
  const domain = registrableDomain(host);
  const settings = await getSettings();

  if (settings.userAllowlist.includes(domain) || BRAND_ALLOWLIST.includes(domain)) {
    return { level: 'safe', reasons: [] };
  }

  const codes: ReasonCode[] = [];

  if (await isBlocked(domain)) {
    return verdict('danger', ['blocklist_hit']);
  }

  // Brand impersonation (pure, testable)
  const impersonation = detectImpersonation(host, domain, BRAND_ALLOWLIST);
  if (impersonation) return verdict('danger', [impersonation]);

  // Heuristic scoring -> at most 'warn'
  let score = 0;
  const tld = domain.split('.').pop()!;
  if (SUSPICIOUS_TLDS.has(tld)) {
    score += 10;
    codes.push('suspicious_tld');
  }
  if (signals?.giveawayHit) {
    score += 40;
    codes.push('giveaway_pattern');
  }
  if (signals?.countdownHit) {
    score += 30;
    codes.push('countdown_and_address');
  }
  if (signals?.hasDangerAddress) {
    score += 50;
    codes.push('page_has_danger_address');
  }

  if (score >= 60) return verdict('warn', codes);
  return { level: 'safe', reasons: [] };
}

function verdict(level: RiskLevel, codes: ReasonCode[]): UrlVerdict {
  return { level, reasons: codes.map(reasonText) };
}
