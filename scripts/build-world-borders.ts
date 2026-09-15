// Builds src/map/data/world-borders-pol.json — the world's country borders, drawn on the globe and every flat
// map (src/map/world.ts). Land stays world-atlas 110m; only the borders come from here.
//
// Why not world-atlas: its countries-110m.json is Natural Earth's "de facto" admin-0 data, which draws Crimea
// inside Russia. Natural Earth's Poland point-of-view countries follow Ukraine's internationally recognised
// borders (Crimea, Sevastopol, Donetsk and Luhansk in Ukraine; Kosovo a country; Western Sahara in Morocco).
// That point of view is only published at 10m, so it is simplified here to about world-atlas 110m detail.
//
// Source: Natural Earth (public domain), https://www.naturalearthdata.com/, GeoJSON mirror
//   https://github.com/nvkelso/natural-earth-vector/tree/master/geojson (VERSION 5.1.1, retrieved 2026-09-15):
//   ne_10m_admin_0_countries_pol.
//
// Usage:
//   node --experimental-strip-types scripts/build-world-borders.ts [download-dir] [--download]
// The raw download (~13 MB) stays in download-dir (default .cache/natural-earth, git-ignored); --download
// fetches it when missing.
//
// Processing: countries smaller than MIN_AREA dropped (enclaves and specks world-atlas 110m has no border for:
// Vatican, San Marino, Monaco, Hong Kong, Bir Tawil…; a dropped country leaves an unshared hole, which draws
// nothing) → one topology → border arcs (shared by two countries) thinned by Visvalingam weight, coast arcs (never
// drawn, only there to close the polygons) by Douglas–Peucker distance, which keeps coastal cities such as
// Sevastopol inside their country for far fewer vertices → only rings with a border kept (islands without a land
// border dropped) → quantized topology with one `countries` object (ids = ADM0_A3_PL, no properties). The map draws
// its mesh between different countries. Coasts here are rough; the map's land and coastlines stay world-atlas 110m.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { geoArea } from 'd3-geo';
import { topology } from 'topojson-server';
import { filter, presimplify, simplify } from 'topojson-simplify';
import { mesh, quantize } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

const OUT = 'src/map/data/world-borders-pol.json';
const DEFAULT_DIR = '.cache/natural-earth';
const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const FILE = 'ne_10m_admin_0_countries_pol';
const NE_VERSION = '5.1.1';
const MIN_AREA = 0.18; // square degrees: Luxembourg (0.21) stays, Bir Tawil (0.16) goes
const BORDER_MIN_WEIGHT = 0.1; // square degrees (Visvalingam): about the vertex density of world-atlas 110m borders
const COAST_TOLERANCE = 0.3; // degrees (Douglas–Peucker): coasts are never drawn, but keep Sevastopol and Mariupol on land
const QUANTIZATION = 1e4; // 0.036° × 0.017° steps: under half a pixel at zoom 4
const SQ_DEG_PER_STERADIAN = (180 / Math.PI) ** 2;

async function ensure(dir: string, download: boolean): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${FILE}.geojson`);
  if (existsSync(path)) return path;
  if (!download) throw new Error(`Missing ${path} (run with --download or fetch ${BASE}${FILE}.geojson)`);
  console.log(`Downloading ${FILE}…`);
  const res = await fetch(`${BASE}${FILE}.geojson`);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${FILE}`);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  return path;
}

function ringsOf(g: GeometryCollection['geometries'][number]): number[][] {
  if (g.type === 'Polygon') return g.arcs;
  if (g.type === 'MultiPolygon') return g.arcs.flat();
  return [];
}

/**
 * Douglas–Peucker significance of each vertex: the largest tolerance (degrees) at which it survives. A vertex never
 * outlives the vertex that split its span, so keeping every vertex with significance ≥ t is Douglas–Peucker at t.
 */
function deviations(pts: readonly (readonly number[])[]): number[] {
  const sig = pts.map(() => Infinity);
  const stack: [number, number, number][] = [[0, pts.length - 1, Infinity]];
  while (stack.length) {
    const [a, b, cap] = stack.pop()!;
    if (b - a < 2) continue;
    const [ax, ay] = pts[a]!, [bx, by] = pts[b]!;
    const k = Math.cos((((ay! + by!) / 2) * Math.PI) / 180);
    const dx = (bx! - ax!) * k, dy = by! - ay!, len = Math.hypot(dx, dy);
    let best = -1, far = -1;
    for (let i = a + 1; i < b; i++) {
      const px = (pts[i]![0]! - ax!) * k, py = pts[i]![1]! - ay!;
      const d = len > 0 ? Math.abs(px * dy - py * dx) / len : Math.hypot(px, py);
      if (d > far) { far = d; best = i; }
    }
    sig[best] = Math.min(far, cap);
    stack.push([a, best, sig[best]!], [best, b, sig[best]!]);
  }
  return sig;
}

/** Area in square degrees, whichever way the rings are wound. */
function areaSqDeg(f: Feature): number {
  const a = geoArea(f);
  return Math.min(a, 4 * Math.PI - a) * SQ_DEG_PER_STERADIAN;
}

async function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--')) ?? DEFAULT_DIR;
  const path = await ensure(dir, args.includes('--download'));
  const source = JSON.parse(readFileSync(path, 'utf8')) as FeatureCollection<Polygon | MultiPolygon>;

  // 1. Countries, each with its Poland point-of-view code as id.
  const dropped: string[] = [];
  const features: Feature<Polygon | MultiPolygon>[] = [];
  for (const f of source.features) {
    const id = String(f.properties?.ADM0_A3_PL);
    if (areaSqDeg(f) < MIN_AREA) { dropped.push(id); continue; }
    features.push({ type: 'Feature', id, properties: null, geometry: f.geometry });
  }
  for (const id of ['UKR', 'RUS', 'KOS', 'MAR']) {
    if (!features.some((f) => f.id === id)) throw new Error(`Expected a ${id} feature`);
  }

  // 2. One topology (shared borders simplify identically). Visvalingam weights, then coasts — arcs of one country
  // only, which are never drawn — are thinned harder than borders.
  const raw = topology({ countries: { type: 'FeatureCollection', features } as FeatureCollection }) as unknown as Topology<{ countries: GeometryCollection }>;
  const weighted = presimplify(raw);
  const countriesByArc = new Map<number, Set<number>>();
  weighted.objects.countries.geometries.forEach((g, i) => {
    for (const arc of ringsOf(g).flat()) {
      const k = arc < 0 ? ~arc : arc;
      countriesByArc.set(k, (countriesByArc.get(k) ?? new Set()).add(i));
    }
  });
  const isBorder = (arc: number) => (countriesByArc.get(arc < 0 ? ~arc : arc)?.size ?? 0) > 1;
  weighted.arcs.forEach((arc, k) => {
    const pts = arc as unknown as [number, number, number][];
    if (isBorder(k)) { for (const p of pts) if (p[2] < BORDER_MIN_WEIGHT) p[2] = 0; return; }
    const sig = deviations(pts);
    for (let i = 1; i < pts.length - 1; i++) if (sig[i]! < COAST_TOLERANCE) pts[i]![2] = 0;
  });
  const simple = simplify(weighted, Number.MIN_VALUE); // drops exactly the vertices zeroed above

  // 3. Only rings with a border stay (no islands, no holes left by dropped countries); quantize.
  // The filter gets a ring's arc indices (as filterAttached's source shows), not the coordinates its typings claim.
  const filtered = filter(simple, ((ring: number[]) => ring.some(isBorder)) as unknown as Parameters<typeof filter>[1]);
  const out = quantize(filtered, QUANTIZATION) as Topology<{ countries: GeometryCollection }>;
  out.objects.countries.geometries = out.objects.countries.geometries.map((g) =>
    g.type === 'MultiPolygon' && g.arcs.length === 1 ? { type: 'Polygon', arcs: g.arcs[0]!, id: g.id } : g);

  const json = JSON.stringify({ ...out, source: `Natural Earth ${NE_VERSION} 10m admin-0 countries, Poland point of view (public domain), naturalearthdata.com; built by scripts/build-world-borders.ts` });
  writeFileSync(OUT, json);
  const borders = mesh(out, out.objects.countries, (a, b) => a !== b);
  const points = borders.coordinates.reduce((n, l) => n + l.length, 0);
  console.log(`${OUT}: ${json.length} B (${(json.length / 1024).toFixed(1)} KiB); ${out.objects.countries.geometries.length} countries, border lines ${borders.coordinates.length}, border points ${points}`);
  console.log(`dropped (smaller than ${MIN_AREA} sq°): ${dropped.join(' ')}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e: unknown) => { console.error(e); process.exit(1); });
}
