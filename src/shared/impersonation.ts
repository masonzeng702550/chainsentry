import type { ReasonCode } from './i18n';
import { levenshtein, homoglyphFold } from './domain';

/**
 * Pure brand-impersonation check. Given a page host and its registrable domain,
 * decide whether it impersonates any allowlisted brand. No I/O — fully testable.
 */
export function detectImpersonation(
  host: string,
  domain: string,
  allowlist: string[],
): ReasonCode | null {
  if (allowlist.includes(domain)) return null;

  const folded = homoglyphFold(domain);
  const domainLabel = domain.split('.')[0];

  for (const brand of allowlist) {
    // Homoglyph: folds to a real brand but isn't literally it (e.g. cyrillic 'а').
    if (folded === brand && domain !== brand) return 'homoglyph';

    const brandName = brand.split('.')[0];
    if (brandName.length < 4) continue;

    // Typosquat: registrable label within edit distance 2 of the brand label.
    const dist = levenshtein(domainLabel, brandName);
    if (dist > 0 && dist <= 2) return 'typosquat';

    // Subdomain spoof: brand token appears in the host but the registrable domain differs.
    if (host.includes(brandName) && domain !== brand && host !== domain) {
      return 'subdomain_spoof';
    }
  }
  return null;
}
