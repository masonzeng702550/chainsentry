import type { Chain } from '@/shared/chains';
import type { Msg, MsgResponse, FlowRequest, FlowStream, AddressBrief, UrlVerdict } from '@/shared/messages';
import { initProviders } from './chaindata';
import { analyzeAddress, briefAddress } from './flowengine';
import { checkUrl, type PageSignals } from './linkguard';
import { loadBlocklist, syncBlocklist } from './blocklist';
import { submitReport, flushReports } from './reports';
import { setSettings, getSettings } from './storage';
import { registrableDomain, hostname } from '@/shared/domain';

interface TabState {
  verdict: UrlVerdict;
  addresses: Map<string, AddressBrief>;
  signals: PageSignals;
}
const tabs = new Map<number, TabState>();

function tabState(tabId: number): TabState {
  let s = tabs.get(tabId);
  if (!s) {
    s = {
      verdict: { level: 'unknown', reasons: [] },
      addresses: new Map(),
      signals: { giveawayHit: false, countdownHit: false, hasDangerAddress: false },
    };
    tabs.set(tabId, s);
  }
  return s;
}

const BADGE_COLOR: Record<string, string> = {
  danger: '#e11d48',
  warn: '#f59e0b',
  safe: '#10b981',
  unknown: '#64748b',
};

function updateBadge(tabId: number) {
  const s = tabs.get(tabId);
  const level = s?.verdict.level ?? 'unknown';
  const text = level === 'danger' ? '!' : level === 'warn' ? '?' : level === 'safe' ? '' : '';
  chrome.action.setBadgeText({ tabId, text });
  chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR[level] });
}

// ---- lifecycle ----
chrome.runtime.onInstalled.addListener(async () => {
  await initProviders();
  await loadBlocklist();
  await syncBlocklist(true);
  chrome.alarms.create('blocklist-sync', { periodInMinutes: 360 });
  chrome.alarms.create('report-flush', { periodInMinutes: 30 });
});

chrome.runtime.onStartup.addListener(async () => {
  await initProviders();
  await loadBlocklist();
});

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'blocklist-sync') syncBlocklist();
  if (a.name === 'report-flush') flushReports();
});

chrome.tabs.onRemoved.addListener((tabId) => tabs.delete(tabId));

// ---- message handling ----
chrome.runtime.onMessage.addListener((msg: Msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse).catch((e) =>
    sendResponse({ t: 'ERR', message: String(e?.message ?? e) } as MsgResponse),
  );
  return true; // async
});

async function handleMessage(msg: Msg, sender: chrome.runtime.MessageSender): Promise<MsgResponse> {
  const tabId = sender.tab?.id;
  await ensureInit();

  switch (msg.t) {
    case 'CHECK_URL': {
      const s = tabId != null ? tabState(tabId) : undefined;
      const verdict = await checkUrl(msg.url, s?.signals);
      if (tabId != null && s) {
        s.verdict = verdict;
        updateBadge(tabId);
      }
      return { t: 'URL_VERDICT', verdict };
    }
    case 'ADDR_FOUND': {
      const onDanger = tabId != null && tabState(tabId).verdict.level === 'danger';
      const brief = await briefAddress(msg.chain, msg.address, onDanger);
      if (tabId != null) {
        const s = tabState(tabId);
        s.addresses.set(msg.address, brief);
        if (brief.risk === 'danger') {
          s.signals.hasDangerAddress = true;
          // re-evaluate page verdict now that a danger address is present
          s.verdict = await checkUrl(sender.tab?.url ?? '', s.signals);
          updateBadge(tabId);
        }
      }
      return { t: 'ADDR_BRIEF', brief };
    }
    case 'PAGE_SIGNALS': {
      if (tabId != null) {
        const s = tabState(tabId);
        s.signals.giveawayHit = msg.giveawayHit;
        s.signals.countdownHit = msg.countdownHit;
        s.verdict = await checkUrl(sender.tab?.url ?? '', s.signals);
        updateBadge(tabId);
        return { t: 'URL_VERDICT', verdict: s.verdict };
      }
      return { t: 'URL_VERDICT', verdict: { level: 'unknown', reasons: [] } };
    }
    case 'GET_PAGE_STATE': {
      const id = msg.tabId ?? tabId;
      const s = id != null ? tabs.get(id) : undefined;
      return {
        t: 'PAGE_STATE',
        verdict: s?.verdict ?? { level: 'unknown', reasons: [] },
        addresses: s ? [...s.addresses.values()] : [],
      };
    }
    case 'FAKE_FEED_VERIFY': {
      // Verify sampled rows against chain: an address claimed to have received a refund
      // but whose refund analysis is empty is evidence of a fabricated feed.
      const evidence: string[] = [];
      let fake = false;
      for (const row of msg.rows.slice(0, 5)) {
        if (!row.address) continue;
        try {
          const brief = await briefAddress(row.chain, row.address, false);
          if (brief.senderCount > 0 && brief.refundedCount === 0) {
            fake = true;
            evidence.push(`${row.address}: 0 refunds on-chain`);
          }
        } catch {
          /* ignore */
        }
      }
      return { t: 'FAKE_FEED_RESULT', fake, evidence };
    }
    case 'REPORT': {
      const { queued, sent } = await submitReport({ ...msg.report, ts: Date.now() });
      // Re-evaluate the current tab now that a scam label may have been applied.
      if (tabId != null && sender.tab?.url) {
        const s = tabState(tabId);
        s.verdict = await checkUrl(sender.tab.url, s.signals);
        updateBadge(tabId);
      }
      return { t: 'REPORT_ACK', queued, sent };
    }
    case 'FEEDBACK_FALSE_POSITIVE': {
      const host = hostname(msg.url);
      if (host) {
        const domain = registrableDomain(host);
        const s = await getSettings();
        if (!s.userAllowlist.includes(domain)) {
          await setSettings({ userAllowlist: [...s.userAllowlist, domain] });
        }
        if (tabId != null) {
          const st = tabState(tabId);
          st.verdict = { level: 'safe', reasons: [] };
          updateBadge(tabId);
        }
      }
      return { t: 'OK' };
    }
    default:
      return { t: 'ERR', message: 'unknown message' };
  }
}

// ---- streamed flow analysis over a port ----
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'flow') return;
  port.onMessage.addListener(async (req: FlowRequest) => {
    await ensureInit();
    try {
      const result = await analyzeAddress(req.chain as Chain, req.address, {
        hops: Math.min(Math.max(req.hops, 1), 4),
        perNodeTxLimit: 50,
        onDangerPage: false,
        onPartial: (nodes, edges) => post(port, { t: 'partial', nodes, edges }),
      });
      post(port, { t: 'done', result });
    } catch (e: any) {
      post(port, { t: 'error', message: String(e?.message ?? e) });
    }
  });
});

function post(port: chrome.runtime.Port, m: FlowStream) {
  try {
    port.postMessage(m);
  } catch {
    /* port closed */
  }
}

let initialized = false;
async function ensureInit() {
  if (initialized) return;
  await initProviders();
  await loadBlocklist();
  initialized = true;
}
