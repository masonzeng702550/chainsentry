import { describe, it, expect } from 'vitest';
import { lookupEntity, markScamAddress, entityCount } from './entities';

describe('entity labels', () => {
  it('labels Tornado Cash pools as mixers (case-insensitive)', () => {
    const e = lookupEntity('eth', '0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc');
    expect(e?.type).toBe('mixer');
  });
  it('labels known exchange hot wallets', () => {
    expect(lookupEntity('eth', '0x28c6c06298d514db089934071355e5743bf21d60')?.type).toBe('exchange');
  });
  it('labels bridges', () => {
    expect(lookupEntity('eth', '0x3ee18b2214aff97000d974cf647e7c347e8fa585')?.type).toBe('bridge');
  });
  it('returns undefined for unknown addresses', () => {
    expect(lookupEntity('eth', '0x0000000000000000000000000000000000000001')).toBeUndefined();
  });
  it('applies runtime scam labels from reports', () => {
    const addr = '0x00000000000000000000000000000000deadbeef';
    expect(lookupEntity('eth', addr)).toBeUndefined();
    markScamAddress('eth', addr);
    expect(lookupEntity('eth', addr)?.type).toBe('scam');
  });
  it('has a non-trivial seed dataset', () => {
    expect(entityCount()).toBeGreaterThan(20);
  });
});
