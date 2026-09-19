import { describe, expect, test } from 'vitest';
import boxesJson from '../../src/map/data/city/boxes.json';
import { boxAround, CITY_BOX_HEIGHT_M, CITY_BOX_SPECS, CITY_BOX_WIDTH_M } from '../../scripts/city-boxes';
import {
  CITY_BOXES, CITY_BOX_IDS, CITY_PHOTO_ZOOM, CITY_STREET_ZOOM, cityBoxAt, cityBoxById, fitZoom, visibleCityBox,
} from '../../src/map/cityBoxes';

const RAD = Math.PI / 180;
const box = (id: string) => CITY_BOXES.find((b) => b.id === id)!;

describe('city boxes', () => {
  test('the twelve of spec §3, in its order, three of them with a teaching note', () => {
    expect(CITY_BOX_IDS).toEqual(['katowice', 'greenwich', 'mitaddelmundo', 'rovaniemi', 'warsaw', 'krakow',
      'paris', 'manhattan', 'delhi', 'sydney', 'tokyo', 'giza']);
    expect(CITY_BOXES.filter((b) => b.note).map((b) => b.id)).toEqual(['greenwich', 'mitaddelmundo', 'rovaniemi']);
    expect(cityBoxById('katowice')).toBe(box('katowice'));
    expect(cityBoxById('atlantis')).toBeNull();
  });

  test('every box is 6 x 4 km in metres, whatever its latitude', () => {
    for (const b of CITY_BOXES) {
      const heightM = (b.bounds.north - b.bounds.south) * 111_320;
      const widthM = (b.bounds.east - b.bounds.west) * 111_320 * Math.cos(b.lat * RAD);
      expect(heightM, b.id).toBeCloseTo(CITY_BOX_HEIGHT_M, 0);
      expect(widthM, b.id).toBeCloseTo(CITY_BOX_WIDTH_M, 0);
      expect((b.bounds.west + b.bounds.east) / 2, b.id).toBeCloseTo(b.lon, 6);
      expect((b.bounds.south + b.bounds.north) / 2, b.id).toBeCloseTo(b.lat, 6);
    }
  });

  test('boxes.json is exactly what scripts/city-boxes.ts produces (run npm run data:city-boxes if this fails)', () => {
    expect(boxesJson.widthM).toBe(CITY_BOX_WIDTH_M);
    expect(boxesJson.heightM).toBe(CITY_BOX_HEIGHT_M);
    expect(boxesJson.boxes.map((b) => b.id)).toEqual(CITY_BOX_SPECS.map((s) => s.id));
    for (const s of CITY_BOX_SPECS) {
      const b = boxesJson.boxes.find((x) => x.id === s.id)!;
      const { west, south, east, north, ...spec } = b;
      expect(spec, s.id).toEqual({ ...s });
      expect({ west, south, east, north }, s.id).toEqual(boxAround(s.lat, s.lon, CITY_BOX_WIDTH_M, CITY_BOX_HEIGHT_M));
    }
  });

  test('fit zoom: the box just fills a 960 x 480 view', () => {
    expect(Math.round(fitZoom(box('katowice').bounds))).toBe(4270);
    expect(Math.round(fitZoom(box('rovaniemi').bounds))).toBe(2659);          // the widest box in degrees
    expect(Math.round(fitZoom(box('mitaddelmundo').bounds))).toBe(5009);      // height-bound, like most boxes
    expect(Math.max(...CITY_BOXES.map((b) => fitZoom(b.bounds)))).toBeLessThan(6000);  // under FLAT_MAX_ZOOM
  });

  test('membership needs the street zoom, so nothing is in a box at the Atlas baseline zoom of 12', () => {
    const k = box('katowice');
    expect(cityBoxAt({ lat: 50.26, lon: 19.02 }, 12)).toBeNull();
    expect(visibleCityBox({ west: 4, south: 35, east: 34, north: 65 }, 12)).toBeNull();
    expect(cityBoxAt({ lat: 50.26, lon: 19.02 }, CITY_STREET_ZOOM)).toBe(k);
    expect(cityBoxAt({ lat: 50.26, lon: 19.02 }, CITY_PHOTO_ZOOM)).toBe(k);
    // Just outside the box's own bounds, at a zoom that would allow it.
    expect(cityBoxAt({ lat: 50.26, lon: k.bounds.east + 0.001 }, 4000)).toBeNull();
    expect(visibleCityBox(k.bounds, 4000)).toBe(k);
    expect(visibleCityBox({ west: 20, south: 50, east: 21, north: 51 }, 4000)).toBeNull();
  });

  /*
   * At the zoom the streets first appear, the view is 15° across and three Polish boxes can be inside it at
   * once. `visibleCityBox` used to answer with the first of them in the table, so panning towards Kraków lit up
   * Warsaw's streets up to zoom 42 and Katowice's up to zoom 428 — over Kraków's rooftops, with Kraków's own
   * box right there. The comment above it claimed at most one box could ever match, which is only true deep in.
   */
  test('the box nearest the middle of the view wins, not the first one in the table', () => {
    const kra = box('krakow'), kat = box('katowice'), war = box('warsaw');
    // A view centred on Kraków wide enough to hold Katowice and Warsaw too.
    const over = (b: typeof kra, halfLon: number, halfLat: number) => ({
      west: b.lon - halfLon, east: b.lon + halfLon, south: b.lat - halfLat, north: b.lat + halfLat,
    });
    for (const zoom of [CITY_STREET_ZOOM, 42, 100, 428, 1000]) {
      const view = over(kra, 180 / zoom, 90 / zoom);
      expect(visibleCityBox(view, zoom), `Kraków at zoom ${zoom}`).toBe(kra);
      expect(visibleCityBox(over(kat, 180 / zoom, 90 / zoom), zoom), `Katowice at zoom ${zoom}`).toBe(kat);
      expect(visibleCityBox(over(war, 180 / zoom, 90 / zoom), zoom), `Warsaw at zoom ${zoom}`).toBe(war);
    }
    // Every box, at the widest view that still draws streets: the box under the middle is the one drawn.
    for (const b of CITY_BOXES) {
      expect(visibleCityBox(over(b, 180 / CITY_STREET_ZOOM, 90 / CITY_STREET_ZOOM), CITY_STREET_ZOOM), b.id).toBe(b);
    }
  });

  test('no two boxes overlap, so at most one is ever in view', () => {
    for (let i = 0; i < CITY_BOXES.length; i++) {
      for (let j = i + 1; j < CITY_BOXES.length; j++) {
        const a = CITY_BOXES[i]!.bounds, b = CITY_BOXES[j]!.bounds;
        expect(a.east < b.west || b.east < a.west || a.north < b.south || b.north < a.south,
          `${CITY_BOXES[i]!.id} vs ${CITY_BOXES[j]!.id}`).toBe(true);
      }
    }
  });
});
