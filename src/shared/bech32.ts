// Bech32 / Bech32m checksum verification (BIP-173 / BIP-350).
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values: number[]): number {
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) chk ^= GEN[i];
    }
  }
  return chk;
}

function hrpExpand(hrp: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) >> 5);
  out.push(0);
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) & 31);
  return out;
}

export type Bech32Variant = 'bech32' | 'bech32m';

/** Validate a bech32/bech32m string. Returns the variant or null if invalid. */
export function bech32Verify(addr: string): Bech32Variant | null {
  const lower = addr.toLowerCase();
  const upper = addr.toUpperCase();
  if (addr !== lower && addr !== upper) return null; // mixed case not allowed
  const s = lower;
  const pos = s.lastIndexOf('1');
  if (pos < 1 || pos + 7 > s.length || s.length > 90) return null;
  const hrp = s.slice(0, pos);
  const dataPart = s.slice(pos + 1);
  const data: number[] = [];
  for (const ch of dataPart) {
    const d = CHARSET.indexOf(ch);
    if (d === -1) return null;
    data.push(d);
  }
  const chk = polymod([...hrpExpand(hrp), ...data]);
  if (chk === 1) return 'bech32';
  if (chk === 0x2bc830a3) return 'bech32m';
  return null;
}
