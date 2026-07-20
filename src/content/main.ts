import { scanAndDecorate, resetDetector } from './detector';
import { detectPageSignals } from './signals';
import { showBlockingWarning, resetBlocker } from './blocker';
import { watchFakeFeeds } from './fakefeeds';
import { checkYouTube, resetYouTubeGuard } from './ytguard';
import { watchNavigation } from './navigation';
import { send } from './messaging';
import type { Chain } from '@/shared/chains';

interface LocalSettings {
  enableBlockingWarning: boolean;
  enableAddressScan: boolean;
  enableYouTubeHints: boolean;
  chains: Record<Chain, boolean>;
}

const DEFAULTS: LocalSettings = {
  enableBlockingWarning: true,
  enableAddressScan: true,
  enableYouTubeHints: true,
  chains: { btc: true, eth: true, tron: true, sol: false },
};

async function getLocalSettings(): Promise<LocalSettings> {
  try {
    const { settings } = await chrome.storage.local.get('settings');
    return { ...DEFAULTS, ...(settings ?? {}) };
  } catch {
    return DEFAULTS;
  }
}

/** Domains the user chose to proceed on; suppresses the interstitial for this page view. */
let continuedDomains = new Set<string>();

function currentDomain(): string {
  try {
    return new URL(location.href).hostname;
  } catch {
    return location.host;
  }
}

async function analyzePage(settings: LocalSettings) {
  // 1. Page signals + URL verdict (drives badge + blocking).
  const text = document.body?.innerText?.slice(0, 200_000) ?? '';
  const sig = detectPageSignals(text);
  await send({
    t: 'PAGE_SIGNALS',
    giveawayHit: sig.giveawayHit,
    countdownHit: sig.countdownHit,
    celebrityHit: sig.celebrityHit,
  }).catch(() => {});

  const verdictResp = await send({ t: 'CHECK_URL', url: location.href }).catch(() => null);
  if (
    verdictResp?.t === 'URL_VERDICT' &&
    verdictResp.verdict.level === 'danger' &&
    settings.enableBlockingWarning &&
    !continuedDomains.has(currentDomain())
  ) {
    const domain = currentDomain();
    showBlockingWarning(verdictResp.verdict.reasons, () => {
      // Remember the choice for this session so the warning does not reappear
      // on every subsequent navigation within the same site.
      continuedDomains.add(domain);
      send({ t: 'CONTINUE_ANYWAY', url: location.href }).catch(() => {});
    });
  }

  // 2. Address detection + badges.
  if (settings.enableAddressScan) {
    requestIdle(() => scanAndDecorate(document.body, { chains: settings.chains, max: 50 }));
  }

  // 3. Fake-feed detection.
  requestIdle(() => watchFakeFeeds());

  // 4. YouTube channel hints.
  if (settings.enableYouTubeHints) checkYouTube();
}

async function run() {
  const settings = await getLocalSettings();
  await analyzePage(settings);
  installObserver(settings);

  // Re-analyse on SPA route changes (YouTube et al.) — without this the extension
  // only ever sees the first page of a single-page app.
  watchNavigation(() => {
    resetDetector();
    resetYouTubeGuard();
    resetBlocker();
    analyzePage(settings);
  });
}

function installObserver(settings: LocalSettings) {
  let timer: number | undefined;
  const obs = new MutationObserver((records) => {
    if (!settings.enableAddressScan) return;
    if (timer) clearTimeout(timer);
    timer = window.setTimeout(() => {
      const added = records.flatMap((r) => [...r.addedNodes]).filter((n) => n instanceof HTMLElement);
      for (const el of added as HTMLElement[]) {
        scanAndDecorate(el, { chains: settings.chains, max: 20 });
      }
    }, 500);
  });
  obs.observe(document.body, { childList: true, subtree: true, characterData: true });
}

function requestIdle(fn: () => void) {
  if ('requestIdleCallback' in window) (window as any).requestIdleCallback(fn, { timeout: 2000 });
  else setTimeout(fn, 200);
}

if (document.readyState === 'complete' || document.readyState === 'interactive') run();
else window.addEventListener('DOMContentLoaded', run);
