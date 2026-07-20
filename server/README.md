# ChainSentry report service

The community half of the reporting loop. The extension protects the reporter
locally the moment they hit "Report"; this service is what turns many independent
reports into a list that protects *everyone else*.

```
npm run server:dev      # http://localhost:8787
```

Then set both fields in the extension's options page:

| Setting | Value |
|---|---|
| Community report endpoint | `http://localhost:8787/v1/reports` |
| Community blocklist URL | `http://localhost:8787/v1/blocklist` |

## API

| Route | Purpose |
|---|---|
| `GET /v1/health` | liveness |
| `POST /v1/reports` | submit a scam report (`{kind, url\|domain, chain, address, evidence, reporterId}`) |
| `GET /v1/blocklist` | published list: `{domains[], addresses[{chain,address}], updatedAt}` |

## Abuse resistance

User-submitted blocklists are a griefing target: without controls, one actor could
mass-report a legitimate exchange and get it blocked for every user. The moderation
layer (`src/moderation.ts`, fully unit-tested) enforces:

- **Distinct-reporter threshold** — a target publishes only after `minDistinctReporters`
  (default 3) *different* reporters flag it. Repeat votes from one reporter are ignored.
- **Protected domains** — the built-in brand allowlist can never be promoted, no matter
  the report volume. Verified by test against a 10-reporter brigading attack.
- **Per-reporter rate limiting** — `maxReportsPerWindow` (default 30/hour).
- **Input hardening** — strict target validation, evidence capped at 10 × 300 chars,
  32 KB body limit.

## Privacy

Reports carry a random `reporterId` generated locally by the extension (`crypto.randomUUID`,
persisted in `chrome.storage.local`). It exists solely so the service can dedupe votes
and rate-limit. There are no accounts, no IP-based identity, and no page content or
browsing history is transmitted — only the reported domain/address plus the reason codes
that triggered the warning.

## Deploying

`MemoryStore` is dev-only — reports vanish on restart. For production, implement the
`Store` interface (`src/store.ts`) against a durable backend and keep `handleRequest`
unchanged; the router is framework-free so it drops into Node, Cloudflare Workers, Deno,
or Lambda. Points to address before running it publicly: durable storage, an auth or
proof-of-work gate on `POST /v1/reports` to raise the cost of sybil reporters, a
moderator review queue for promoted entries, and an appeals path for false positives.
