import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, test } from 'vitest';
import { cityBoxById } from '../../src/map/cityBoxes';
import { makeFlatCtx } from '../../src/map/geometry';
import { overlaps, type LabelBox } from '../../src/map/labelLayout';
import { loadStreets } from '../../src/map/streets';
import { placeStreetLabels, STREET_FONT } from '../../src/map/styleLabels';

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
    // Zoom 400 is past PLACE_NAME_ZOOM but short of STREET_NAME_ZOOM: districts only. The whole box is 89 px
    // across at that zoom, so only the two or three nearest the middle of it have room.
    const districts = placeStreetLabels(ctx(box, 400), box, 'en', []);
    expect(districts.length).toBeGreaterThan(1);
    expect(districts.every((l) => l.id.startsWith('n'))).toBe(true);
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

  test('the same view gives the same names twice running (nothing depends on call order)', () => {
    const a = placeStreetLabels(ctx(), box, 'en', []);
    const b = placeStreetLabels(ctx(), box, 'en', []);
    expect(b.map((l) => `${l.id}@${Math.round(l.x)},${Math.round(l.y)}`)).toEqual(a.map((l) => `${l.id}@${Math.round(l.x)},${Math.round(l.y)}`));
  });
});
