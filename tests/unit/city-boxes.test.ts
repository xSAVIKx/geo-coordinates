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
