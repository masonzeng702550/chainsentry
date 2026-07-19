import { keccak_256 } from '@noble/hashes/sha3';
import type { Chain } from './chains';
import { base58CheckDecode, base58Decode } from './base58';
import { bech32Verify } from './bech32';

export interface DetectedAddress {
  chain: Chain;
  address: string;
  /** confidence 0..1 — SOL/lowercase-EVM without checksum are less certain */
  confidence: number;
}

const RE = {
  btcLegacy: /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g,
  btcSegwit: /\bbc1[a-z0-9]{11,71}\b/gi,
  evm: /\b0x[a-fA-F0-9]{40}\b/g,
  tron: /\bT[a-km-zA-HJ-NP-Z1-9]{33}\b/g,
  sol: /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g,
};

/** EIP-55 checksum validation. Lowercase/uppercase-only addresses pass with lower confidence. */
export function validateEvm(addr: string): { valid: boolean; confidence: number } {
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return { valid: false, confidence: 0 };
  const body = addr.slice(2);
  if (body === body.toLowerCase() || body === body.toUpperCase()) {
    return { valid: true, confidence: 0.6 }; // no checksum info
  }
  const hash = keccak_256(new TextEncoder().encode(body.toLowerCase()));
  for (let i = 0; i < 40; i++) {
    const c = body[i];
    if (!/[a-fA-F]/.test(c)) continue;
    const nibble = hash[i >> 1] >> (i % 2 === 0 ? 4 : 0);
    const shouldUpper = (nibble & 0xf) >= 8;
    if (shouldUpper && c !== c.toUpperCase()) return { valid: false, confidence: 0 };
    if (!shouldUpper && c !== c.toLowerCase()) return { valid: false, confidence: 0 };
  }
  return { valid: true, confidence: 1 };
}

/** BTC: legacy Base58Check (versions 0x00 / 0x05) or bech32(m) segwit. */
export function validateBtc(addr: string): boolean {
  if (/^(bc1)/i.test(addr)) return bech32Verify(addr) !== null;
  const payload = base58CheckDecode(addr);
  if (!payload || payload.length !== 21) return false;
  return payload[0] === 0x00 || payload[0] === 0x05;
}

/** TRON: Base58Check with 0x41 version prefix. */
export function validateTron(addr: string): boolean {
  const payload = base58CheckDecode(addr);
  return !!payload && payload.length === 21 && payload[0] === 0x41;
}

/** SOL: Base58 that decodes to exactly 32 bytes (no checksum in the encoding). */
export function validateSol(addr: string): boolean {
  const raw = base58Decode(addr);
  return !!raw && raw.length === 32;
}

export interface ScanOptions {
  chains: Record<Chain, boolean>;
  /** SOL is noisy — only scan when the page context suggests Solana */
  solContext?: boolean;
  max?: number;
}

/** Extract and validate addresses from a block of visible text. */
export function scanText(text: string, opts: ScanOptions): DetectedAddress[] {
  const found = new Map<string, DetectedAddress>();
  const add = (a: DetectedAddress) => {
    if (found.size >= (opts.max ?? 50)) return;
    if (!found.has(a.address)) found.set(a.address, a);
  };

  if (opts.chains.eth) {
    for (const m of text.matchAll(RE.evm)) {
      const { valid, confidence } = validateEvm(m[0]);
      if (valid) add({ chain: 'eth', address: m[0], confidence });
    }
  }
  if (opts.chains.btc) {
    for (const m of text.matchAll(RE.btcSegwit)) {
      if (validateBtc(m[0])) add({ chain: 'btc', address: m[0].toLowerCase(), confidence: 1 });
    }
    for (const m of text.matchAll(RE.btcLegacy)) {
      if (validateBtc(m[0])) add({ chain: 'btc', address: m[0], confidence: 1 });
    }
  }
  if (opts.chains.tron) {
    for (const m of text.matchAll(RE.tron)) {
      if (validateTron(m[0])) add({ chain: 'tron', address: m[0], confidence: 1 });
    }
  }
  if (opts.chains.sol && opts.solContext) {
    for (const m of text.matchAll(RE.sol)) {
      // avoid clobbering things already matched as BTC/TRON
      if (found.has(m[0])) continue;
      if (validateSol(m[0])) add({ chain: 'sol', address: m[0], confidence: 0.5 });
    }
  }
  return [...found.values()];
}
