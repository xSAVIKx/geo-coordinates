import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import boxesJson from '../../src/map/data/city/boxes.json';
import manifest from '../../src/map/data/city/streets/manifest.json';
import { decodeArcs } from '../../src/map/world';

const DIR = 'src/map/data/city/streets/';
const OBJECTS = ['roads', 'rail', 'waterways', 'water', 'green'] as const;
/** `c` is the StreetClass, `n` the name on the street sign, `e` an English name only where it differs (R24). */
type RoadProps = { c: number; n?: string; e?: string };
type StreetTopology = Topology<
  { roads: GeometryCollection<RoadProps> } & Record<Exclude<(typeof OBJECTS)[number], 'roads'>, GeometryCollection>
> & { places: { id: string; name: string; lat: number; lon: number }[]; source: string };

// The committed artefact is gzipped (see scripts/build-city-streets.ts); src/map/cityStreets.ts unpacks it in
// the page, and these tests read it the same way from disk.
const raw = (id: string) => gunzipSync(readFileSync(DIR + `${id}.json.gz`)).toString('utf8');
const topo = (id: string) => JSON.parse(raw(id)) as StreetTopology;
const roadsOf = (t: StreetTopology) => feature(t, t.objects.roads).features;
const ids = boxesJson.boxes.map((b) => b.id);

describe('city street data', () => {
  test('one file per box, listed in the manifest, with the ODbL attribution recorded once', () => {
    expect(Object.keys(manifest.streets)).toEqual(ids);
    expect(manifest.attribution).toBe('© OpenStreetMap contributors (ODbL)');
    for (const id of ids) {
      const e = manifest.streets[id as keyof typeof manifest.streets];
      expect(e.file, id).toBe(`${id}.json.gz`);
      expect(e.bytes, id).toBe(readFileSync(DIR + e.file).length);
      expect(e.rawBytes, id).toBe(Buffer.byteLength(raw(id), 'utf8'));
      expect(e.retrieved, id).toMatch(/^\d{4}-\d\d-\d\d$/);
    }
  });

  test('every topology has the five objects, is quantized, and names OpenStreetMap as its source', () => {
    for (const id of ids) {
      const t = topo(id);
      expect(Object.keys(t.objects).sort(), id).toEqual([...OBJECTS].sort());
      expect(t.transform, id).toBeDefined();          // quantized: arcs are integer deltas
      expect(t.source, id).toMatch(/OpenStreetMap/);
      expect(Array.isArray(t.places), id).toBe(true);
    }
  });

  test('every vertex is inside its own box (with a 5 % margin for a way that leaves and returns)', () => {
    for (const b of boxesJson.boxes) {
      const t = topo(b.id);
      const padLon = (b.east - b.west) * 0.05, padLat = (b.north - b.south) * 0.05;
      // One assertion per box, not per vertex: there are ~1.5 M vertices across the twelve, and an expect() each
      // takes the suite well past its timeout. Report the first vertex that escapes instead.
      const escaped = decodeArcs(t).flat().find(([lon, lat]) =>
        lon < b.west - padLon || lon > b.east + padLon || lat < b.south - padLat || lat > b.north + padLat);
      expect(escaped, `${b.id} has a vertex outside its box`).toBeUndefined();
      for (const p of t.places) {
        expect(p.lon >= b.west && p.lon <= b.east && p.lat >= b.south && p.lat <= b.north, `${b.id} place ${p.id}`).toBe(true);
      }
    }
  });

  test('road classes are 0-5 and every box has at least a main road and some residential streets', () => {
    for (const id of ids) {
      const roads = roadsOf(topo(id));
      const classes = new Set(roads.map((f) => f.properties.c));
      for (const c of classes) expect(c, `${id} class ${c}`).toBeGreaterThanOrEqual(0);
      for (const c of classes) expect(c, `${id} class ${c}`).toBeLessThanOrEqual(5);
      expect([...classes].some((c) => c <= 2), `${id} has no main road`).toBe(true);
      expect(classes.has(4), `${id} has no residential streets`).toBe(true);
      expect(roads.length, id).toBeGreaterThan(50);
    }
  });

  test('an English name is kept only where it differs from the local one (planning ruling R24)', () => {
    for (const id of ids) {
      const t = topo(id);
      const roads = roadsOf(t);
      for (const f of roads) {
        const p = f.properties;
        if (p.e !== undefined) {
          expect(p.n, `${id} ${p.e}`).toBeTruthy();
          expect(p.e, `${id} ${p.e}`).not.toBe(p.n);
        }
      }
      expect(manifest.streets[id as keyof typeof manifest.streets].english, id)
        .toBe(roads.filter((f) => 'e' in f.properties).length);
    }
    // Tokyo's street names are in Japanese, so that box is the one that needs them.
    expect(manifest.streets.tokyo.english).toBeGreaterThan(0);
  });

  test('Katowice, the school box, has the features the lesson points at', () => {
    const t = topo('katowice');
    const named = roadsOf(t).filter((f) => typeof f.properties.n === 'string');
    expect(named.length).toBeGreaterThan(80);
    expect(manifest.streets.katowice.named).toBe(named.length);
    expect(manifest.streets.katowice.rail).toBeGreaterThan(0);     // the station's tracks
    expect(manifest.streets.katowice.green).toBeGreaterThan(0);    // parks
  });

  // Ruling R22 (200 KiB a box, 1.9 MiB for the twelve) was extrapolated from one box's ROADS; with the four other
  // layers this task carries, the twelve are 2 670.6 KiB as text and no amount of simplifying reaches it (pushing
  // the Visvalingam weight 500x, which flattens every curve, still gives 2.37 MiB). The coordinator ruled that
  // the data stays whole and ships gzipped instead — so what the page pays is the .gz, base64'd into a block.
  // Deliberately not scripts/size-report.ts's SIZE_LIMIT_BYTES: this is a planning-time projection against
  // fixed historical baselines (TODAY, PHOTOS below), checked once at data-authoring time, not a live check of
  // the built file (tests/e2e/routes.spec.ts and scripts/size-check.ts do that, against the real dist/ bytes).
  // If the budget ever moves, update this literal too — it won't follow SIZE_LIMIT_BYTES automatically.
  const FILE_CAP = 8 * 1024 * 1024;   // global constraint: the built single file
  const TODAY = 3_387_703;            // dist/geo-coordinates.html before this feature
  const PHOTOS = 1_781_062;           // Task 1's twelve aerial photos
  const base64 = (n: number) => Math.ceil(n / 3) * 4;

  test('every file stays inside its byte ceiling, and the twelve inside the budget', () => {
    let total = 0;
    for (const id of ids) {
      const e = manifest.streets[id as keyof typeof manifest.streets];
      total += e.bytes;
      expect(e.bytes, `${id} (${(e.bytes / 1024).toFixed(1)} KiB gz)`).toBeLessThanOrEqual(128 * 1024);
      expect(e.bytes, `${id} gz is not smaller than its JSON`).toBeLessThan(e.rawBytes);
    }
    expect(total, `${(total / 1024).toFixed(1)} KiB gz`).toBeLessThanOrEqual(1024 * 1024);
    // What the twelve photos and the twelve street blocks actually cost the page, base64 included.
    const inPage = base64(PHOTOS) + base64(total);
    expect(TODAY + inPage, `${((TODAY + inPage) / 1024 / 1024).toFixed(2)} MiB before Tasks 4-8`)
      .toBeLessThanOrEqual(FILE_CAP - 1024 * 1024);
  });

  test('no building outlines anywhere (planning ruling R6: they would be 12-25 MB)', () => {
    for (const id of ids) expect(Object.keys(topo(id).objects), id).not.toContain('buildings');
  });
});
