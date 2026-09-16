// Colours for the Political map style: neighbouring countries never share one (spec §3, §8). DSatur: repeatedly colour
// the uncoloured country whose neighbours already use the most different colours (ties: more neighbours, then the
// smaller id, so the result never depends on input order) with the lowest colour none of its neighbours has.
export const PALETTE_SIZE = 6;

export function colourCountries(ids: readonly string[], neighbours: readonly (readonly number[])[], palette = PALETTE_SIZE): number[] {
  const n = ids.length;
  const colour = new Array<number>(n).fill(-1);
  const seen = Array.from({ length: n }, () => new Set<number>());
  for (let step = 0; step < n; step++) {
    let best = -1;
    for (let i = 0; i < n; i++) {
      if (colour[i] !== -1) continue;
      if (best < 0) { best = i; continue; }
      const s = seen[i]!.size - seen[best]!.size;
      const d = neighbours[i]!.length - neighbours[best]!.length;
      if (s > 0 || (s === 0 && (d > 0 || (d === 0 && ids[i]! < ids[best]!)))) best = i;
    }
    let c = 0;
    while (seen[best]!.has(c)) c++;
    if (c >= palette) throw new Error(`colourCountries: ${ids[best]} needs colour ${c + 1} of ${palette}`);
    colour[best] = c;
    for (const j of neighbours[best]!) seen[j]!.add(c);
  }
  return colour;
}
