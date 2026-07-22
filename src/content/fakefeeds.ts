import type { Chain } from '@/shared/chains';
import { scanText } from '@/shared/address';
import { send } from './messaging';
import { findFeedContainers, hashRow, isCyclicSequence, type FeedCandidate } from './fakefeed-core';

/** Detect front-end fabricated feeds via cyclic replay + on-chain contradiction. */
export function watchFakeFeeds() {
  const candidates = findFeedContainers(document);
  for (const cand of candidates) {
    checkCyclicReplay(cand);
    verifyOnChain(cand);
  }
}

function checkCyclicReplay(cand: FeedCandidate) {
  const history: string[] = [];
  const obs = new MutationObserver(() => {
    const first = cand.el.firstElementChild?.textContent?.trim().slice(0, 80);
    if (!first) return;
    history.push(hashRow(first));
    if (history.length > 40) history.shift();
    if (isCyclicSequence(history)) {
      markFake(cand.el, ['Rows repeat on a fixed cycle (front-end array, not live data).']);
      obs.disconnect();
    }
  });
  obs.observe(cand.el, { childList: true, subtree: true, characterData: true });
  setTimeout(() => obs.disconnect(), 60_000);
}

async function verifyOnChain(cand: FeedCandidate) {
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
  host.style.cssText = 'position:absolute;z-index:2147483000;pointer-events:none';
  if (__CS_E2E__) host.setAttribute('data-cs-fakefeed', '1');
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <div style="position:absolute;inset:0;background:rgba(127,29,29,.12);border:2px solid #e11d48;
      border-radius:8px"></div>
    <div style="position:absolute;top:6px;left:6px;background:#e11d48;color:#fff;font:12px system-ui;
      padding:4px 8px;border-radius:6px;max-width:320px">
      ⚠️ Fabricated transaction feed<br><span style="opacity:.85;font-size:11px">${evidence
        .map((e) => e.replace(/[<>&]/g, ''))
        .join('<br>')}</span>
    </div>`;

  // Anchor the warning to <body> and position it over the feed, rather than
  // appending it INTO the feed. Ticker widgets routinely prune their own
  // children (this fixture drops feed.lastChild every tick), which silently
  // deleted the warning — and a scam page could strip it deliberately.
  const reposition = (): boolean => {
    if (!el.isConnected) return false;
    const r = el.getBoundingClientRect();
    host.style.top = `${r.top + window.scrollY}px`;
    host.style.left = `${r.left + window.scrollX}px`;
    host.style.width = `${r.width}px`;
    host.style.height = `${r.height}px`;
    if (host.parentNode !== document.body) document.body.appendChild(host); // re-attach if removed
    return true;
  };

  let timer: ReturnType<typeof setInterval>;
  const stop = () => {
    clearInterval(timer);
    window.removeEventListener('scroll', sync);
    window.removeEventListener('resize', sync);
    host.remove();
  };
  function sync() {
    if (!reposition()) stop();
  }

  reposition();
  window.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('resize', sync, { passive: true });
  timer = setInterval(sync, 500);
}

export function fakeFeedCount(): number {
  return markCount;
}
