import { CELEBRITY_BRAND_TOKENS } from '@/shared/brands';

const GIVEAWAY_RE = [
  /send.{0,20}(btc|eth|bnb|sol|usdt).{0,40}(get|receive|back|double|2x)/i,
  /(轉|存|發送|匯).{0,20}(倍|返還|回饋|加倍|雙倍)/,
  /(участ|отправ).{0,40}(получ|верн)/i,
];

/** Scan visible text for giveaway-scam signals. Returns booleans only (no page content leaves). */
export function detectPageSignals(text: string): {
  giveawayHit: boolean;
  countdownHit: boolean;
  celebrityHit: boolean;
} {
  const giveawayHit = GIVEAWAY_RE.some((re) => re.test(text));
  const countdownHit =
    /\b\d{1,2}:\d{2}(:\d{2})?\b/.test(text) &&
    /(hurry|ends?\s+in|remaining|限時|倒數|名額)/i.test(text);
  const lower = text.toLowerCase();
  const celebrityHit = CELEBRITY_BRAND_TOKENS.some((t) => lower.includes(t)) && giveawayHit;
  return { giveawayHit, countdownHit, celebrityHit };
}
