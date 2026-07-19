import type { RiskLevel } from '@/shared/messages';
import type { RefundAnalysis } from '@/shared/messages';
import type { ReasonCode } from '@/shared/i18n';

export interface ScoreInput {
  isScamLabeled: boolean;
  refund: RefundAnalysis;
  touchesMixer: boolean;
  fastSplit: boolean;
  addressAgeSec: number | null;
  inflowCount: number;
  onDangerPage: boolean;
}

const HOUR = 3600;

export function scoreAddress(input: ScoreInput): {
  score: number;
  risk: RiskLevel;
  reasons: ReasonCode[];
} {
  const reasons: ReasonCode[] = [];
  if (input.isScamLabeled) {
    return { score: 100, risk: 'danger', reasons: ['scam_labeled'] };
  }

  let score = 0;
  const r = input.refund;

  if (r.refundRate === 0 && r.senderCount >= 5) {
    score += 45;
    reasons.push('refund_zero');
  } else if (r.refundRate > 0 && r.refundValueRatio < 0.1) {
    score += 40;
    reasons.push('refund_bait');
  }
  if (input.touchesMixer) {
    score += 25;
    reasons.push('touches_mixer');
  }
  if (input.fastSplit && r.medianHoldTimeSec !== null && r.medianHoldTimeSec < 2 * HOUR) {
    score += 15;
    reasons.push('fast_split');
  }
  if (input.addressAgeSec !== null && input.addressAgeSec < 14 * 86400 && input.inflowCount >= 10) {
    score += 15;
    reasons.push('young_address_high_inflow');
  }
  if (input.onDangerPage) {
    score += 20;
    reasons.push('on_danger_page');
  }

  score = Math.min(100, score);
  const risk: RiskLevel = score >= 70 ? 'danger' : score >= 40 ? 'warn' : 'safe';
  return { score, risk, reasons };
}
