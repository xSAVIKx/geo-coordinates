// Builds src/map/data/political-pol.json — country shapes for the Political map style (Map styles spec §3): pastel
// fills whose neighbours differ, the coast and borders drawn from the same shapes, and label data. Natural Earth's
// Poland point of view, like src/map/data/world-borders-pol.json (scripts/build-world-borders.ts): Crimea, Sevastopol,
// Donetsk and Luhansk in Ukraine; Kosovo a country; Western Sahara in Morocco.
//
// Source: Natural Earth (public domain), https://www.naturalearthdata.com/, GeoJSON mirror
//   https://github.com/nvkelso/natural-earth-vector/tree/master/geojson (VERSION 5.1.1, retrieved 2026-09-15):
//   ne_10m_admin_0_countries_pol.
//
// Usage:
//   node --experimental-strip-types scripts/build-political.ts [download-dir] [--download]
// download-dir defaults to .cache/natural-earth (git-ignored, shared with data:borders).
//
// Processing: countries of MIN_AREA square degrees or more → one topology (shared borders simplify identically) →
// Visvalingam weights, vertices under MIN_WEIGHT dropped → rings under RING_MIN_AREA dropped → quantized. Colours
// by DSatur over shared arcs (scripts/political-colours.ts). Properties per country: a2 (ISO_A2_EH, '' if none),
// c (colour), lr (LABELRANK), ml (MIN_LABEL), lx/ly (LABEL_X/LABEL_Y).
//
// Tuning (brief step 6): MIN_WEIGHT 0.004 gave a 515 KiB file (over the 300 KiB limit); raised to 0.02, which keeps
// Sevastopol inside Ukraine and lands at about 240 KiB. QUANTIZATION left at 1e5.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { geoArea } from 'd3-geo';
import { topology } from 'topojson-server';
import { filter, filterWeight, presimplify, simplify } from 'topojson-simplify';
import { feature, neighbors, quantize } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { colourCountries } from './political-colours.ts';

const OUT = 'src/map/data/political-pol.json';
const DEFAULT_DIR = '.cache/natural-earth';
const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const FILE = 'ne_10m_admin_0_countries_pol';
const NE_VERSION = '5.1.1';
const MIN_AREA = 0.02;      // square degrees: Malta (0.03) and Andorra stay, Liechtenstein (0.02−) goes
const MIN_WEIGHT = 0.02;    // square degrees (Visvalingam): about Natural Earth 50m detail
const RING_MIN_AREA = 0.01; // square degrees: islets below this disappear
const QUANTIZATION = 1e5;
const SQ_DEG_PER_STERADIAN = (180 / Math.PI) ** 2;

interface CountryProps { a2: string; c: number; lr: number; ml: number; lx: number; ly: number }

async function ensure(dir: string, download: boolean): Promise<string> {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${FILE}.geojson`);
  if (existsSync(path)) return path;
  if (!download) throw new Error(`Missing ${path} (run with --download or fetch ${BASE}${FILE}.geojson)`);
  const res = await fetch(`${BASE}${FILE}.geojson`);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${FILE}`);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  return path;
}

/** Area in square degrees, whichever way the rings are wound. */
function areaSqDeg(f: Feature): number {
  const a = geoArea(f);
  return Math.min(a, 4 * Math.PI - a) * SQ_DEG_PER_STERADIAN;
}

async function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--')) ?? DEFAULT_DIR;
  const source = JSON.parse(readFileSync(await ensure(dir, args.includes('--download')), 'utf8')) as FeatureCollection<Polygon | MultiPolygon>;

  const features: Feature<Polygon | MultiPolygon, CountryProps>[] = [];
  for (const f of source.features) {
    if (areaSqDeg(f) < MIN_AREA) continue;
    const p = f.properties as Record<string, unknown>;
    const a2 = String(p.ISO_A2_EH);
    features.push({
      type: 'Feature', id: String(p.ADM0_A3_PL), geometry: f.geometry,
      properties: { a2: /^[A-Z]{2}$/.test(a2) ? a2 : '', c: 0, lr: Number(p.LABELRANK), ml: Number(p.MIN_LABEL), lx: Math.round(Number(p.LABEL_X) * 100) / 100, ly: Math.round(Number(p.LABEL_Y) * 100) / 100 },
    });
  }

  const raw = topology({ countries: { type: 'FeatureCollection', features } as FeatureCollection }) as unknown as Topology<{ countries: GeometryCollection<CountryProps> }>;
  const simple = simplify(presimplify(raw), MIN_WEIGHT);
  const filtered = filter(simple, filterWeight(simple, RING_MIN_AREA)) as typeof raw;
  const out = quantize(filtered, QUANTIZATION) as typeof raw;

  const geoms = out.objects.countries.geometries;
  const colours = colourCountries(geoms.map((g) => String(g.id)), neighbors(geoms));
  geoms.forEach((g, i) => { g.properties = { ...g.properties!, c: colours[i]! }; });

  // d3 draws a polygon's exterior ring clockwise; a ring wound the other way would cover the rest of the sphere.
  const check = feature(out, out.objects.countries);
  for (const f of check.features) if (geoArea(f) > 2 * Math.PI) throw new Error(`${f.id}: wound counter-clockwise (fix rings before topology)`);

  const json = JSON.stringify({ ...out, source: `Natural Earth ${NE_VERSION} 10m admin-0 countries, Poland point of view (public domain), naturalearthdata.com; simplified by scripts/build-political.ts` });
  writeFileSync(OUT, json);
  const points = out.arcs.reduce((n, a) => n + a.length, 0);
  console.log(`${OUT}: ${json.length} B (${(json.length / 1024).toFixed(1)} KiB); ${geoms.length} countries, ${points} arc points, ${Math.max(...colours) + 1} colours`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e: unknown) => { console.error(e); process.exit(1); });
}
