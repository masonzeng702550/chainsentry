import { hostname, registrableDomain } from '@/shared/domain';

let injected = false;

/** Full-page interstitial warning, shown only for 'danger' verdicts. Closed shadow DOM,
 *  re-injects itself if the page tries to remove it. */
export function showBlockingWarning(reasons: string[], onContinue: () => void) {
  if (injected) return;
  injected = true;

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647';
  if (__CS_E2E__) host.setAttribute('data-cs-overlay', 'block');
  const root = host.attachShadow({ mode: 'closed' });
  const domain = registrableDomain(hostname(location.href) ?? location.host);

  root.innerHTML = `
    <style>
      .wrap{position:fixed;inset:0;background:#7f1d1d;color:#fff;font:16px/1.5 system-ui;
        display:flex;align-items:center;justify-content:center;padding:24px}
      .card{max-width:520px;text-align:center}
      h1{font-size:24px;margin:0 0 8px}
      .dom{font-family:monospace;background:rgba(0,0,0,.25);padding:2px 8px;border-radius:6px}
      ul{text-align:left;display:inline-block;margin:16px auto}
      button{font:inherit;padding:10px 18px;border-radius:8px;border:0;cursor:pointer;margin:6px}
      .leave{background:#fff;color:#7f1d1d;font-weight:600}
      .cont{background:transparent;color:#fecaca;border:1px solid #fecaca}
    </style>
    <div class="wrap"><div class="card">
      <div style="font-size:40px">🛑</div>
      <h1>ChainSentry blocked this page</h1>
      <div>This site (<span class="dom">${domain}</span>) matches known crypto-scam patterns.</div>
      <ul>${reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>
      <div>
        <button class="leave">Leave this page</button>
        <button class="cont">I understand the risk, continue</button>
      </div>
    </div></div>`;

  root.querySelector('.leave')!.addEventListener('click', () => {
    location.replace('about:blank');
  });
  root.querySelector('.cont')!.addEventListener('click', () => {
    host.remove();
    observer.disconnect();
    injected = false;
    onContinue();
  });

  document.documentElement.appendChild(host);

  // Anti-tamper: re-attach if the page removes our host.
  const observer = new MutationObserver(() => {
    if (!document.documentElement.contains(host) && injected) {
      document.documentElement.appendChild(host);
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: false });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}
