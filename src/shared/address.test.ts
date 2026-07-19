import { describe, it, expect } from 'vitest';
import { validateBtc, validateEvm, validateTron, scanText } from './address';

describe('BTC validation', () => {
  it('accepts a valid P2PKH address', () => {
    expect(validateBtc('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(true); // genesis
  });
  it('accepts a valid bech32 segwit address', () => {
    expect(validateBtc('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(true);
  });
  it('rejects a corrupted address', () => {
    expect(validateBtc('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb')).toBe(false);
  });
});

describe('EVM checksum', () => {
  it('accepts a valid EIP-55 checksummed address', () => {
    const r = validateEvm('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed');
    expect(r.valid).toBe(true);
    expect(r.confidence).toBe(1);
  });
  it('rejects a wrong checksum', () => {
    expect(validateEvm('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAeD').valid).toBe(false);
  });
  it('accepts all-lowercase with lower confidence', () => {
    const r = validateEvm('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed');
    expect(r.valid).toBe(true);
    expect(r.confidence).toBeLessThan(1);
  });
});

describe('TRON validation', () => {
  it('accepts a valid TRON address', () => {
    expect(validateTron('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t')).toBe(true); // USDT contract
  });
  it('rejects a corrupted TRON address', () => {
    expect(validateTron('TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6u')).toBe(false);
  });
});

describe('scanText', () => {
  const chains = { btc: true, eth: true, tron: true, sol: false };
  it('finds mixed-chain addresses in text', () => {
    const text =
      'Send to 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa or 0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed now';
    const found = scanText(text, { chains });
    expect(found.map((f) => f.chain).sort()).toEqual(['btc', 'eth']);
  });
  it('ignores invalid look-alikes', () => {
    const found = scanText('0x1234 not an address zzzz', { chains });
    expect(found.length).toBe(0);
  });
});
