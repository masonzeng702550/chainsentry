import { useEffect, useState } from 'preact/hooks';
import type { AddressBrief, UrlVerdict, MsgResponse } from '@/shared/messages';
import { CHAIN_META } from '@/shared/chains';

const ICON: Record<string, string> = { danger: '🔴', warn: '🟡', safe: '🟢', unknown: '⏳' };
const LABEL: Record<string, string> = {
  danger: 'Danger',
  warn: 'Suspicious',
  safe: 'No risks found',
  unknown: 'Analyzing…',
};

export function App() {
  const [verdict, setVerdict] = useState<UrlVerdict>({ level: 'unknown', reasons: [] });
  const [addresses, setAddresses] = useState<AddressBrief[]>([]);

  useEffect(() => {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;
      const resp = (await chrome.runtime.sendMessage({ t: 'GET_PAGE_STATE', tabId: tab.id })) as MsgResponse;
      if (resp?.t === 'PAGE_STATE') {
        setVerdict(resp.verdict);
        setAddresses(resp.addresses);
      }
    })();
  }, []);

  const openAnalysis = (a: AddressBrief) => {
    chrome.tabs.create({
      url: chrome.runtime.getURL(
        `src/analysis/index.html?chain=${a.chain}&address=${encodeURIComponent(a.address)}`,
      ),
    });
  };

  return (
    <div style={{ padding: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 16 }}>🛡 ChainSentry</strong>
        <button
          onClick={() => chrome.runtime.openOptionsPage()}
          style={btnGhost}
          title="Settings"
        >
          ⚙︎
        </button>
      </div>

      <div
        style={{
          marginTop: 12,
          padding: 12,
          borderRadius: 10,
          background: bg(verdict.level),
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600 }}>
          {ICON[verdict.level]} {LABEL[verdict.level]}
        </div>
        {verdict.reasons.length > 0 && (
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, opacity: 0.9 }}>
            {verdict.reasons.map((r) => (
              <li>{r}</li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>
        Detected addresses ({addresses.length})
      </div>
      <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {addresses.length === 0 && (
          <div style={{ fontSize: 12, opacity: 0.5 }}>None found on this page.</div>
        )}
        {addresses.map((a) => (
          <button onClick={() => openAnalysis(a)} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>
                {ICON[a.risk]} <code>{short(a.address)}</code>
              </span>
              <span style={{ opacity: 0.7 }}>{CHAIN_META[a.chain].symbol}</span>
            </div>
            <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>
              Received {a.totalReceived} · Refunds {a.refundedCount}/{a.senderCount}
            </div>
            <div style={{ fontSize: 11, color: '#93c5fd', marginTop: 4 }}>View money flow →</div>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 14, fontSize: 10, opacity: 0.5 }}>
        Analysis is informational and not financial or legal advice.
      </div>
    </div>
  );
}

const btnGhost = {
  background: 'transparent',
  border: '1px solid #334155',
  color: '#e2e8f0',
  borderRadius: 8,
  cursor: 'pointer',
  padding: '4px 8px',
};
const card = {
  textAlign: 'left' as const,
  background: '#111827',
  border: '1px solid #1f2937',
  borderRadius: 10,
  padding: 10,
  color: '#e2e8f0',
  cursor: 'pointer',
  width: '100%',
};
function bg(level: string) {
  return level === 'danger'
    ? 'rgba(225,29,72,.15)'
    : level === 'warn'
      ? 'rgba(245,158,11,.15)'
      : level === 'safe'
        ? 'rgba(16,185,129,.12)'
        : '#111827';
}
function short(a: string) {
  return a.length > 16 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a;
}
