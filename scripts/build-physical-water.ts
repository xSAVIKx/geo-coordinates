// Builds src/map/data/physical-water.json — world rivers and lakes for the Physical map style (Map styles spec §3).
// Central Europe uses its own detailed rivers and lakes (src/map/data/central-europe.json) from zoom 4 and 6.
//
// Source: Natural Earth (public domain) 5.1.1, https://www.naturalearthdata.com/, GeoJSON mirror
//   https://github.com/nvkelso/natural-earth-vector/tree/master/geojson (retrieved 2026-09-15):
//   ne_50m_rivers_lake_centerlines, ne_50m_lakes.
// Usage: node --experimental-strip-types scripts/build-physical-water.ts [download-dir] [--download]
//   (download-dir defaults to .cache/natural-earth)
//
// Processing: rivers and lake centre lines with scalerank ≤ MAX_RANK (9, kept all ranks), lakes → rings wound
// for d3 (exterior clockwise on the sphere) → one topology → Visvalingam simplification (MIN_WEIGHT, tuned to
// 0.004 sq deg to land under the 260 KiB budget while keeping the Vistula test passing) → quantized.
// Properties: r = scalerank.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { geoArea } from 'd3-geo';
import { topology } from 'topojson-server';
import { presimplify, simplify } from 'topojson-simplify';
import { quantize } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';

const OUT = 'src/map/data/physical-water.json';
const DEFAULT_DIR = '.cache/natural-earth';
const BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/';
const FILES = { rivers: 'ne_50m_rivers_lake_centerlines', lakes: 'ne_50m_lakes' } as const;
const MAX_RANK = 9;
const MIN_WEIGHT = 0.004; // square degrees
const QUANTIZATION = 1e5;

async function read(dir: string, name: string, download: boolean): Promise<FeatureCollection> {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.geojson`);
  if (!existsSync(path)) {
    if (!download) throw new Error(`Missing ${path} (run with --download or fetch ${BASE}${name}.geojson)`);
    const res = await fetch(`${BASE}${name}.geojson`);
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${name}`);
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return JSON.parse(readFileSync(path, 'utf8')) as FeatureCollection;
}

/** Reverses a polygon's rings when d3 would read its exterior as the rest of the sphere. */
function windForD3(g: Geometry): Geometry {
  const fix = (rings: Position[][]) => (geoArea({ type: 'Polygon', coordinates: [rings[0]!] }) > 2 * Math.PI ? rings.map((r) => [...r].reverse()) : rings);
  if (g.type === 'Polygon') return { type: 'Polygon', coordinates: fix(g.coordinates) };
  if (g.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: g.coordinates.map(fix) };
  return g;
}

async function main() {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--')) ?? DEFAULT_DIR;
  const download = args.includes('--download');
  const slim = (fc: FeatureCollection, wind: boolean): FeatureCollection => ({
    type: 'FeatureCollection',
    features: fc.features
      .filter((f): f is Feature & { geometry: Geometry } => f.geometry !== null && Number(f.properties?.scalerank ?? 99) <= MAX_RANK)
      .map((f) => ({ type: 'Feature', properties: { r: Number(f.properties!.scalerank) }, geometry: wind ? windForD3(f.geometry) : f.geometry })),
  });
  const rivers = slim(await read(dir, FILES.rivers, download), false);
  const lakes = slim(await read(dir, FILES.lakes, download), true);
  type WaterTopology = Topology<{ rivers: GeometryCollection<{ r: number }>; lakes: GeometryCollection<{ r: number }> }>;
  const raw = topology({ rivers, lakes }) as unknown as WaterTopology;
  const out = quantize(simplify(presimplify(raw), MIN_WEIGHT), QUANTIZATION) as WaterTopology;
  const json = JSON.stringify({ ...out, source: 'Natural Earth 5.1.1 50m rivers and lake centre lines, 50m lakes (public domain), naturalearthdata.com; simplified by scripts/build-physical-water.ts' });
  writeFileSync(OUT, json);
  console.log(`${OUT}: ${json.length} B (${(json.length / 1024).toFixed(1)} KiB); ${rivers.features.length} rivers, ${lakes.features.length} lakes`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e: unknown) => { console.error(e); process.exit(1); });
}
