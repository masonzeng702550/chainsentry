import http from 'node:http';
import { handleRequest, makeContext } from './app';
import { MemoryStore } from './store';

const PORT = Number(process.env.PORT ?? 8787);
const MAX_BODY = 32 * 1024;

// NOTE: MemoryStore is for local dev only — data is lost on restart.
// Swap in a durable Store implementation for production.
const ctx = makeContext(new MemoryStore());

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  // The extension calls this cross-origin from arbitrary pages' service worker.
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const chunks: Buffer[] = [];
  let size = 0;
  req.on('data', (c: Buffer) => {
    size += c.length;
    if (size > MAX_BODY) {
      res.statusCode = 413;
      res.end(JSON.stringify({ error: 'body too large' }));
      req.destroy();
      return;
    }
    chunks.push(c);
  });

  req.on('end', async () => {
    let body: unknown = undefined;
    if (chunks.length) {
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'invalid JSON' }));
        return;
      }
    }
    try {
      const out = await handleRequest(req.method ?? 'GET', url.pathname, body, ctx);
      res.statusCode = out.status;
      res.setHeader('content-type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(out.body));
    } catch (e) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String((e as Error)?.message ?? e) }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`ChainSentry report service listening on http://localhost:${PORT}`);
});
