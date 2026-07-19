# ChainSentry

A Chrome extension that helps ordinary users see through crypto **giveaway / fake-livestream scams** before they send money.

It answers the three questions a potential victim actually has:

1. **Is this link / site safe?** — blocklist + brand-impersonation (typosquat / homoglyph / subdomain-spoof) + page heuristics, with a full-page warning on dangerous sites.
2. **Where does this wallet's money go?** — an interactive money-flow graph built from on-chain data, with exchange/mixer labeling.
3. **Does it actually refund anyone?** — **refund verification** that proves, on-chain, whether a "send 1, get 2 back" address has ever paid a depositor back (scam addresses refund 0%).

It also detects **fabricated "live transaction" feeds** (front-end fake ticker tapes) and flags **impersonating YouTube channels**.

## Features

| Area | What it does |
|---|---|
| Link safety | Known-scam blocklist sync, typosquat/homoglyph detection, giveaway-pattern heuristics |
| Address detection | Finds & validates BTC / EVM / TRON addresses in page text and dynamic content (checksum-verified) |
| Money-flow analysis | BFS transaction graph (D3 force layout), entity labels, up to 4 hops |
| Refund verification | Computes refund rate & value ratio to bust "double your crypto" claims |
| Laundering signals | Mixer proximity, fast-split / peel-chain timing, self-cycle detection |
| Fake-feed detection | Cyclic-replay + on-chain contradiction checks on "live transaction" widgets |
| YouTube hints | Warns when a channel name mimics an official brand but isn't verified |
| Community reporting | Report a site/address; applied locally at once, queued, optionally POSTed to an endpoint |
| Report export | One-click PNG of the money-flow graph + risk summary (no backend) |

## Architecture

- **Manifest V3**, TypeScript, Vite + `@crxjs/vite-plugin`, Preact + D3.
- **Service worker** hosts the risk engine, chain-data aggregator (cache + rate-limit + failover), blocklist sync (`chrome.alarms`).
- **Content scripts** handle DOM scanning, badge injection (closed shadow DOM), the full-page interstitial, and fake-feed detection.
- No wallet connection, no signing, no telemetry. Only wallet addresses / domains ever leave the browser (to public block explorers).

Data sources: mempool.space / Blockstream (BTC), Etherscan V2 (ETH), TronGrid (TRON), MetaMask `eth-phishing-detect` + ScamSniffer blocklists.

## Development

```bash
npm install
npm run dev        # HMR dev build
npm run build      # typecheck + production build -> dist/
npm run test       # unit + integration tests (32): validators, refund/flow engine,
                   # domain heuristics, entity labels, and a full scam-page detection pass
npm run test:e2e   # real-browser E2E: builds with CS_E2E=1 and drives a headless
                   # Chromium with the unpacked extension loaded (needs Playwright's
                   # Chromium: npx playwright install chromium)
```

### Test scaffold

`test/fixtures/scam-giveaway.html` is a synthetic "Elon Musk / Tesla giveaway"
page (fake 2x-refund copy, countdown, wallet addresses, and a fabricated
"live transactions" ticker). `test/integration/scam-page.test.ts` loads it in
jsdom and asserts the real detection path fires end to end: giveaway/countdown/
celebrity signals, address extraction, feed-candidate detection, cyclic-replay
recognition, and typosquat/homoglyph/subdomain-spoof link checks. The fixture
also doubles as a manual demo page (open it with the unpacked extension loaded).

`test/e2e/extension.spec.ts` (Playwright) loads the real unpacked extension in a
headless Chromium and verifies the UI-injection layer that jsdom cannot reach:
shadow-DOM risk badges appear beside detected addresses, the cyclic-replay
detector overlays the fabricated ticker, and a typosquat domain triggers the
full-page block. It stays deterministic and network-free — the "danger" verdict
comes from mapping a `binance` typosquat to loopback via `--host-resolver-rules`,
not from chain lookups. Light-DOM test hooks (`data-cs-*`) are compiled in only
when `CS_E2E=1`; production builds tree-shake them out.

Load the unpacked extension:

1. `npm run build`
2. Open `chrome://extensions`, enable **Developer mode**
3. **Load unpacked** → select the `dist/` folder

## Status

Implemented: address detection & validation, chain-data providers (BTC/ETH/TRON) with caching & failover, money-flow graph, refund/cycle/fast-split analysis, risk scoring, link guard, blocklist sync, fake-feed detection, YouTube hints, community reporting (local + optional endpoint) with false-positive feedback, PNG report export, and an expanded entity-label seed set (mixers / exchanges / bridges). Popup / options / analysis UIs.

Roadmap: shared community blocklist backend, larger entity-label dataset (public tagpacks), livestream-frame OCR for on-screen addresses, Solana support.

## Disclaimer

ChainSentry provides **informational risk signals only**. It is not financial or legal advice, and a "no risks found" result is not a guarantee of safety. Always do your own verification.
