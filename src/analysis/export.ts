import type { FlowResult } from '@/shared/messages';
import { CHAIN_META } from '@/shared/chains';

const RISK_COLOR: Record<string, string> = {
  danger: '#e11d48',
  warn: '#f59e0b',
  safe: '#10b981',
  unknown: '#64748b',
};

/** Render the analysis (graph + summary) into a PNG and trigger a download. No backend. */
export async function exportReport(svgEl: SVGSVGElement, result: FlowResult): Promise<void> {
  const W = 1200;
  const H = 900;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#0b1120';
  ctx.fillRect(0, 0, W, H);

  const sym = CHAIN_META[result.chain].symbol;

  // Header
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillText('🛡 ChainSentry — Money Flow Report', 40, 50);
  ctx.font = '14px monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`${sym}  ${result.root}`, 40, 78);

  // Risk banner
  ctx.fillStyle = RISK_COLOR[result.risk];
  ctx.fillRect(40, 100, W - 80, 6);
  ctx.font = '700 34px system-ui, sans-serif';
  ctx.fillStyle = RISK_COLOR[result.risk];
  ctx.fillText(`Risk score ${result.score}/100  (${result.risk.toUpperCase()})`, 40, 150);

  // Reasons
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#e2e8f0';
  let y = 190;
  const reasons = result.reasons.length ? result.reasons : ['No high-risk patterns detected.'];
  for (const r of reasons.slice(0, 6)) {
    ctx.fillText('• ' + r, 48, y);
    y += 26;
  }

  // Key stats
  const r = result.refund;
  const stats = [
    `Senders (deposited in): ${r.senderCount}`,
    `Senders refunded: ${r.refundedCount} (${(r.refundRate * 100).toFixed(0)}%)`,
    `Refund/deposit value: ${(r.refundValueRatio * 100).toFixed(1)}%`,
    `Reaches mixer ≤2 hops: ${result.fastSplit.touchesMixer ? 'Yes' : 'No'}`,
    `Self-cycles found: ${result.cycles.length}`,
  ];
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = '#cbd5e1';
  y += 8;
  for (const s of stats) {
    ctx.fillText(s, 48, y);
    y += 24;
  }

  // Graph snapshot
  const graphImg = await svgToImage(svgEl, W - 80, 380);
  if (graphImg) {
    ctx.strokeStyle = '#1f2937';
    ctx.strokeRect(40, y + 10, W - 80, 380);
    ctx.drawImage(graphImg, 40, y + 10, W - 80, 380);
  }

  // Footer
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText('Informational risk signals only — not financial or legal advice.', 40, H - 24);

  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `chainsentry-${result.chain}-${result.root.slice(0, 10)}.png`;
  a.click();
}

function svgToImage(svgEl: SVGSVGElement, w: number, h: number): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    // Ensure the exported snapshot has the dark background baked in.
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', '100%');
    bg.setAttribute('height', '100%');
    bg.setAttribute('fill', '#0b1120');
    clone.insertBefore(bg, clone.firstChild);
    const data = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
