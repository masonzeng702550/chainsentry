import type { ChainDataProvider, AddressSummary, Tx } from './types';
import { RateLimiter, getJson } from './http';

// mempool.space (primary) with Blockstream Esplora fallback. Both are key-free Esplora APIs.
const PRIMARY = 'https://mempool.space/api';
const FALLBACK = 'https://blockstream.info/api';

interface EsploraAddr {
  address: string;
  chain_stats: { funded_txo_sum: number; spent_txo_sum: number; tx_count: number };
  mempool_stats: { funded_txo_sum: number; spent_txo_sum: number; tx_count: number };
}

interface EsploraTx {
  txid: string;
  status: { block_time?: number };
  vin: { prevout?: { scriptpubkey_address?: string; value: number } }[];
  vout: { scriptpubkey_address?: string; value: number }[];
}

export class BtcProvider implements ChainDataProvider {
  readonly chain = 'btc' as const;
  private limiter = new RateLimiter(8, 8);

  private async fetchJson<T>(path: string): Promise<T> {
    await this.limiter.acquire();
    try {
      return await getJson<T>(`${PRIMARY}${path}`);
    } catch {
      return await getJson<T>(`${FALLBACK}${path}`);
    }
  }

  async getAddressSummary(addr: string): Promise<AddressSummary> {
    const d = await this.fetchJson<EsploraAddr>(`/address/${addr}`);
    const received = BigInt(d.chain_stats.funded_txo_sum + d.mempool_stats.funded_txo_sum);
    const spent = BigInt(d.chain_stats.spent_txo_sum + d.mempool_stats.spent_txo_sum);
    return {
      chain: 'btc',
      address: addr,
      balance: received - spent,
      txCount: d.chain_stats.tx_count + d.mempool_stats.tx_count,
      totalReceived: received,
      totalSent: spent,
      firstSeen: null,
      lastSeen: null,
    };
  }

  async getTransactions(addr: string, opts: { limit: number }): Promise<Tx[]> {
    const raw = await this.fetchJson<EsploraTx[]>(`/address/${addr}/txs`);
    return raw.slice(0, opts.limit).map((t) => ({
      hash: t.txid,
      timestamp: t.status.block_time ?? 0,
      inputs: t.vin
        .filter((v) => v.prevout?.scriptpubkey_address)
        .map((v) => ({ address: v.prevout!.scriptpubkey_address!, value: BigInt(v.prevout!.value) })),
      outputs: t.vout
        .filter((v) => v.scriptpubkey_address)
        .map((v) => ({ address: v.scriptpubkey_address!, value: BigInt(v.value) })),
    }));
  }
}
