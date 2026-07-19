// Minimal reason-code -> human string table. Keyed reasons keep the engine testable
// and let the UI localize without the engine embedding prose.
export type ReasonCode =
  | 'blocklist_hit'
  | 'typosquat'
  | 'homoglyph'
  | 'subdomain_spoof'
  | 'young_domain'
  | 'suspicious_tld'
  | 'giveaway_pattern'
  | 'countdown_and_address'
  | 'page_has_danger_address'
  | 'refund_zero'
  | 'refund_bait'
  | 'touches_mixer'
  | 'fast_split'
  | 'young_address_high_inflow'
  | 'on_danger_page'
  | 'scam_labeled';

const EN: Record<ReasonCode, string> = {
  blocklist_hit: 'Domain is on a known crypto-phishing blocklist.',
  typosquat: 'Domain closely mimics a well-known brand (typosquatting).',
  homoglyph: 'Domain uses look-alike characters to impersonate a brand.',
  subdomain_spoof: 'Brand name appears in a subdomain of an unrelated domain.',
  young_domain: 'Domain was registered very recently.',
  suspicious_tld: 'Domain uses a TLD commonly abused by scams.',
  giveaway_pattern: 'Page contains a "send X, get 2X back" giveaway pattern.',
  countdown_and_address: 'Page pairs a countdown timer with a wallet address.',
  page_has_danger_address: 'Page shows a wallet address flagged as high-risk.',
  refund_zero: 'This address never refunded anyone who sent to it.',
  refund_bait: 'Refunds exist but are tiny compared to deposits (bait pattern).',
  touches_mixer: 'Funds reach a mixer within 2 hops.',
  fast_split: 'Incoming funds are moved out quickly (laundering pattern).',
  young_address_high_inflow: 'Address is new but already received many deposits.',
  on_danger_page: 'Address appears on a high-risk page.',
  scam_labeled: 'Address is labeled as a known scam address.',
};

export function reasonText(code: ReasonCode): string {
  return EN[code] ?? code;
}
