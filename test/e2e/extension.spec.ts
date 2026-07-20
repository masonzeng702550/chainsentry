import { test as base, expect, chromium, type BrowserContext } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import http from 'node:http';
import fs from 'node:fs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(HERE, '../../dist');
const FIXTURES = path.resolve(HERE, '../fixtures');
const PORT = 3999;

// --- static file server for the fixture pages ---
let server: http.Server;
base.beforeAll(async () => {
  if (!fs.existsSync(path.join(DIST, 'manifest.json'))) {
    throw new Error('dist/ not built. Run `npm run build:e2e` before the E2E suite.');
  }
  server = http.createServer((req, res) => {
    const url = (req.url || '/').split('?')[0];
    const name = url === '/' ? 'scam-giveaway.html' : url.replace(/^\//, '');
    fs.readFile(path.join(FIXTURES, name), (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.end('not found');
        return;
      }
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(data);
    });
  });
  await new Promise<void>((r) => server.listen(PORT, '127.0.0.1', () => r()));
});
base.afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

// --- extension fixture: fresh persistent context per test ---
const test = base.extend<{ context: BrowserContext }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium', // new headless supports MV3 extensions
      args: [
        `--disable-extensions-except=${DIST}`,
        `--load-extension=${DIST}`,
        // Map a typosquat of binance.com to loopback so the link guard fires
        // a real "danger" verdict without any network dependency.
        '--host-resolver-rules=MAP binancr.com 127.0.0.1',
        '--no-sandbox',
      ],
    });
    // Ensure the service worker is up before the test navigates.
    if (!context.serviceWorkers().length) {
      await context.waitForEvent('serviceworker').catch(() => {});
    }
    await use(context);
    await context.close();
  },
});

test('injects shadow-DOM risk badges beside detected wallet addresses', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/scam-giveaway.html`, { waitUntil: 'load' });
  await page.waitForSelector('[data-cs-badge]', { timeout: 20_000 });
  const count = await page.locator('[data-cs-badge]').count();
  expect(count).toBeGreaterThanOrEqual(2); // BTC + ETH address on the page
});

test('overlays a warning on the fabricated live-transaction ticker', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/scam-giveaway.html`, { waitUntil: 'load' });
  // The inline ticker replays a fixed array; the cyclic-replay detector needs a
  // dozen mutations (~1.2s each) before it marks the feed. The marker host has no
  // layout box of its own (its warning UI lives in a closed shadow root), so wait
  // for it to be attached rather than visually painted.
  await page.waitForSelector('[data-cs-fakefeed]', { state: 'attached', timeout: 50_000 });
  expect(await page.locator('[data-cs-fakefeed]').count()).toBe(1);
});

test('re-analyses after a SPA route change (no document load)', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(`http://localhost:${PORT}/spa-shell.html`, { waitUntil: 'load' });

  // The first view is clean, so nothing should be badged yet.
  await page.waitForTimeout(1500);
  expect(await page.locator('[data-cs-badge]').count()).toBe(0);

  // Client-side route change swaps in scam content without a document load.
  await page.click('#go');

  // Without the navigation watcher the content script would stay blind here.
  await page.waitForSelector('[data-cs-badge]', { state: 'attached', timeout: 20_000 });
  expect(await page.locator('[data-cs-badge]').count()).toBeGreaterThanOrEqual(1);
});

test('shows a full-page block on a brand-typosquat domain', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(`http://binancr.com:${PORT}/scam-giveaway.html`, { waitUntil: 'load' });
  await page.waitForSelector('[data-cs-overlay="block"]', { timeout: 20_000 });
  expect(await page.locator('[data-cs-overlay="block"]').count()).toBe(1);
});
