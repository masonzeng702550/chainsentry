import type { Chain } from '@/shared/chains';
import { CHAIN_META, formatAmount } from '@/shared/chains';
import type { FlowNode, FlowEdge } from '@/shared/messages';
import { getSummary, getTransactions, type Tx } from '../chaindata';
import { lookupEntity } from '../entities';

export interface RawGraph {
  chain: Chain;
  root: string;
  nodes: Map<string, FlowNode>;
  edges: Map<string, FlowEdge & { valueRaw: bigint }>;
  rootTxs: Tx[];
  truncated: boolean;
}

const MAX_NODES = 300;

function edgeKey(from: string, to: string): string {
  return `${from}->${to}`;
}

/**
 * BFS from `root` up to `maxHops`, aggregating parallel transfers into single edges.
 * Known-entity nodes (exchange/mixer) are not expanded further to bound graph size.
 */
export async function buildFlowGraph(
  chain: Chain,
  root: string,
  maxHops: number,
  perNodeTxLimit: number,
  onPartial?: (nodes: FlowNode[], edges: FlowEdge[]) => void,
): Promise<RawGraph> {
  const dust = CHAIN_META[chain].dust;
  const nodes = new Map<string, FlowNode>();
  const edges = new Map<string, FlowEdge & { valueRaw: bigint }>();
  let rootTxs: Tx[] = [];
  let truncated = false;

  const norm = (a: string) => (chain === 'eth' ? a.toLowerCase() : a);
  const rootN = norm(root);

  const rootSummary = await getSummary(chain, root).catch(() => null);
  nodes.set(rootN, {
    id: rootN,
    chain,
    type: 'root',
    hop: 0,
    received: rootSummary ? formatAmount(rootSummary.totalReceived, chain) : '0',
    sent: rootSummary ? formatAmount(rootSummary.totalSent, chain) : '0',
  });

  const visited = new Set<string>([rootN]);
  let frontier: Array<{ addr: string; hop: number }> = [{ addr: rootN, hop: 0 }];

  while (frontier.length) {
    const next: Array<{ addr: string; hop: number }> = [];
    for (const { addr, hop } of frontier) {
      if (hop >= maxHops) continue;
      const entity = lookupEntity(chain, addr);
      if (entity && addr !== rootN) continue; // don't expand through exchanges/mixers

      let txs: Tx[];
      try {
        txs = await getTransactions(chain, addr, perNodeTxLimit);
      } catch {
        continue;
      }
      if (addr === rootN) rootTxs = txs;

      const addEdge = (from: string, to: string, value: bigint, ts: number) => {
        if (from === to || value < dust) return;
        addNode(nodes, chain, from, hop + 1);
        addNode(nodes, chain, to, hop + 1);
        const k = edgeKey(from, to);
        const e = edges.get(k);
        if (e) {
          e.valueRaw += value;
          e.txCount += 1;
          e.firstTs = Math.min(e.firstTs, ts);
          e.lastTs = Math.max(e.lastTs, ts);
          e.value = formatAmount(e.valueRaw, chain);
        } else {
          edges.set(k, {
            from,
            to,
            valueRaw: value,
            value: formatAmount(value, chain),
            txCount: 1,
            firstTs: ts,
            lastTs: ts,
          });
        }
        const counterpart = from === addr ? to : from;
        if (!visited.has(counterpart)) {
          visited.add(counterpart);
          next.push({ addr: counterpart, hop: hop + 1 });
        }
      };

      for (const tx of txs) {
        // Only pairs touching `addr` ever produced an edge, so walk inputs and
        // outputs separately: O(inputs + outputs) instead of O(inputs x outputs),
        // which matters for consolidation txs with hundreds of each.
        const spent = tx.inputs.reduce(
          (sum, i) => (norm(i.address) === addr ? sum + i.value : sum),
          0n,
        );
        const received = tx.outputs.reduce(
          (sum, o) => (norm(o.address) === addr ? sum + o.value : sum),
          0n,
        );

        if (spent > 0n) {
          for (const out of tx.outputs) addEdge(addr, norm(out.address), out.value, tx.timestamp);
        }
        if (received > 0n) {
          for (const inp of tx.inputs) addEdge(norm(inp.address), addr, received, tx.timestamp);
        }

        if (nodes.size >= MAX_NODES) {
          truncated = true;
          break;
        }
      }
      if (truncated) break;
    }
    onPartial?.([...nodes.values()], stripRaw(edges));
    if (truncated) break;
    frontier = next;
  }

  return { chain, root: rootN, nodes, edges, rootTxs, truncated };
}

function addNode(nodes: Map<string, FlowNode>, chain: Chain, addr: string, hop: number) {
  if (nodes.has(addr)) return;
  const entity = lookupEntity(chain, addr);
  nodes.set(addr, {
    id: addr,
    chain,
    hop,
    type: entity?.type ?? 'unknown',
    label: entity?.label,
    received: '',
    sent: '',
  });
}

export function stripRaw(edges: Map<string, FlowEdge & { valueRaw: bigint }>): FlowEdge[] {
  return [...edges.values()].map(({ valueRaw: _valueRaw, ...e }) => e);
}
