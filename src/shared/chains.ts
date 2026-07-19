export type Chain = 'btc' | 'eth' | 'tron' | 'sol';

export const CHAIN_META: Record<
  Chain,
  { label: string; symbol: string; decimals: number; dust: bigint }
> = {
  // dust = threshold below which an edge is not expanded, in the chain's base unit
  btc: { label: 'Bitcoin', symbol: 'BTC', decimals: 8, dust: 1000n },
  eth: { label: 'Ethereum', symbol: 'ETH', decimals: 18, dust: 100_000_000_000_000n },
  tron: { label: 'Tron', symbol: 'TRX', decimals: 6, dust: 1000n },
  sol: { label: 'Solana', symbol: 'SOL', decimals: 9, dust: 10_000n },
};

/** Format a base-unit bigint into a human decimal string with `maxFrac` fraction digits. */
export function formatAmount(value: bigint, chain: Chain, maxFrac = 6): string {
  const { decimals } = CHAIN_META[chain];
  const neg = value < 0n;
  let v = neg ? -value : value;
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  let frac = (v % base).toString().padStart(decimals, '0').slice(0, maxFrac).replace(/0+$/, '');
  return `${neg ? '-' : ''}${whole.toString()}${frac ? '.' + frac : ''}`;
}
