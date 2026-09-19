import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, test } from 'vitest';
import { cityBoxById } from '../../src/map/cityBoxes';
import { makeFlatCtx } from '../../src/map/geometry';
import { overlaps, type LabelBox } from '../../src/map/labelLayout';
import { loadStreets, streetGeometryBuilds, streetsFor } from '../../src/map/streets';
import { placeStreetLabels, streetLabelWidth, STREET_FONT } from '../../src/map/styleLabels';

const box = cityBoxById('katowice')!;
const tokyo = cityBoxById('tokyo')!;
const ctx = (b = box, zoom = b.fitZoom) => makeFlatCtx(960, 480, { lat: b.lat, lon: b.lon }, zoom, 1, 'grid');

/* The page's data blocks are base64 gzip (scripts/city-plugin.ts); this project has no DOM for unit tests, so
   `document.getElementById` is stood up by hand over the real committed files. See tests/unit/streets.test.ts. */
const blocks = new Map<string, string>();
(globalThis as { document?: unknown }).document = {
  getElementById: (id: string) => (blocks.has(id) ? { textContent: blocks.get(id) } : null),
};

beforeAll(async () => {
  for (const id of ['katowice', 'tokyo']) {
    blocks.set(`geo-city-${id}`, readFileSync(`src/map/data/city/streets/${id}.json.gz`).toString('base64'));
    expect(await loadStreets(id as 'katowice')).toBe(true);
  }
});

describe('street labels', () => {
  /*
   * Placing the names must not rebuild the geometry beside them.
   *
   * `placeStreetLabels` used to get its names by calling `streetsFor`, which the street layer had already called
   * for the same box, zoom and view a moment earlier in the same frame — so every road class was re-filtered,
   * every rail, waterway, water and green part re-tested against the view and five fresh arrays built, twice a
   * frame, to read one field off the second copy. A frame-time bound is far too noisy to catch that coming back
   * (the harness in tests/e2e/perf-smoke.spec.ts measures in whole animation frames), so it is counted instead.
   */
  test('placing the names builds no geometry at all', () => {
    const c = ctx();
    // The layer's own call is the one that builds: prove the counter is live before asserting it stands still.
    const before = streetGeometryBuilds();
    streetsFor(box, c.zoom, c.bounds, 'en');
    expect(streetGeometryBuilds(), 'drawing the layer builds the geometry once').toBe(before + 1);
    const after = streetGeometryBuilds();
    const labels = placeStreetLabels(c, box, 'en', []);
    expect(labels.length, 'and the labels really were placed').toBeGreaterThan(0);
    expect(streetGeometryBuilds(), 'placing them builds nothing').toBe(after);
  });

  /*
   * Note what these tests can and cannot see. Every assertion below compares one label's box with another's, and
   * both boxes come from the same width model — so a model that under-measures its text looks perfectly tidy here
   * while the drawn letters overlap. The measurement that can tell is in tests/e2e/city-streets.spec.ts, which
   * reads the real `getBBox` of the glyphs at Tokyo, Giza and Katowice. These cover the ordering and the rules.
   */
  test('a name in a square script reserves a square box (ruling R19 is only as good as this)', () => {
    // A CJK glyph is drawn about a full em wide where a Latin letter is about 0.62: five Japanese characters are
    // wider than five Latin ones, not the same width, and the layout used to believe they were the same.
    expect(streetLabelWidth('渋谷三丁目', 10, 1)).toBeGreaterThan(streetLabelWidth('abcde', 10, 1) * 1.35);
    // Kana, Hangul and fullwidth forms are on the same square body as the ideographs: a full em each, at least.
    for (const text of ['渋谷三丁目', 'ストリート', '스트리트', 'ＡＢＣＤＥ']) {
      expect(streetLabelWidth(text, 10, 1), text).toBeGreaterThan(text.length * 10);
    }
    // Cyrillic, Greek, Arabic and Devanagari are not, and neither is Latin.
    for (const text of ['Хрещатик', 'Sokolska', 'شارع الهرم']) {
      expect(streetLabelWidth(text, 10, 1) / text.length, text).toBeLessThan(9);
    }
    // The whole model, pinned: tests/e2e/city-a11y.spec.ts measures the real ink of a dozen scripts in the
    // browser against these same four numbers, and restates them because it cannot import this module. A change
    // here without a change there would leave that measurement checking the wrong reservation.
    const em = (text: string) => streetLabelWidth(text, 10, 1) / 10 / 1.05;   // SAFETY divided back out
    expect((em('aaaaaaaaaa') - 0.3) / 10).toBeCloseTo(0.74, 10);              // the generic bucket
    expect((em('渋渋渋渋渋渋渋渋渋渋') - 0.3) / 10).toBeCloseTo(1.05, 10);      // the square-body bucket
    expect(streetLabelWidth('', 10, 1)).toBeCloseTo(0.3 * 1.05 * 10, 10);     // the 0.3 em lead, and SAFETY
    // Longer text is wider text, and the size and px factors scale it.
    expect(streetLabelWidth('abcdef', 10, 1)).toBeGreaterThan(streetLabelWidth('abcde', 10, 1));
    expect(streetLabelWidth('Sokolska', 10, 2)).toBeCloseTo(streetLabelWidth('Sokolska', 10, 1) * 2, 10);
    expect(streetLabelWidth('Sokolska', 20, 1)).toBeCloseTo(streetLabelWidth('Sokolska', 10, 1) * 2, 10);
  });

  test('names are placed, inside the view, and never on top of one another', () => {
    const labels = placeStreetLabels(ctx(), box, 'en', []);
    expect(labels.length).toBeGreaterThan(5);
    expect(STREET_FONT).toBe(10);
    for (const a of labels) {
      expect(a.box.left, a.text).toBeGreaterThanOrEqual(0);
      expect(a.box.right, a.text).toBeLessThanOrEqual(960);
      expect(a.box.top, a.text).toBeGreaterThanOrEqual(0);
      expect(a.box.bottom, a.text).toBeLessThanOrEqual(480);
      for (const b of labels) if (a !== b) expect(overlaps(a.box, b.box), `${a.text} / ${b.text}`).toBe(false);
    }
  });

  test('a lesson label always wins: a street name on its spot is left out, not moved onto it', () => {
    const c = ctx();
    const free = placeStreetLabels(c, box, 'en', []);
    const victim = free[0]!;
    const obstacle: LabelBox = { left: 0, top: 0, right: 960, bottom: 480 };   // the whole view
    expect(placeStreetLabels(c, box, 'en', [obstacle])).toEqual([]);
    // A single obstacle exactly over one name's three options removes that name and keeps the others.
    const tight: LabelBox = { left: victim.box.left - 2, right: victim.box.right + 2, top: victim.box.top - 20, bottom: victim.box.bottom + 20 };
    const some = placeStreetLabels(c, box, 'en', [tight]);
    expect(some.some((l) => l.text === victim.text)).toBe(false);
    expect(some.length).toBeGreaterThan(0);
  });

  test('no names at all when the view is not deep enough to read one', () => {
    expect(placeStreetLabels(ctx(box, 100), box, 'en', [])).toEqual([]);
  });

  test('district names are written before street names', () => {
    // Zoom 400 is past PLACE_NAME_ZOOM but short of STREET_NAME_ZOOM: districts only. The whole box is 90 px
    // across at that zoom, and a name has to fit inside it (see the box-clip test below), so only the shortest
    // of them — "Dąb" — has room. At 1400 the box is 315 px across and several do.
    const districts = placeStreetLabels(ctx(box, 400), box, 'en', []);
    expect(districts.length).toBeGreaterThan(0);
    expect(districts.every((l) => l.id.startsWith('n'))).toBe(true);
    expect(placeStreetLabels(ctx(box, 1400), box, 'en', []).filter((l) => l.id.startsWith('n')).length).toBeGreaterThan(1);
  });

  /*
   * A street name names something inside the box, and outside the box the roads simply stop: a name written past
   * the box's edge floats on the bare world map. Below the fit zoom that used to be most of them — at zoom 200,
   * where district names start, Katowice's box is 45 px across and "Osiedle Paderewskiego" was written 155 px
   * wide beside it — and even at the fit zoom a box is 3 by 2 km in a 2:1 view, so one axis leaves a strip of
   * world map (Rovaniemi 67 px above and below, Mitad del Mundo 72 px either side) that names stood in.
   */
  test('no name is written outside the box it belongs to', () => {
    for (const zoom of [200, 400, 900, 2500, box.fitZoom]) {
      const c = ctx(box, zoom);
      const halfW = ((box.bounds.east - box.bounds.west) / (360 / zoom)) * c.width / 2;
      const halfH = ((box.bounds.north - box.bounds.south) / (180 / zoom)) * c.height / 2;
      for (const l of placeStreetLabels(c, box, 'en', [])) {
        expect(l.box.left, `${l.text} @ ${zoom}`).toBeGreaterThanOrEqual(Math.max(0, c.width / 2 - halfW) - 0.5);
        expect(l.box.right, `${l.text} @ ${zoom}`).toBeLessThanOrEqual(Math.min(c.width, c.width / 2 + halfW) + 0.5);
        expect(l.box.top, `${l.text} @ ${zoom}`).toBeGreaterThanOrEqual(Math.max(0, c.height / 2 - halfH) - 0.5);
        expect(l.box.bottom, `${l.text} @ ${zoom}`).toBeLessThanOrEqual(Math.min(c.height, c.height / 2 + halfH) + 0.5);
      }
    }
    // At zoom 200 the box is 45 px across: nothing fits, and the map says nothing rather than writing a district
    // name on open countryside.
    expect(placeStreetLabels(ctx(box, 200), box, 'en', [])).toEqual([]);
  });

  test('a name in a script the reader cannot read is written in English instead (ruling R24)', () => {
    const c = ctx(tokyo);
    const japanese = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
    const en = placeStreetLabels(c, tokyo, 'en', []);
    const jaNames = en.filter((l) => l.id.startsWith('r') && japanese.test(l.text));
    expect(en.length).toBeGreaterThan(5);
    // Tokyo's streets that carry a name:en are written in it; the ones with no English name stay as they are.
    expect(en.some((l) => l.id.startsWith('r') && /^[\x20-\x7e]+$/.test(l.text))).toBe(true);
    for (const lang of ['pl', 'uk'] as const) {
      const other = placeStreetLabels(c, tokyo, lang, []);
      expect(other.some((l) => /^[\x20-\x7e]+$/.test(l.text)), lang).toBe(true);
    }
    // District names (OSM `place` nodes) have no name:en in the data at all, so they stay Japanese — which is
    // honest: nothing better exists to write there. They are never dropped for being unreadable.
    expect(jaNames.length + en.filter((l) => l.id.startsWith('n')).length).toBeGreaterThan(0);
  });

  test('district names a pupil can read come before ones they cannot, and only a few unreadable ones show', () => {
    // Every one of Tokyo's 161 district nodes carries a Japanese `name` and no `name:en`, so ruling R24 has
    // nothing to fall back on for them. Filling the district budget with them pushed out the readable street
    // names standing right beside them, which is the opposite of what R24 is for.
    const labels = placeStreetLabels(ctx(tokyo), tokyo, 'en', []);
    const districts = labels.filter((l) => l.id.startsWith('n'));
    const japanese = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
    expect(districts.length).toBeGreaterThan(0);
    expect(districts.filter((l) => japanese.test(l.text)).length).toBeLessThanOrEqual(3);
    // …and the readable street names that used to be crowded out are written.
    const latin = labels.filter((l) => l.id.startsWith('r') && /^[\x20-\x7e]+$/.test(l.text));
    expect(latin.length).toBeGreaterThan(5);
    // Katowice's districts are all readable in every language, so none of them is held back.
    expect(placeStreetLabels(ctx(box, 1400), box, 'pl', []).length).toBeGreaterThan(1);
  });

  test('the same view gives the same names twice running (nothing depends on call order)', () => {
    const a = placeStreetLabels(ctx(), box, 'en', []);
    const b = placeStreetLabels(ctx(), box, 'en', []);
    expect(b.map((l) => `${l.id}@${Math.round(l.x)},${Math.round(l.y)}`)).toEqual(a.map((l) => `${l.id}@${Math.round(l.x)},${Math.round(l.y)}`));
  });
});
