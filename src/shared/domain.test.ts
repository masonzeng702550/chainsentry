import { describe, it, expect } from 'vitest';
import { registrableDomain, levenshtein, homoglyphFold, hostname } from './domain';

describe('registrableDomain', () => {
  it('handles simple domains', () => {
    expect(registrableDomain('tesla-event.io')).toBe('tesla-event.io');
    expect(registrableDomain('claim.tesla-event.io')).toBe('tesla-event.io');
  });
  it('handles two-level TLDs', () => {
    expect(registrableDomain('foo.bar.co.uk')).toBe('bar.co.uk');
  });
});

describe('levenshtein', () => {
  it('measures edit distance', () => {
    expect(levenshtein('tesla', 'tezla')).toBe(1);
    expect(levenshtein('binance', 'binance')).toBe(0);
  });
});

describe('homoglyphFold', () => {
  it('folds cyrillic look-alikes', () => {
    // "teslа" with a Cyrillic 'а'
    expect(homoglyphFold('teslа.com')).toBe('tesla.com');
  });
  it('folds digit substitutions', () => {
    expect(homoglyphFold('b1nance.com')).toBe('blnance.com');
  });
});

describe('hostname', () => {
  it('extracts hostname from url', () => {
    expect(hostname('https://Claim.Tesla-Event.IO/path')).toBe('claim.tesla-event.io');
  });
});
