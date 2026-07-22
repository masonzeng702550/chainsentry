import { useEffect, useRef, useState } from 'preact/hooks';
import type { Chain, FlowResult, FlowNode, FlowEdge, FlowStream } from '@/shared/messages';
import { CHAIN_META } from '@/shared/chains';
import { drawGraph } from './graph';
import { exportReport } from './export';

const ICON: Record<string, string> = { danger: '🔴', warn: '🟡', safe: '🟢', unknown: '❔' };

export function Analysis({ chain, address }: { chain: Chain; address: string }) {
  const [status, setStatus] = useState<'loading' | 'done' | 'error'>('loading');
  const [error, setError] = useState('');
  const [result, setResult] = useState<FlowResult | null>(null);
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [hops, setHops] = useState(2);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!address) {
      setStatus('error');
      setError('No address provided.');
      return;
    }
    setStatus('loading');
    const port = chrome.runtime.connect({ name: 'flow' });
    port.onMessage.addListener((m: FlowStream) => {
      if (m.t === 'partial') {
        setNodes(m.nodes);
        setEdges(m.edges);
      } else if (m.t === 'done') {
        setResult(m.result);
        setNodes(m.result.nodes);
        setEdges(m.result.edges);
        setStatus('done');
      } else {
        setError(m.message);
        setStatus('error');
      }
    });
    port.postMessage({ chain, address, hops });
    return () => port.disconnect();
  }, [address, chain, hops]);

  useEffect(() => {
    if (svgRef.current && nodes.length) drawGraph(svgRef.current, nodes, edges, address);
  }, [nodes, edges, address]);

  const sym = CHAIN_META[chain].symbol;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', height: '100vh' }}>
      <div style={{ position: 'relative', borderRight: '1px solid #1f2937' }}>
        <div style={{ position: 'absolute', top: 12, left: 16, zIndex: 2 }}>
          <strong style={{ fontSize: 16 }}>🛡 Money Flow</strong>
          <span style={{ marginLeft: 10, opacity: 0.7, fontSize: 12 }}>
            {sym} · <code>{address}</code>
          </span>
          {status === 'loading' && (
            <span style={{ marginLeft: 10, color: '#93c5fd', fontSize: 12 }}>analyzing…</span>
          )}
        </div>
        <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
      </div>

      <aside style={{ padding: 16, overflowY: 'auto' }}>
        {status === 'error' && (
          <div style={{ color: '#fb7185' }}>Error: {error}</div>
        )}
        {result && <Summary result={result} sym={sym} />}
        {result && (
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <button
              onClick={() => svgRef.current && exportReport(svgRef.current, result)}
              style={btn}
            >
              Export report (PNG)
            </button>
            <button
              onClick={async () => {
                await chrome.runtime.sendMessage({
                  t: 'REPORT',
                  report: {
                    kind: 'address',
                    chain,
                    address: result.root,
                    evidence: result.reasons,
                  },
                });
                alert('Address reported. Thank you.');
              }}
              style={btn}
            >
              Report address
            </button>
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12, opacity: 0.7 }}>Depth (hops)</label>
          <select
            value={hops}
            onChange={(e) => setHops(Number((e.target as HTMLSelectElement).value))}
            style={{ marginLeft: 8, background: '#111827', color: '#e2e8f0', padding: 4, borderRadius: 6 }}
          >
            {[1, 2, 3, 4].map((h) => (
              <option value={h}>{h}</option>
            ))}
          </select>
        </div>
        <div style={{ marginTop: 20, fontSize: 10, opacity: 0.5 }}>
          Informational only; not financial or legal advice.
        </div>
      </aside>
    </div>
  );
}

function Summary({ result, sym }: { result: FlowResult; sym: string }) {
  const r = result.refund;

  // A failed lookup is not a clean result — never show a score or the
  // reassuring empty-findings copy when nothing was actually checked.
  if (!result.dataAvailable) {
    return (
      <div>
        <div style={{ padding: 12, borderRadius: 10, background: 'rgba(245,158,11,.15)' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>❔ Not checked</div>
          <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13 }}>
            {result.reasons.map((x) => (
              <li>{x}</li>
            ))}
          </ul>
          <div style={{ marginTop: 8, fontSize: 12, color: '#fbbf24' }}>
            Treat this as unknown, not safe.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          padding: 12,
          borderRadius: 10,
          background:
            result.risk === 'danger'
              ? 'rgba(225,29,72,.15)'
              : result.risk === 'warn'
                ? 'rgba(245,158,11,.15)'
                : 'rgba(16,185,129,.12)',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          {ICON[result.risk]} Risk score {result.score}/100
        </div>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13 }}>
          {result.reasons.map((x) => (
            <li>{x}</li>
          ))}
          {result.reasons.length === 0 && <li>No high-risk patterns detected.</li>}
        </ul>
      </div>

      <Section title="Refund verification">
        <Row k="Senders (deposited in)" v={String(r.senderCount)} />
        <Row k="Senders refunded" v={`${r.refundedCount} (${(r.refundRate * 100).toFixed(0)}%)`} />
        <Row k="Refund/deposit value" v={`${(r.refundValueRatio * 100).toFixed(1)}%`} />
        {r.senderCount >= 5 && r.refundedCount === 0 && (
          <div style={{ color: '#fb7185', fontSize: 12, marginTop: 6 }}>
            This address never refunded anyone — the "send {sym}, get double back" claim is false.
          </div>
        )}
      </Section>

      <Section title="Laundering signals">
        <Row k="Reaches mixer ≤2 hops" v={result.fastSplit.touchesMixer ? 'Yes' : 'No'} />
        <Row
          k="Median hold time"
          v={
            result.fastSplit.outflowMedianSec != null
              ? `${(result.fastSplit.outflowMedianSec / 3600).toFixed(1)} h`
              : 'n/a'
          }
        />
        <Row k="Self-cycles found" v={String(result.cycles.length)} />
      </Section>

      {result.truncated && (
        <div style={{ color: '#fbbf24', fontSize: 12, marginTop: 10 }}>
          Graph truncated at node limit — increase precision on a specific branch.
        </div>
      )}
    </div>
  );
}

const btn = {
  flex: 1,
  background: '#111827',
  border: '1px solid #334155',
  color: '#e2e8f0',
  borderRadius: 8,
  padding: '8px 10px',
  cursor: 'pointer',
  fontSize: 13,
};

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', opacity: 0.6, letterSpacing: 0.5 }}>
        {title}
      </div>
      <div style={{ marginTop: 6 }}>{children}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
      <span style={{ opacity: 0.75 }}>{k}</span>
      <span style={{ fontWeight: 600 }}>{v}</span>
    </div>
  );
}
