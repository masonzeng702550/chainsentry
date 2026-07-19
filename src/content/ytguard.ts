import { levenshtein } from '@/shared/domain';

// Official channel handles/names we protect against impersonation (seed set).
const OFFICIAL = [
  { name: 'Tesla', handles: ['@tesla'] },
  { name: 'SpaceX', handles: ['@spacex'] },
  { name: 'MicroStrategy', handles: ['@microstrategy'] },
  { name: 'Coinbase', handles: ['@coinbase'] },
];

let shown = false;

/** On youtube.com watch/live pages, warn when the channel name mimics an official one. */
export function checkYouTube() {
  if (!/youtube\.com/.test(location.host)) return;
  if (!/\/watch|\/live/.test(location.pathname) && location.search.indexOf('v=') === -1) return;

  const tryRun = () => {
    const nameEl = document.querySelector<HTMLElement>(
      'ytd-channel-name #text a, ytd-video-owner-renderer #channel-name a, #owner #channel-name a',
    );
    const handleEl = document.querySelector<HTMLElement>('#owner #channel-handle, yt-formatted-string#channel-handle');
    if (!nameEl) return false;
    const name = nameEl.textContent?.trim() ?? '';
    const handle = (handleEl?.textContent ?? '').trim().toLowerCase();

    for (const off of OFFICIAL) {
      const close = levenshtein(name.toLowerCase(), off.name.toLowerCase()) <= 2;
      const isOfficialHandle = off.handles.includes(handle);
      if (close && !isOfficialHandle) {
        injectBanner(
          `This channel name resembles “${off.name}” but is not the verified official channel. Likely impersonation.`,
        );
        return true;
      }
    }
    return true;
  };

  if (tryRun()) return;
  let tries = 0;
  const iv = setInterval(() => {
    if (tryRun() || ++tries > 20) clearInterval(iv);
  }, 500);
}

function injectBanner(text: string) {
  if (shown) return;
  shown = true;
  const anchor =
    document.querySelector('#above-the-fold') ||
    document.querySelector('#primary-inner') ||
    document.body;
  const host = document.createElement('div');
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <div style="background:#7f1d1d;color:#fff;font:14px/1.4 system-ui;padding:10px 14px;border-radius:8px;
      margin:8px 0;display:flex;gap:8px;align-items:center">
      <span style="font-size:18px">⚠️</span><span>${text}</span>
    </div>`;
  anchor.prepend(host);
}
