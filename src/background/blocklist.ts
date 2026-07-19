// Blocklist sync + membership test. Sources are merged into a single domain Set,
// persisted to storage. (A Bloom filter is the production optimization; the seed
// build keeps an exact Set for clarity and correctness at small scale.)

interface BlocklistState {
  domains: string[];
  lastSync: Record<string, number>;
}

const SOURCES: { name: string; url: string; parse: (raw: any) => string[]; ttlH: number }[] = [
  {
    name: 'eth-phishing-detect',
    url: 'https://raw.githubusercontent.com/MetaMask/eth-phishing-detect/master/src/config.json',
    parse: (raw) => (raw?.blacklist ?? []) as string[],
    ttlH: 6,
  },
  {
    name: 'scamsniffer',
    url: 'https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/domains.json',
    parse: (raw) => (Array.isArray(raw) ? raw : []) as string[],
    ttlH: 6,
  },
];

let memory: Set<string> | null = null;

export async function loadBlocklist(): Promise<Set<string>> {
  if (memory) return memory;
  const { blocklist } = await chrome.storage.local.get('blocklist');
  const state = (blocklist as BlocklistState) ?? { domains: [], lastSync: {} };
  memory = new Set(state.domains);
  return memory;
}

export async function isBlocked(domain: string): Promise<boolean> {
  const set = await loadBlocklist();
  return set.has(domain);
}

export async function syncBlocklist(force = false): Promise<void> {
  const { blocklist } = await chrome.storage.local.get('blocklist');
  const state: BlocklistState = (blocklist as BlocklistState) ?? { domains: [], lastSync: {} };
  const merged = new Set(state.domains);
  const now = Date.now();

  for (const src of SOURCES) {
    const last = state.lastSync[src.name] ?? 0;
    if (!force && now - last < src.ttlH * 3600 * 1000) continue;
    try {
      const res = await fetch(src.url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) continue;
      const raw = await res.json();
      for (const d of src.parse(raw)) merged.add(String(d).toLowerCase().replace(/^www\./, ''));
      state.lastSync[src.name] = now;
    } catch {
      // keep previous data on failure
    }
  }

  state.domains = [...merged];
  memory = merged;
  await chrome.storage.local.set({ blocklist: state });
}

export function blocklistSize(): number {
  return memory?.size ?? 0;
}
