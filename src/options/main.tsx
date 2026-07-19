import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { Chain } from '@/shared/chains';
import { CHAIN_META } from '@/shared/chains';
import '../ui/styles.css';

interface Settings {
  enableBlockingWarning: boolean;
  enableAddressScan: boolean;
  enableYouTubeHints: boolean;
  chains: Record<Chain, boolean>;
  etherscanApiKey: string;
  userAllowlist: string[];
  reportEndpoint: string;
}

const DEFAULTS: Settings = {
  enableBlockingWarning: true,
  enableAddressScan: true,
  enableYouTubeHints: true,
  chains: { btc: true, eth: true, tron: true, sol: false },
  etherscanApiKey: '',
  userAllowlist: [],
  reportEndpoint: '',
};

function Options() {
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.local.get('settings').then(({ settings }) => setS({ ...DEFAULTS, ...settings }));
  }, []);

  const update = (patch: Partial<Settings>) => {
    const next = { ...s, ...patch };
    setS(next);
    chrome.storage.local.set({ settings: next }).then(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    });
  };

  return (
    <div style={{ maxWidth: 560, margin: '40px auto', padding: 20 }}>
      <h1 style={{ fontSize: 22 }}>🛡 ChainSentry Settings</h1>

      <Toggle
        label="Full-page warning on dangerous sites"
        checked={s.enableBlockingWarning}
        onChange={(v) => update({ enableBlockingWarning: v })}
      />
      <Toggle
        label="Auto-scan pages for wallet addresses"
        checked={s.enableAddressScan}
        onChange={(v) => update({ enableAddressScan: v })}
      />
      <Toggle
        label="YouTube channel impersonation hints"
        checked={s.enableYouTubeHints}
        onChange={(v) => update({ enableYouTubeHints: v })}
      />

      <h3 style={{ marginTop: 24 }}>Chains</h3>
      {(Object.keys(s.chains) as Chain[]).map((c) => (
        <Toggle
          label={CHAIN_META[c].label}
          checked={s.chains[c]}
          onChange={(v) => update({ chains: { ...s.chains, [c]: v } })}
        />
      ))}

      <h3 style={{ marginTop: 24 }}>Etherscan API key (optional)</h3>
      <input
        value={s.etherscanApiKey}
        onInput={(e) => update({ etherscanApiKey: (e.target as HTMLInputElement).value })}
        placeholder="Leave blank to use public rate limits"
        style={{ width: '100%', padding: 8, background: '#111827', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8 }}
      />

      <h3 style={{ marginTop: 24 }}>Community report endpoint (optional)</h3>
      <input
        value={s.reportEndpoint}
        onInput={(e) => update({ reportEndpoint: (e.target as HTMLInputElement).value })}
        placeholder="https://… — leave blank to keep reports local-only"
        style={{ width: '100%', padding: 8, background: '#111827', color: '#e2e8f0', border: '1px solid #334155', borderRadius: 8 }}
      />
      <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
        Reports are applied locally immediately. If an endpoint is set, they are also POSTed there
        (queued and retried on failure).
      </div>

      <div style={{ marginTop: 16, height: 18, color: '#34d399', fontSize: 13 }}>
        {saved ? 'Saved ✓' : ''}
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange((e.target as HTMLInputElement).checked)} />
      <span>{label}</span>
    </label>
  );
}

render(<Options />, document.getElementById('app')!);
