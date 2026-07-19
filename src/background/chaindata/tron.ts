import type { ChainDataProvider, AddressSummary, Tx } from './types';
import { RateLimiter, getJson } from './http';

// TronGrid public API. Focuses on TRX + TRC20 USDT transfers (the common scam rail in Asia).
const BASE = 'https://api.trongrid.io';
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

interface Trc20Resp {
  data: {
    transaction_id: string;
    block_timestamp: number;
    from: string;
    to: string;
    value: string;
    token_info: { address: string; decimals: number };
  }[];
}

interface AccountResp {
  data: { balance?: number; create_time?: number }[];
}

// TronGrid returns hex (41...) addresses in raw tx; base58 in trc20 endpoint. We keep base58 where we can.
export class TronProvider implements ChainDataProvider {
  readonly chain = 'tron' as const;
  private limiter = new RateLimiter(3, 3);

  private async get<T>(path: string): Promise<T> {
    await this.limiter.acquire();
    return getJson<T>(`${BASE}${path}`);
  }

  async getAddressSummary(addr: string): Promise<AddressSummary> {
    const acct = await this.get<AccountResp>(`/v1/accounts/${addr}`);
    const balance = BigInt(acct.data?.[0]?.balance ?? 0);
    const txs = await this.getTransactions(addr, { limit: 200 });
    let received = 0n;
    let sent = 0n;
    let first: number | null = acct.data?.[0]?.create_time
      ? Math.floor(acct.data[0].create_time! / 1000)
      : null;
    let last: number | null = null;
    for (const t of txs) {
      for (const o of t.outputs) if (o.address === addr) received += o.value;
      for (const i of t.inputs) if (i.address === addr) sent += i.value;
      last = last === null ? t.timestamp : Math.max(last, t.timestamp);
    }
    return {
      chain: 'tron',
      address: addr,
      balance,
      txCount: txs.length,
      totalReceived: received,
      totalSent: sent,
      firstSeen: first,
      lastSeen: last,
    };
  }

  async getTransactions(addr: string, opts: { limit: number }): Promise<Tx[]> {
    // Prefer TRC20 (USDT) transfers — that's where scam value moves.
    const r = await this.get<Trc20Resp>(
      `/v1/accounts/${addr}/transactions/trc20?limit=${Math.min(opts.limit, 200)}&contract_address=${USDT_CONTRACT}`,
    );
    return (r.data ?? []).map((t) => ({
      hash: t.transaction_id,
      timestamp: Math.floor(t.block_timestamp / 1000),
      inputs: [{ address: t.from, value: BigInt(t.value) }],
      outputs: [{ address: t.to, value: BigInt(t.value) }],
    }));
  }
}
