// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { collectTextNodes } from '@/content/detector';
import { scanText } from '@/shared/address';

const ADDR = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
const CHAINS = { btc: true, eth: true, tron: true, sol: false };

function textOf(root: ParentNode): string {
  return collectTextNodes(root)
    .map((n) => n.data)
    .join('\n');
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('detector scanning scope', () => {
  it('ignores addresses that only appear inside <script> source', () => {
    // Regression: scanning textContent picked up script source, so an address
    // referenced only in JavaScript was reported as if shown to the user.
    document.body.innerHTML = `
      <p>Nothing suspicious on this view.</p>
      <script>var donate = "${ADDR}";</script>
    `;
    expect(scanText(textOf(document.body), { chains: CHAINS })).toHaveLength(0);
  });

  it('ignores addresses inside <style> and <template>', () => {
    document.body.innerHTML = `
      <style>/* ${ADDR} */</style>
      <template><span>${ADDR}</span></template>
    `;
    expect(scanText(textOf(document.body), { chains: CHAINS })).toHaveLength(0);
  });

  it('still detects addresses in visible content', () => {
    document.body.innerHTML = `<p>Send to <code>${ADDR}</code> now</p>`;
    const found = scanText(textOf(document.body), { chains: CHAINS });
    expect(found.map((f) => f.address)).toEqual([ADDR]);
  });

  it('detects visible addresses even when a script mentions another one', () => {
    document.body.innerHTML = `
      <p>Official address: <code>${ADDR}</code></p>
      <script>var decoy = "0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936";</script>
    `;
    const found = scanText(textOf(document.body), { chains: CHAINS });
    expect(found.map((f) => f.address)).toEqual([ADDR]);
  });
});
