import type { Chain } from '@/shared/chains';
import { scanText, type ScanOptions } from '@/shared/address';
import { attachBadge } from './badge';
import { send } from './messaging';

const seen = new Set<string>();

/** Clear per-page state so a SPA route change re-badges addresses on the new view. */
export function resetDetector(): void {
  seen.clear();
}

function hasSolContext(text: string): boolean {
  return /\b(solana|phantom|SOL|SPL)\b/i.test(text);
}

/**
 * Never scan these: their text is code/markup, not content the user can see.
 * Scanning them produces false detections for addresses that only appear in
 * JavaScript source, and would inject badge markup into script text.
 */
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'OBJECT']);

/** Collect user-visible text nodes long enough to hold an address. */
export function collectTextNodes(root: ParentNode): Text[] {
  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      const parent = (n as Text).parentElement;
      if (parent && SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      const v = n.nodeValue;
      return v && v.length >= 26 && /[a-zA-Z0-9]{26,}/.test(v)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });
  const out: Text[] = [];
  let cur = walker.nextNode();
  while (cur) {
    out.push(cur as Text);
    cur = walker.nextNode();
  }
  return out;
}

/** Walk text nodes, detect addresses, inject badges, and request risk briefs. */
export async function scanAndDecorate(root: ParentNode, opts: Omit<ScanOptions, 'solContext'>) {
  // Scan the same nodes we can badge, so detection never sees script/style text.
  const nodes = collectTextNodes(root);
  if (nodes.length === 0) return;
  const bodyText = nodes
    .map((n) => n.data)
    .join('\n')
    .slice(0, 200_000);

  const detections = scanText(bodyText, { ...opts, solContext: hasSolContext(bodyText) });
  const wanted = new Map(detections.map((d) => [d.address, d.chain] as const));
  if (wanted.size === 0) return;

  const jobs: { chain: Chain; address: string; update: (b: any) => void }[] = [];

  for (const node of nodes) {
    for (const [address, chain] of wanted) {
      if (seen.has(address)) continue;
      if (!node.data.includes(address)) continue;
      const update = attachBadge(node, address, chain);
      if (update) {
        seen.add(address);
        jobs.push({ chain, address, update });
      }
    }
  }

  // Fetch briefs with limited concurrency to respect API rate limits.
  await pool(jobs, 3, async (job) => {
    try {
      const resp = await send({ t: 'ADDR_FOUND', chain: job.chain, address: job.address });
      if (resp.t === 'ADDR_BRIEF') job.update(resp.brief);
    } catch {
      /* leave as pending */
    }
  });
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  const workers = Array.from({ length: Math.min(size, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift()!;
      await fn(item);
    }
  });
  await Promise.all(workers);
}
