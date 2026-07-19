import type { Chain } from '@/shared/chains';
import type { ChainDataProvider, AddressSummary, Tx } from './types';
import { BtcProvider } from './btc';
import { EthProvider } from './eth';
import { TronProvider } from './tron';
import { getSettings } from '../storage';

export * from './types';

interface CacheEntry<T> {
  value: T;
  expires: number;
}

const TTL_MS = 10 * 60 * 1000;
const summaryCache = new Map<string, CacheEntry<AddressSummary>>();
const txCache = new Map<string, CacheEntry<Tx[]>>();

let providers: Partial<Record<Chain, ChainDataProvider>> = {};

export async function initProviders(): Promise<void> {
  const s = await getSettings();
  providers = {
    btc: new BtcProvider(),
    eth: new EthProvider(s.etherscanApiKey || undefined),
    tron: new TronProvider(),
  };
}

function provider(chain: Chain): ChainDataProvider {
  const p = providers[chain];
  if (!p) throw new Error(`Chain not supported yet: ${chain}`);
  return p;
}

export async function getSummary(chain: Chain, addr: string): Promise<AddressSummary> {
  const key = `${chain}:${addr}`;
  const hit = summaryCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await provider(chain).getAddressSummary(addr);
  summaryCache.set(key, { value, expires: Date.now() + TTL_MS });
  pruneCache(summaryCache);
  return value;
}

export async function getTransactions(
  chain: Chain,
  addr: string,
  limit: number,
): Promise<Tx[]> {
  const key = `${chain}:${addr}:${limit}`;
  const hit = txCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await provider(chain).getTransactions(addr, { limit });
  txCache.set(key, { value, expires: Date.now() + TTL_MS });
  pruneCache(txCache);
  return value;
}

function pruneCache(cache: Map<string, CacheEntry<unknown>>, max = 500) {
  if (cache.size <= max) return;
  const excess = cache.size - max;
  const it = cache.keys();
  for (let i = 0; i < excess; i++) {
    const k = it.next().value;
    if (k) cache.delete(k);
  }
}
