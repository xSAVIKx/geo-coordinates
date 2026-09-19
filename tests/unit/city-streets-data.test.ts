import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { describe, expect, test } from 'vitest';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import boxesJson from '../../src/map/data/city/boxes.json';
import manifest from '../../src/map/data/city/streets/manifest.json';
import { decodeArcs } from '../../src/map/world';
import { waterAreaM2 } from '../../scripts/build-city-streets';

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

  /*
   * Water, per box, as a share of the 6 x 4 km box — the check that did not exist when the release shipped
   * Sydney Harbour as solid land.
   *
   * The first build asked Overpass for `way["natural"="water"]` only. Ruling R16 skipped relations and nothing
   * asked for `natural=coastline`, so the water a city is actually built around was missing everywhere it is
   * too big to be one closed way: Sydney 0.00 %, Manhattan 0.65 % (an island that was not one), Paris 0.12 %
   * (the Seine as a hairline), Warsaw 1.15 % and Kraków 1.07 % (no Vistula), Greenwich 4.91 % (the Thames
   * stopping at the peninsula). Every test in this file passed on that data, which is why it shipped.
   *
   * So each box carries a floor, and a box with no water carries a ceiling instead and has to say why. The
   * floors are roughly two thirds of what the committed files hold, which leaves room for OSM to be re-surveyed
   * without leaving room for a river to vanish.
   */
  const BOX_M2 = boxesJson.widthM * boxesJson.heightM;
  /** Least water each box must hold, as a share of the box. */
  const WATER_FLOOR: Readonly<Record<string, number>> = {
    sydney: 0.40,      // Sydney Harbour, Darling Harbour and Walsh Bay: measured 0.5163
    manhattan: 0.22,   // the Hudson and the East River: measured 0.3146
    greenwich: 0.050,  // the Thames round the peninsula and past it: measured 0.0764
    warsaw: 0.035,     // the Vistula: measured 0.0565
    delhi: 0.030,      // the Yamuna's channels and the ponds: measured 0.0468
    paris: 0.025,      // the Seine and the Bois de Boulogne lakes: measured 0.0418
    krakow: 0.020,     // the Vistula under Wawel: measured 0.0351
    katowice: 0.010,   // Bolina and the pit ponds: measured 0.0186
  };
  /**
   * Boxes with no water worth drawing, each checked against its own photograph (shots/water/<id>-water.png):
   * a floor here would be a floor on something that is not there. They carry a ceiling instead, so a box that
   * quietly *gains* a river — a box moved, a query widened — stops being covered by this list without anyone
   * noticing.
   */
  const WATER_NONE: Readonly<Record<string, string>> = {
    mitaddelmundo: 'the equator monument on a dry Andean plateau above Quito: no water in the box at all',
    rovaniemi: 'forest, the airport and the Arctic Circle village; the Kemijoki and the Ounasjoki are both south of the box',
    tokyo: 'Shibuya and Yoyogi: the Shibuya river is culverted under the streets, only two park ponds are open',
    giza: 'the pyramid plateau and the desert west of it; the Nile is about 8 km east of the box',
  };

  test('every box holds the water it is built around, or says in writing that it has none', () => {
    expect(Object.keys(WATER_FLOOR).length + Object.keys(WATER_NONE).length, 'every box is accounted for')
      .toBe(ids.length);
    for (const b of boxesJson.boxes) {
      const box: [number, number, number, number] = [b.west, b.south, b.east, b.north];
      const share = waterAreaM2(topo(b.id), box) / BOX_M2;
      const floor = WATER_FLOOR[b.id];
      if (floor === undefined) {
        expect(WATER_NONE[b.id], `${b.id} is in neither list`).toBeTruthy();
        expect(share, `${b.id} now holds ${(share * 100).toFixed(2)} % water but is on the "no water" list`)
          .toBeLessThan(0.01);
      } else {
        expect(share, `${b.id} holds ${(share * 100).toFixed(2)} % water, floor ${(floor * 100).toFixed(1)} %`)
          .toBeGreaterThanOrEqual(floor);
      }
      // The manifest is what the report and the release notes quote, so it may not drift from the file.
      const e = manifest.streets[b.id as keyof typeof manifest.streets];
      expect(Math.round(waterAreaM2(topo(b.id), box)), `${b.id} manifest waterM2`).toBe(e.waterM2);
    }
  });

  test('water is measured as ground under water, not as shapes added up', () => {
    // Sydney's box holds Sydney Harbour, Port Jackson and the Parramatta River over one stretch of water, so
    // adding the shapes' own areas gives 103 % of a box that is half water. The floors above would be
    // meaningless if the measure double-counted, and a box could pass one by being mapped twice.
    const b = boxesJson.boxes.find((x) => x.id === 'sydney')!;
    const share = waterAreaM2(topo('sydney'), [b.west, b.south, b.east, b.north]) / BOX_M2;
    expect(share).toBeLessThan(1);
    expect(share).toBeGreaterThan(0.4);
  });
});
