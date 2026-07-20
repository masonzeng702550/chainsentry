import { describe, it, expect } from 'vitest';
import { handleRequest, makeContext } from './app';
import { MemoryStore } from './store';

function ctx(overrides = {}) {
  return makeContext(new MemoryStore(), overrides);
}

async function report(c: ReturnType<typeof ctx>, domain: string, reporterId: string) {
  return handleRequest('POST', '/v1/reports', { kind: 'site', domain, reporterId }, c);
}

describe('API', () => {
  it('reports health', async () => {
    const res = await handleRequest('GET', '/v1/health', undefined, ctx());
    expect(res.status).toBe(200);
  });

  it('404s unknown routes', async () => {
    const res = await handleRequest('GET', '/nope', undefined, ctx());
    expect(res.status).toBe(404);
  });

  it('rejects an invalid report body', async () => {
    const res = await handleRequest('POST', '/v1/reports', { kind: 'site' }, ctx());
    expect(res.status).toBe(400);
  });

  it('accepts reports and publishes only after the threshold', async () => {
    const c = ctx();
    await report(c, 'evil-giveaway.top', 'reporter-0001');
    await report(c, 'evil-giveaway.top', 'reporter-0002');

    let list = (await handleRequest('GET', '/v1/blocklist', undefined, c)).body as any;
    expect(list.domains).toEqual([]); // 2 reporters < threshold of 3

    const third = await report(c, 'evil-giveaway.top', 'reporter-0003');
    expect(third.status).toBe(202);

    list = (await handleRequest('GET', '/v1/blocklist', undefined, c)).body as any;
    expect(list.domains).toEqual(['evil-giveaway.top']);
  });

  it('flags duplicate submissions without double-counting', async () => {
    const c = ctx();
    await report(c, 'dupe.top', 'reporter-0001');
    const again = await report(c, 'dupe.top', 'reporter-0001');
    expect((again.body as any).duplicate).toBe(true);

    const list = (await handleRequest('GET', '/v1/blocklist', undefined, c)).body as any;
    expect(list.domains).toEqual([]);
  });

  it('rate-limits a single reporter flooding the service', async () => {
    const c = ctx({ maxReportsPerWindow: 3 });
    for (let i = 0; i < 3; i++) await report(c, `site-${i}.top`, 'flooder-0001');
    const blocked = await report(c, 'site-99.top', 'flooder-0001');
    expect(blocked.status).toBe(429);
  });

  it('refuses to publish a protected brand domain under a brigading attack', async () => {
    const c = ctx();
    for (let i = 0; i < 10; i++) await report(c, 'coinbase.com', `griefer-${i}`);
    const list = (await handleRequest('GET', '/v1/blocklist', undefined, c)).body as any;
    expect(list.domains).toEqual([]);
  });
});
