import * as d3 from 'd3';
import type { FlowNode, FlowEdge } from '@/shared/messages';

const TYPE_COLOR: Record<string, string> = {
  root: '#38bdf8',
  exchange: '#a78bfa',
  mixer: '#fb7185',
  scam: '#ef4444',
  defi: '#34d399',
  bridge: '#fbbf24',
  unknown: '#64748b',
};

interface SimNode extends FlowNode, d3.SimulationNodeDatum {}
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  edge: FlowEdge;
}

export function drawGraph(svgEl: SVGSVGElement, nodes: FlowNode[], edges: FlowEdge[], root: string) {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();
  const width = svgEl.clientWidth || 800;
  const height = svgEl.clientHeight || 600;

  const nodeById = new Map<string, SimNode>();
  const simNodes: SimNode[] = nodes.map((n) => {
    const s: SimNode = { ...n };
    nodeById.set(n.id, s);
    return s;
  });
  const simLinks: SimLink[] = edges
    .filter((e) => nodeById.has(e.from) && nodeById.has(e.to))
    .map((e) => ({ source: nodeById.get(e.from)!, target: nodeById.get(e.to)!, edge: e }));

  const g = svg.append('g');
  svg.call(
    d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (ev) => g.attr('transform', ev.transform)),
  );

  svg
    .append('defs')
    .append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 22)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#475569');

  const maxVal = Math.max(...edges.map((e) => Number(e.value) || 0), 1);

  const link = g
    .append('g')
    .selectAll<SVGLineElement, SimLink>('line')
    .data(simLinks)
    .join('line')
    .attr('stroke', '#475569')
    .attr('stroke-width', (d) => 1 + 4 * (Number(d.edge.value) / maxVal))
    .attr('marker-end', 'url(#arrow)');

  link.append('title').text((d) => `${d.edge.value} · ${d.edge.txCount} tx`);

  const node = g
    .append('g')
    .selectAll<SVGGElement, SimNode>('g')
    .data(simNodes)
    .join('g')
    .style('cursor', 'grab')
    .call(
      d3
        .drag<SVGGElement, SimNode>()
        .on('start', (ev, d) => {
          if (!ev.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (ev, d) => {
          d.fx = ev.x;
          d.fy = ev.y;
        })
        .on('end', (ev, d) => {
          if (!ev.active) sim.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }),
    );

  node
    .append('circle')
    .attr('r', (d) => (d.id === root ? 14 : d.type && d.type !== 'unknown' ? 10 : 7))
    .attr('fill', (d) => TYPE_COLOR[d.type ?? 'unknown'])
    .attr('stroke', '#0b1120')
    .attr('stroke-width', 2);

  node
    .append('text')
    .text((d) => d.label ?? `${d.id.slice(0, 6)}…${d.id.slice(-4)}`)
    .attr('x', 16)
    .attr('y', 4)
    .attr('fill', '#cbd5e1')
    .attr('font-size', 11);

  node.append('title').text((d) => `${d.id}${d.label ? ` (${d.label})` : ''}`);

  const sim = d3
    .forceSimulation(simNodes)
    .force(
      'link',
      d3
        .forceLink<SimNode, SimLink>(simLinks)
        .id((d) => d.id)
        .distance(90),
    )
    .force('charge', d3.forceManyBody().strength(-250))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide(24))
    .on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x!)
        .attr('y1', (d) => (d.source as SimNode).y!)
        .attr('x2', (d) => (d.target as SimNode).x!)
        .attr('y2', (d) => (d.target as SimNode).y!);
      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });
}
