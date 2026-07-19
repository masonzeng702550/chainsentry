import type { Chain } from '@/shared/chains';
import { ENTITY_DATA } from './entities.data';

export type EntityType = 'exchange' | 'mixer' | 'scam' | 'defi' | 'bridge';
export interface EntityLabel {
  label: string;
  type: EntityType;
}

// Runtime scam labels merged in from the blocklist / user reports.
const scamLabels: Record<Chain, Set<string>> = {
  btc: new Set(),
  eth: new Set(),
  tron: new Set(),
  sol: new Set(),
};

export function lookupEntity(chain: Chain, addr: string): EntityLabel | undefined {
  const key = chain === 'eth' ? addr.toLowerCase() : addr;
  if (scamLabels[chain]?.has(key)) return { label: 'Reported scam address', type: 'scam' };
  return ENTITY_DATA[chain]?.[key];
}

export function markScamAddress(chain: Chain, addr: string): void {
  const key = chain === 'eth' ? addr.toLowerCase() : addr;
  scamLabels[chain]?.add(key);
}

export function entityCount(): number {
  return Object.values(ENTITY_DATA).reduce((n, m) => n + Object.keys(m).length, 0);
}
