import { sha256 } from '@noble/hashes/sha256';

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const MAP: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) MAP[ALPHABET[i]] = i;

/** Decode a Base58 string into bytes. Returns null on invalid character. */
export function base58Decode(input: string): Uint8Array | null {
  if (input.length === 0) return new Uint8Array(0);
  const bytes: number[] = [0];
  for (const ch of input) {
    const value = MAP[ch];
    if (value === undefined) return null;
    let carry = value;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // leading '1's => leading zero bytes
  for (let k = 0; k < input.length && input[k] === '1'; k++) bytes.push(0);
  return new Uint8Array(bytes.reverse());
}

/** Verify a Base58Check payload: last 4 bytes = first 4 of double-sha256 of the rest. */
export function base58CheckDecode(input: string): Uint8Array | null {
  const raw = base58Decode(input);
  if (!raw || raw.length < 5) return null;
  const payload = raw.subarray(0, raw.length - 4);
  const checksum = raw.subarray(raw.length - 4);
  const hash = sha256(sha256(payload));
  for (let i = 0; i < 4; i++) {
    if (hash[i] !== checksum[i]) return null;
  }
  return payload;
}
