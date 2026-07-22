import { describe, it, expect, vi, afterEach } from 'vitest';
import { EthProvider } from './eth';
import { ChainDataError } from './types';

const ADDR = '0x28C6c06298d514Db089934071355E5743bf21d60';

function mockFetch(payload: unknown) {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => payload,
  })) as unknown as typeof fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe('EthProvider error handling', () => {
  it('throws instead of returning an empty history when the API key is missing', async () => {
    // Regression: Etherscan V2 rejects every unkeyed request. Swallowing this
    // made scam addresses look like clean addresses with no activity.
    vi.stubGlobal(
      'fetch',
      mockFetch({ status: '0', message: 'NOTOK', result: 'Missing/Invalid API Key' }),
    );
    const p = new EthProvider(undefined);
    await expect(p.getTransactions(ADDR, { limit: 10 })).rejects.toBeInstanceOf(ChainDataError);
  });

  it('throws on a non-numeric balance payload rather than crashing on BigInt', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ status: '0', message: 'NOTOK', result: 'Missing/Invalid API Key' }),
    );
    const p = new EthProvider(undefined);
    await expect(p.getAddressSummary(ADDR)).rejects.toBeInstanceOf(ChainDataError);
  });

  it('treats "No transactions found" as a genuine empty result, not an error', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({ status: '0', message: 'No transactions found', result: [] }),
    );
    const p = new EthProvider('key');
    await expect(p.getTransactions(ADDR, { limit: 10 })).resolves.toEqual([]);
  });

  it('parses a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        status: '1',
        message: 'OK',
        result: [
          {
            hash: '0xabc',
            timeStamp: '1700000000',
            from: '0xaaa',
            to: '0xbbb',
            value: '1000',
            isError: '0',
          },
        ],
      }),
    );
    const p = new EthProvider('key');
    const txs = await p.getTransactions(ADDR, { limit: 10 });
    expect(txs).toHaveLength(1);
    expect(txs[0].hash).toBe('0xabc');
  });
});
