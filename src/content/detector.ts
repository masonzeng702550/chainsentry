import type { Chain } from '@/shared/chains';
import { scanText, type ScanOptions } from '@/shared/address';
import { attachBadge } from './badge';
import { send } from './messaging';

const seen = new Set<string>();

function hasSolContext(text: string): boolean {
  return /\b(solana|phantom|SOL|SPL)\b/i.test(text);
}

/** Walk text nodes, detect addresses, inject badges, and request risk briefs. */
export async function scanAndDecorate(root: ParentNode, opts: Omit<ScanOptions, 'solContext'>) {
  const bodyText = (root.textContent ?? '').slice(0, 200_000);
  const detections = scanText(bodyText, { ...opts, solContext: hasSolContext(bodyText) });
  const wanted = new Map(detections.map((d) => [d.address, d.chain] as const));
  if (wanted.size === 0) return;

  const walker = document.createTreeWalker(root as Node, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.nodeValue && n.nodeValue.length >= 26 && /[a-zA-Z0-9]{26,}/.test(n.nodeValue)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT,
  });

  const jobs: { chain: Chain; address: string; update: (b: any) => void }[] = [];
  const nodes: Text[] = [];
  let cur = walker.nextNode();
  while (cur) {
    nodes.push(cur as Text);
    cur = walker.nextNode();
  }

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
