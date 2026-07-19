import type { Chain } from '@/shared/chains';

export type EntityType = 'exchange' | 'mixer' | 'scam' | 'defi' | 'bridge';
export interface EntityLabel {
  label: string;
  type: EntityType;
}

// Seed label set. Production ships a large lazy-loaded dataset (~50k) built from
// public tagpacks + mixer contracts + aggregated scam blocklists.
const LABELS: Record<Chain, Record<string, EntityLabel>> = {
  eth: {
    // Tornado Cash pool contracts (mixer)
    '0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc': { label: 'Tornado Cash 0.1 ETH', type: 'mixer' },
    '0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936': { label: 'Tornado Cash 1 ETH', type: 'mixer' },
    '0x910cbd523d972eb0a6f4cae4618ad62622b39dbf': { label: 'Tornado Cash 10 ETH', type: 'mixer' },
    '0xa160cdab225685da1d56aa342ad8841c3b53f291': { label: 'Tornado Cash 100 ETH', type: 'mixer' },
    // Exchange hot wallets (illustrative)
    '0x28c6c06298d514db089934071355e5743bf21d60': { label: 'Binance 14', type: 'exchange' },
    '0x21a31ee1afc51d94c2efccaa2092ad1028285549': { label: 'Binance 15', type: 'exchange' },
    '0x71660c4005ba85c37ccec55d0c4493e66fe775d3': { label: 'Coinbase 1', type: 'exchange' },
  },
  btc: {},
  tron: {},
  sol: {},
};

export function lookupEntity(chain: Chain, addr: string): EntityLabel | undefined {
  return LABELS[chain]?.[addr.toLowerCase()] ?? LABELS[chain]?.[addr];
}
