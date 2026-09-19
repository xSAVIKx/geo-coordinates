import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, test } from 'vitest';
import { CITY_BOXES, cityBoxById, CITY_STREET_ZOOM } from '../../src/map/cityBoxes';
import { FLAT_MAX_ZOOM } from '../../src/map/mapState.svelte';
import { disableStreets, loadStreets, PLACE_NAME_ZOOM, readableHere, readableName, resetStreets, streetClassMinZoom, streetFade, streetNamesFor, streetsDisabled, streetsFor, streetsLoaded, STREET_CLASS_MIN_ZOOM } from '../../src/map/streets';
import type { GeoBounds } from '../../src/map/geometry';

const box = cityBoxById('katowice')!;
const all: GeoBounds = box.bounds;

/*
 * The data blocks the page carries are made by scripts/city-plugin.ts: the base64 of the *gzipped* TopoJSON
 * (src/map/data/city/streets/<id>.json.gz), which src/map/cityStreets.ts inflates with DecompressionStream. There
 * is no jsdom or happy-dom in this project and vitest.config.ts runs `environment: 'node'`, so this test stands the
 * smallest possible `document` up by hand — `getElementById` is all streets.ts asks of it — and fills it with the
 * real committed bytes, packed exactly as the plugin packs them.
 */
function putBlock(id: string): void {
  blocks.set(`geo-city-${id}`, readFileSync(`src/map/data/city/streets/${id}.json.gz`).toString('base64'));
}
const blocks = new Map<string, string>();
(globalThis as { document?: unknown }).document = {
  getElementById: (id: string) => (blocks.has(id) ? { textContent: blocks.get(id) } : null),
};

beforeAll(async () => {
  putBlock('katowice');
  expect(await loadStreets('katowice')).toBe(true);
});

describe('city streets', () => {
  test('a box is parsed only when it is first asked for', async () => {
    expect(streetsLoaded('warsaw')).toBe(false);
    expect(streetsLoaded('katowice')).toBe(true);
    // No block in the page: the layer is dropped, not the map (spec §5 fallback), so this resolves false.
    expect(await loadStreets('warsaw')).toBe(false);
    expect(streetsLoaded('warsaw')).toBe(false);
  });

  test('at the fit zoom the main network is drawn, with the classes in order', () => {
    const s = streetsFor(box, box.fitZoom, all, 'en');
    expect(s.roads.map((r) => r.cls)).toEqual([0, 1, 2, 3, 4, 5].filter((c) => s.roads.some((r) => r.cls === c)));
    expect(s.roads.length).toBeGreaterThan(3);
    expect(s.roads.every((r) => r.line.coordinates.length > 0)).toBe(true);
    expect(s.rail.coordinates.length).toBeGreaterThan(0);
    expect(s.green.coordinates.length).toBeGreaterThan(0);
  });

  test('zoomed out, only the main roads are drawn; zoomed in, the small ones join', () => {
    const wide = streetsFor(box, 60, all, 'en');
    const close = streetsFor(box, box.fitZoom, all, 'en');
    const ladder = streetClassMinZoom(box);
    expect(Math.max(...wide.roads.map((r) => r.cls))).toBeLessThan(Math.max(...close.roads.map((r) => r.cls)));
    for (const r of wide.roads) expect(60, `class ${r.cls}`).toBeGreaterThanOrEqual(ladder[r.cls]!);
    // Four fixed rungs, then two that follow the box itself; the whole ladder still only ever climbs.
    expect(STREET_CLASS_MIN_ZOOM).toHaveLength(4);
    expect(ladder).toHaveLength(6);
    expect(ladder[0]).toBe(CITY_STREET_ZOOM);
    for (let i = 1; i < 6; i++) expect(ladder[i]!, `class ${i}`).toBeGreaterThan(ladder[i - 1]!);
  });

  /*
   * The view the close-up list lands on shows the ordinary street grid, and the alleys arrive one step past it.
   *
   * Task 8 held classes 4 and 5 back to a single 5 200 / 5 600 for all twelve, which was the wrong shape: the fit
   * zooms run 2 659 to 5 009, so that pair sat at 1.04 x the fit zoom at Giza and 1.96 x at Rovaniemi, and in
   * *every* box the arriving view — `showCityBox` sets the zoom to exactly `fitZoom` — had no `residential`
   * streets on it at all. A pupil tapping "Katowice — the school" was shown the motorway and four main roads and
   * not the school's own street. So class 4 now comes in at the box's own fit zoom and class 5 at 1.15 x it.
   *
   * Both still have to stay under the flat map's ceiling, or the alleys would never be reachable.
   */
  test('the ordinary streets are there at the fit zoom and the alleys one step past it, in every box', async () => {
    const unreadable: string[] = [];
    for (const b of CITY_BOXES) {
      const ladder = streetClassMinZoom(b);
      expect(ladder[4]!, `${b.id} class 4 at the fit zoom`).toBeLessThanOrEqual(b.fitZoom);
      expect(ladder[5]!, `${b.id} class 5 past the fit zoom`).toBeGreaterThan(b.fitZoom);
      expect(ladder[5]!, `${b.id} class 5 has to be reachable`).toBeLessThan(FLAT_MAX_ZOOM);
      putBlock(b.id);
      // `loadStreets` remembers a box it could not read, and the first test in this file deliberately asks for
      // one while its block is missing, so that id stays unreadable for the rest of the run. Every other box
      // loads, and the count below makes sure that is the only one that does not.
      if (!(await loadStreets(b.id))) { unreadable.push(b.id); continue; }
      const fit = streetsFor(b, b.fitZoom, b.bounds, 'en');
      expect(fit.roads.length, `${b.id} draws its main network at the fit zoom`).toBeGreaterThan(2);
      expect(fit.roads.map((r) => r.cls), `${b.id} shows the ordinary grid on arrival`).toContain(4);
      expect(fit.roads.map((r) => r.cls), `${b.id} keeps the alleys back on arrival`).not.toContain(5);
      // …and the alleys really do arrive: the same box one step deeper draws class 5.
      expect(streetsFor(b, ladder[5]! + 1, b.bounds, 'en').roads.map((r) => r.cls), b.id).toContain(5);
    }
    expect(unreadable, 'only the box this file deliberately broke may be unreadable').toEqual(['warsaw']);
  });

  test('a class is only named where it is drawn, so no name stands over a street that is not there', () => {
    const ladder = streetClassMinZoom(box);
    // Below class 3's rung neither the tertiary roads nor their names are there…
    const shallow = streetsFor(box, ladder[3]! - 1, all, 'en');
    expect(shallow.roads.map((r) => r.cls)).not.toContain(3);
    expect(shallow.names.filter((n) => n.cls === 3)).toEqual([]);
    // …and at the fit zoom, where the ordinary grid arrives, its names arrive with it.
    const fit = streetsFor(box, box.fitZoom, all, 'en');
    expect(fit.roads.map((r) => r.cls)).toContain(4);
    expect(fit.names.filter((n) => n.cls === 4).length).toBeGreaterThan(0);
    // Class 5 is drawn past the fit zoom but is never named at any zoom: too many, too short.
    const deep = streetsFor(box, ladder[5]! + 1, all, 'en');
    expect(deep.roads.map((r) => r.cls)).toContain(5);
    expect(deep.names.filter((n) => n.cls === 5)).toEqual([]);
  });

  /*
   * `streetNamesFor` is the half of `streetsFor` the label layout needs, split out so a frame inside a box does
   * not build and clip every road, rail, waterway, water and green part twice (the fix report's Important 6).
   * It has to agree with the whole exactly, or a name could be placed for a street the layer is not drawing.
   */
  test('the names-only reading agrees with the full one, box by box and zoom by zoom', () => {
    for (const zoom of [PLACE_NAME_ZOOM, 1000, box.fitZoom, box.fitZoom * 1.2]) {
      for (const lang of ['en', 'pl', 'uk'] as const) {
        expect(streetNamesFor(box, zoom, lang), `${zoom} ${lang}`).toEqual(streetsFor(box, zoom, all, lang).names);
      }
    }
  });

  test('only the part of the box the view can see is built', () => {
    const half: GeoBounds = { west: box.bounds.west, south: box.bounds.south, east: box.lon, north: box.lat };
    const part = streetsFor(box, box.fitZoom, half, 'en');
    const whole = streetsFor(box, box.fitZoom, all, 'en');
    const count = (s: typeof whole) => s.roads.reduce((n, r) => n + r.line.coordinates.length, 0);
    expect(count(part)).toBeLessThan(count(whole));
    expect(count(part)).toBeGreaterThan(0);
  });

  test('names appear only when a street name could be read, and never twice', () => {
    expect(streetsFor(box, 100, all, 'en').names).toEqual([]);
    const names = streetsFor(box, box.fitZoom, all, 'en').names;
    expect(names.length).toBeGreaterThan(10);
    expect(new Set(names.map((n) => n.text)).size).toBe(names.length);
    expect(new Set(names.map((n) => n.id)).size).toBe(names.length);
    for (const n of names) {
      expect(n.text.trim(), n.id).not.toBe('');
      expect(n.lat >= box.bounds.south && n.lat <= box.bounds.north, n.id).toBe(true);
      expect(n.lon >= box.bounds.west && n.lon <= box.bounds.east, n.id).toBe(true);
    }
  });

  test('district names come a long way before street names', () => {
    const districts = streetsFor(box, 400, all, 'en').names;
    expect(districts.length).toBeGreaterThan(5);
    expect(districts.every((n) => n.id.startsWith('n'))).toBe(true);
    expect(streetsFor(box, box.fitZoom, all, 'en').names.some((n) => n.id.startsWith('r'))).toBe(true);
  });

  test('a name in a script the reader cannot read falls back to name:en (planning ruling R24)', () => {
    expect(readableName('Rue de Rivoli', 'Rivoli Street', 'pl')).toBe('Rue de Rivoli');
    expect(readableName('青梅街道', 'Ome-kaido Avenue', 'en')).toBe('Ome-kaido Avenue');
    expect(readableName('青梅街道', 'Ome-kaido Avenue', 'uk')).toBe('Ome-kaido Avenue');
    expect(readableName('青梅街道', undefined, 'en')).toBe('青梅街道');       // nothing better to offer
    expect(readableName('Хрещатик', 'Khreshchatyk', 'uk')).toBe('Хрещатик'); // Cyrillic is readable in Ukrainian
    expect(readableName('Хрещатик', 'Khreshchatyk', 'pl')).toBe('Khreshchatyk');
    expect(readableName('कनॉट प्लेस', 'Connaught Place', 'pl')).toBe('Connaught Place');
  });

  test('Polish diacritics are Latin, and stay as they are written in every language', () => {
    for (const lang of ['en', 'pl', 'uk'] as const) {
      expect(readableName('Aleja Wojciecha Korfantego', undefined, lang)).toBe('Aleja Wojciecha Korfantego');
      expect(readableName('Żeliwna', 'Iron Street', lang)).toBe('Żeliwna');
    }
    expect(streetsFor(box, box.fitZoom, all, 'pl').names.some((n) => /[ąćęłńóśźż]/i.test(n.text))).toBe(true);
  });

  test('a name is readable here when it is in a script this language uses (ruling R24)', () => {
    expect(readableHere('Sokolska', 'pl')).toBe(true);
    expect(readableHere('Хрещатик', 'uk')).toBe(true);
    expect(readableHere('Хрещатик', 'pl')).toBe(false);
    expect(readableHere('渋谷三丁目', 'en')).toBe(false);
    expect(readableHere('كوم الأخضر', 'en')).toBe(false);
  });

  /*
   * A name is readable only when *every* letter in it is. The first version asked whether the name contained
   * any Latin letter at all, so one roman capital in a Japanese name — the JR lines and the expressway ramps
   * are full of them — was enough to keep the local form and throw the English one away.
   */
  test('one Latin letter in a name does not make the rest of it readable', () => {
    expect(readableHere('JR山手線', 'en')).toBe(false);
    expect(readableName('JR山手線', 'Yamanote Line', 'en')).toBe('Yamanote Line');
    expect(readableName('首都高速道路 C1', 'Shuto Expressway C1', 'pl')).toBe('Shuto Expressway C1');
    expect(readableName('वसंत Marg', 'Vasant Marg', 'uk')).toBe('Vasant Marg');
    // Digits, spaces and punctuation decide nothing either way.
    expect(readableHere('Aleja 3 Maja', 'pl')).toBe(true);
    expect(readableHere('Вулиця 8 Березня', 'uk')).toBe(true);
    expect(readableHere('66', 'en')).toBe(true);
  });

  test('a failure switches this layer off and nothing else, for the session only', () => {
    expect(streetsDisabled()).toBe(false);
    expect(streetsFor(box, box.fitZoom, all, 'en').roads.length).toBeGreaterThan(0);
    // Whatever went wrong — a bad topology, a broken level of detail, a throw inside a render — the layer goes
    // quiet and `streetsFor` keeps answering. It must never raise the shared vector-fail health event, which
    // means "this device cannot draw this style" and would take Political and Physical down with it.
    disableStreets(new Error('forced'));
    expect(streetsDisabled()).toBe(true);
    const off = streetsFor(box, box.fitZoom, all, 'en');
    expect(off.roads).toEqual([]);
    expect(off.names).toEqual([]);
    expect(off.green.coordinates).toEqual([]);
    resetStreets();
    expect(streetsDisabled()).toBe(false);
    expect(streetsFor(box, box.fitZoom, all, 'en').roads.length).toBeGreaterThan(0);
  });

  test('an empty answer is a fresh one each time, never a shared object a caller could edit', () => {
    disableStreets(new Error('forced'));
    const a = streetsFor(box, box.fitZoom, all, 'en');
    a.roads.push({ cls: 0, line: { type: 'MultiLineString', coordinates: [] } });
    expect(streetsFor(box, box.fitZoom, all, 'en').roads).toEqual([]);
    resetStreets();
  });

  test('a name sits in the same place at every level of detail', () => {
    // The candidates are read once from the unthinned arcs, so crossing a level boundary while zooming cannot
    // make a name hop to the middle of that level's own copy of its street.
    const at = (zoom: number) => new Map(streetsFor(box, zoom, all, 'en').names.map((n) => [n.text, `${n.lat},${n.lon}`]));
    const deep = at(box.fitZoom);
    for (const zoom of [1000, 1700, 3000]) {
      for (const [text, spot] of at(zoom)) expect(deep.get(text), `${text} at zoom ${zoom}`).toBe(spot);
    }
  });

  test('the layer fades in over one octave from the street zoom', () => {
    expect(streetFade(CITY_STREET_ZOOM)).toBe(0);
    expect(streetFade(CITY_STREET_ZOOM * 1.5)).toBeCloseTo(0.5, 10);
    expect(streetFade(CITY_STREET_ZOOM * 2)).toBe(1);
    expect(streetFade(4000)).toBe(1);
    expect(streetFade(12)).toBe(0);
  });
});
