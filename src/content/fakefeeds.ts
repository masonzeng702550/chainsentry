import type { Chain } from '@/shared/chains';
import { scanText } from '@/shared/address';
import { send } from './messaging';

interface Candidate {
  el: HTMLElement;
  rows: HTMLElement[];
}

/** Find list-like blocks that look like a "live transactions" feed. */
function findCandidates(): Candidate[] {
  const out: Candidate[] = [];
  const containers = document.querySelectorAll<HTMLElement>('table tbody, ul, ol, [class*="transaction"], [class*="feed"], [class*="activity"]');
  for (const c of containers) {
    const rows = [...c.children].filter((n): n is HTMLElement => n instanceof HTMLElement);
    if (rows.length < 5) continue;
    const withMoney = rows.filter((r) => /(\d[\d,.]*\s*(btc|eth|usdt|bnb|sol))/i.test(r.textContent ?? ''));
    if (withMoney.length >= 5) out.push({ el: c, rows });
  }
  return out;
}

/** Detect front-end fabricated feeds via cyclic replay + on-chain contradiction. */
export function watchFakeFeeds() {
  const candidates = findCandidates();
  for (const cand of candidates) {
    checkCyclicReplay(cand);
    verifyOnChain(cand);
  }
}

function checkCyclicReplay(cand: Candidate) {
  const history: string[] = [];
  const obs = new MutationObserver(() => {
    const first = cand.el.firstElementChild?.textContent?.trim().slice(0, 80);
    if (!first) return;
    history.push(hash(first));
    if (history.length > 40) history.shift();
    if (isCyclic(history)) {
      markFake(cand.el, ['Rows repeat on a fixed cycle (front-end array, not live data).']);
      obs.disconnect();
    }
  });
  obs.observe(cand.el, { childList: true, subtree: true, characterData: true });
  setTimeout(() => obs.disconnect(), 60_000);
}

async function verifyOnChain(cand: Candidate) {
  const text = cand.rows
    .slice(0, 5)
    .map((r) => r.textContent ?? '')
    .join('\n');
  const addrs = scanText(text, { chains: { btc: true, eth: true, tron: true, sol: false } });
  if (addrs.length === 0) return;
  try {
    const resp = await send({
      t: 'FAKE_FEED_VERIFY',
      rows: addrs.map((a) => ({ address: a.address, chain: a.chain as Chain })),
    });
    if (resp.t === 'FAKE_FEED_RESULT' && resp.fake) {
      markFake(cand.el, ['On-chain check contradicts this feed:', ...resp.evidence]);
    }
  } catch {
    /* ignore */
  }
}

let markCount = 0;
function markFake(el: HTMLElement, evidence: string[]) {
  if (el.dataset.csFake) return;
  el.dataset.csFake = '1';
  markCount++;
  const host = document.createElement('div');
  host.style.cssText = 'position:relative';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <div style="position:absolute;inset:0;background:rgba(127,29,29,.12);border:2px solid #e11d48;
      border-radius:8px;pointer-events:none"></div>
    <div style="position:absolute;top:6px;left:6px;background:#e11d48;color:#fff;font:12px system-ui;
      padding:4px 8px;border-radius:6px;max-width:320px">
      ⚠️ Fabricated transaction feed<br><span style="opacity:.85;font-size:11px">${evidence
        .map((e) => e.replace(/[<>&]/g, ''))
        .join('<br>')}</span>
    </div>`;
  const style = getComputedStyle(el);
  if (style.position === 'static') el.style.position = 'relative';
  el.appendChild(host);
}

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
}

/** True if the sequence shows a repeating period (fixed-array replay). */
function isCyclic(seq: string[]): boolean {
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

export function fakeFeedCount(): number {
  return markCount;
}
