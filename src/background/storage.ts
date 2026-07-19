import type { Chain } from '@/shared/chains';

export interface Settings {
  enableBlockingWarning: boolean;
  enableAddressScan: boolean;
  enableYouTubeHints: boolean;
  chains: Record<Chain, boolean>;
  etherscanApiKey: string;
  language: 'auto' | 'en' | 'zh-TW';
  userAllowlist: string[];
  reportEndpoint: string;
}

export const DEFAULT_SETTINGS: Settings = {
  enableBlockingWarning: true,
  enableAddressScan: true,
  enableYouTubeHints: true,
  chains: { btc: true, eth: true, tron: true, sol: false },
  etherscanApiKey: '',
  language: 'auto',
  userAllowlist: [],
  reportEndpoint: '',
};

export async function getSettings(): Promise<Settings> {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings ?? {}) };
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}

export async function getSessionOverrides(): Promise<string[]> {
  const { sessionOverrides } = await chrome.storage.session.get('sessionOverrides');
  return sessionOverrides ?? [];
}

export async function addSessionOverride(domain: string): Promise<void> {
  const cur = await getSessionOverrides();
  if (!cur.includes(domain)) {
    await chrome.storage.session.set({ sessionOverrides: [...cur, domain] });
  }
}
