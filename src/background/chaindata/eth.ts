import type { ChainDataProvider, AddressSummary, Tx } from './types';
import { ChainDataError } from './types';
import { RateLimiter, getJson } from './http';

// Etherscan V2 unified API. Works without a key at low rate; user can supply their own key.
const BASE = 'https://api.etherscan.io/v2/api';
const CHAIN_ID = 1;

interface EsResp<T> {
  status: string;
  message: string;
  result: T;
}
interface EsTx {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  isError: string;
}

export class EthProvider implements ChainDataProvider {
  readonly chain = 'eth' as const;
  private limiter = new RateLimiter(4, 4);
  constructor(private apiKey: string | undefined) {}

  private q(params: Record<string, string>): string {
    const p = new URLSearchParams({ chainid: String(CHAIN_ID), ...params });
    if (this.apiKey) p.set('apikey', this.apiKey);
    return `${BASE}?${p.toString()}`;
  }

  /**
   * Etherscan signals both "nothing found" and hard failures with status "0".
   * Only the latter may be treated as an error — the rest is a legitimate
   * empty result. Etherscan V2 rejects every unkeyed request, so without a key
   * this throws rather than masquerading as an address with no activity.
   */
  private assertUsable(r: EsResp<unknown>): void {
    if (r.status === '1') return;
    const detail = typeof r.result === 'string' ? r.result : r.message;
    if (/no transactions found|no records found/i.test(detail ?? '')) return;
    throw new ChainDataError(detail || 'Etherscan request failed', 'eth');
  }

  async getAddressSummary(addr: string): Promise<AddressSummary> {
    await this.limiter.acquire();
    const bal = await getJson<EsResp<string>>(
      this.q({ module: 'account', action: 'balance', address: addr, tag: 'latest' }),
    );
    this.assertUsable(bal);
    if (!/^\d+$/.test(bal.result ?? '')) {
      throw new ChainDataError(`unexpected balance payload: ${bal.result}`, 'eth');
    }
    // Derive received/sent/counts from the recent tx window (bounded — full history needs pagination).
    const txs = await this.getTransactions(addr, { limit: 200 });
    let received = 0n;
    let sent = 0n;
    let first: number | null = null;
    let last: number | null = null;
    const lower = addr.toLowerCase();
    for (const t of txs) {
      for (const o of t.outputs) if (o.address.toLowerCase() === lower) received += o.value;
      for (const i of t.inputs) if (i.address.toLowerCase() === lower) sent += i.value;
      first = first === null ? t.timestamp : Math.min(first, t.timestamp);
      last = last === null ? t.timestamp : Math.max(last, t.timestamp);
    }
    return {
      chain: 'eth',
      address: addr,
      balance: BigInt(bal.result || '0'),
      txCount: txs.length,
      totalReceived: received,
      totalSent: sent,
      firstSeen: first,
      lastSeen: last,
    };
  }

  async getTransactions(addr: string, opts: { limit: number }): Promise<Tx[]> {
    await this.limiter.acquire();
    const r = await getJson<EsResp<EsTx[]>>(
      this.q({
        module: 'account',
        action: 'txlist',
        address: addr,
        startblock: '0',
        endblock: '99999999',
        page: '1',
        offset: String(opts.limit),
        sort: 'desc',
      }),
    );
    this.assertUsable(r);
    if (!Array.isArray(r.result)) return [];
    return r.result
      .filter((t) => t.isError === '0' && t.value !== '0')
      .map((t) => ({
        hash: t.hash,
        timestamp: Number(t.timeStamp),
        inputs: [{ address: t.from, value: BigInt(t.value) }],
        outputs: [{ address: t.to, value: BigInt(t.value) }],
      }));
  }
}
