import type { AddressBrief, Chain } from '@/shared/messages';
import { CHAIN_META } from '@/shared/chains';

const ICON: Record<string, string> = { danger: '🔴', warn: '🟡', safe: '🟢', unknown: '⏳' };
const rand = () => 'cs-' + Math.random().toString(36).slice(2, 9);

/** Wrap an address occurrence and attach a shadow-DOM badge. Returns an update fn. */
export function attachBadge(
  textNode: Text,
  address: string,
  chain: Chain,
): ((brief: AddressBrief) => void) | null {
  const idx = textNode.data.indexOf(address);
  if (idx === -1) return null;

  const after = textNode.splitText(idx);
  after.splitText(address.length);
  const wrapper = document.createElement('span');
  wrapper.className = rand();
  wrapper.style.cssText = 'position:relative;white-space:nowrap';
  after.parentNode?.replaceChild(wrapper, after);
  wrapper.appendChild(after);

  const host = document.createElement('span');
  wrapper.appendChild(host);
  const root = host.attachShadow({ mode: 'closed' });
  const badge = document.createElement('span');
  badge.textContent = ICON.unknown;
  badge.style.cssText =
    'cursor:pointer;margin-left:4px;font-size:12px;vertical-align:middle;user-select:none';
  const card = document.createElement('div');
  card.style.cssText =
    'display:none;position:absolute;z-index:2147483000;background:#0f172a;color:#e2e8f0;' +
    'padding:8px 10px;border-radius:8px;font:12px/1.4 system-ui;box-shadow:0 4px 16px rgba(0,0,0,.4);' +
    'width:220px;top:18px;left:0';
  root.append(badge, card);

  badge.addEventListener('mouseenter', () => (card.style.display = 'block'));
  badge.addEventListener('mouseleave', () => (card.style.display = 'none'));
  badge.addEventListener('click', () => {
    chrome.runtime.sendMessage({ t: 'GET_PAGE_STATE' }); // keep SW warm
    window.open(
      chrome.runtime.getURL(
        `src/analysis/index.html?chain=${chain}&address=${encodeURIComponent(address)}`,
      ),
      '_blank',
    );
  });

  return (brief: AddressBrief) => {
    badge.textContent = ICON[brief.risk] ?? ICON.unknown;
    const sym = CHAIN_META[chain].symbol;
    card.innerHTML =
      `<b>${ICON[brief.risk]} ${sym}</b>` +
      `<div style="margin-top:4px">Received: ${brief.totalReceived}</div>` +
      `<div>Refunds: ${brief.refundedCount}/${brief.senderCount} senders</div>` +
      (brief.reasons[0] ? `<div style="margin-top:4px;color:#fca5a5">${brief.reasons[0]}</div>` : '') +
      `<div style="margin-top:6px;color:#93c5fd">Click for full flow →</div>`;
  };
}
