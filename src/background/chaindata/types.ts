import type { Chain } from '@/shared/chains';

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
