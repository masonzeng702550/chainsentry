// Lightweight domain utilities: eTLD+1 extraction (heuristic), Levenshtein, homoglyph fold.

const TWO_LEVEL_TLDS = new Set([
  'co.uk',
  'com.au',
  'co.jp',
  'com.br',
  'com.tw',
  'com.hk',
  'com.cn',
  'co.kr',
  'com.sg',
]);

export function hostname(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Heuristic eTLD+1 (registrable domain). Not a full PSL, but covers common cases. */
export function registrableDomain(host: string): string {
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const lastTwo = parts.slice(-2).join('.');
  if (TWO_LEVEL_TLDS.has(lastTwo)) return parts.slice(-3).join('.');
  return lastTwo;
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}

const CONFUSABLES: Array<[RegExp, string]> = [
  [/[0]/g, 'o'],
  [/[1|]/g, 'l'],
  [/[3]/g, 'e'],
  [/[4]/g, 'a'],
  [/[5]/g, 's'],
  [/[7]/g, 't'],
  [/[$]/g, 's'],
  [/[@]/g, 'a'],
  [/[àáâãäå]/g, 'a'],
  [/[èéêë]/g, 'e'],
  [/[ìíîï]/g, 'i'],
  [/[òóôõö]/g, 'o'],
  [/[ùúûü]/g, 'u'],
  [/[а]/g, 'a'], // cyrillic a
  [/[е]/g, 'e'], // cyrillic e
  [/[о]/g, 'o'], // cyrillic o
  [/[р]/g, 'p'], // cyrillic er
  [/[с]/g, 'c'], // cyrillic es
];

/** Fold confusable characters so `teslа.com` (cyrillic a) -> `tesla.com`. */
export function homoglyphFold(s: string): string {
  let out = s.normalize('NFKC').toLowerCase();
  for (const [re, rep] of CONFUSABLES) out = out.replace(re, rep);
  return out;
}
