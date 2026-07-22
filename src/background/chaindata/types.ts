import type { Chain } from '@/shared/chains';

/**
 * Raised when a provider cannot answer (missing API key, rate limit, outage).
 * This must never be confused with "the address has no activity": reporting an
 * unreachable chain as a clean address is a false reassurance on a security tool.
 */
export class ChainDataError extends Error {
  constructor(
    message: string,
    readonly chain: Chain,
  ) {
    super(message);
    this.name = 'ChainDataError';
  }
}

export interface AddressSummary {
  chain: Chain;
  address: string;
  balance: bigint;
  txCount: number;
  totalReceived: bigint;
  totalSent: bigint;
  firstSeen: number | null;
  lastSeen: number | null;
}

export interface TxParty {
  address: string;
  value: bigint;
}

export interface Tx {
  hash: string;
  timestamp: number; // unix seconds
  inputs: TxParty[];
  outputs: TxParty[];
}

export interface ChainDataProvider {
  chain: Chain;
  getAddressSummary(addr: string): Promise<AddressSummary>;
  getTransactions(addr: string, opts: { limit: number }): Promise<Tx[]>;
}
