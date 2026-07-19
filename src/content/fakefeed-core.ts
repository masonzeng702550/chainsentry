// Pure fake-feed heuristics (no chrome/network deps) so they can be unit-tested in jsdom.

export interface FeedCandidate {
  el: HTMLElement;
  rows: HTMLElement[];
}

const MONEY_RE = /(\d[\d,.]*\s*(btc|eth|usdt|bnb|sol))/i;

/** Find list-like blocks that look like a "live transactions" feed. */
export function findFeedContainers(root: ParentNode): FeedCandidate[] {
  const out: FeedCandidate[] = [];
  const containers = root.querySelectorAll<HTMLElement>(
    'table tbody, ul, ol, [class*="transaction"], [class*="feed"], [class*="activity"]',
  );
  for (const c of containers) {
    const rows = [...c.children].filter((n): n is HTMLElement => n instanceof HTMLElement);
    if (rows.length < 5) continue;
    const withMoney = rows.filter((r) => MONEY_RE.test(r.textContent ?? ''));
    if (withMoney.length >= 5) out.push({ el: c, rows });
  }
  return out;
}

/** Stable short hash of a row's text signature. */
export function hashRow(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
}

/**
 * True if the sequence shows a repeating period — the signature of a front-end
 * fixed-array ticker replayed in a loop rather than genuine live data.
 */
export function isCyclicSequence(seq: string[]): boolean {
  if (seq.length < 12) return false;
  for (let period = 2; period <= seq.length / 3; period++) {
    let ok = true;
    for (let i = seq.length - 1; i >= seq.length - period * 2 && i - period >= 0; i--) {
      if (seq[i] !== seq[i - period]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}
