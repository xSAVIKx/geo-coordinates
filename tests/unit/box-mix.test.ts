import { describe, expect, test } from 'vitest';
import { CITY_PHOTO_FULL_ZOOM, CITY_PHOTO_ZOOM, cityBoxById } from '../../src/map/cityBoxes';
import { makeFlatCtx } from '../../src/map/geometry';
import { boxMix, regionMix } from '../../src/map/texture/inverse';
import { textureView } from '../../src/map/texture/viewParams';
import { REGION, REGION_MIN_ZOOM } from '../../src/map/world';

const katowice = cityBoxById('katowice')!;
const view = (lat: number, lon: number, zoom: number) =>
  textureView(makeFlatCtx(960, 480, { lat, lon }, zoom, 1, 'grid'));

describe('boxMix', () => {
  test('regionMix is unchanged: 0 at the minimum zoom, 1 one level above, 0 away from the region', () => {
    expect(regionMix(view(50, 19, REGION_MIN_ZOOM), REGION, REGION_MIN_ZOOM)).toBe(0);
    expect(regionMix(view(50, 19, REGION_MIN_ZOOM + 0.5), REGION, REGION_MIN_ZOOM)).toBeCloseTo(0.5, 10);
    expect(regionMix(view(50, 19, REGION_MIN_ZOOM + 3), REGION, REGION_MIN_ZOOM)).toBe(1);
    expect(regionMix(view(-20, -60, 20), REGION, REGION_MIN_ZOOM)).toBe(0);
  });

  test('a city box fades in between zoom 40 and zoom 80 (spec §5)', () => {
    const mix = (zoom: number) => boxMix(view(katowice.lat, katowice.lon, zoom), katowice.bounds, CITY_PHOTO_ZOOM, CITY_PHOTO_FULL_ZOOM);
    expect(mix(12)).toBe(0);          // the Atlas baseline scene's zoom (planning ruling R3)
    expect(mix(24)).toBe(0);
    expect(mix(40)).toBe(0);
    expect(mix(60)).toBeCloseTo(0.5, 10);
    expect(mix(80)).toBe(1);
    expect(mix(4270)).toBe(1);
  });

  test('a view nowhere near the box never mixes it in, however deep it is', () => {
    expect(boxMix(view(0, 0, 4000), katowice.bounds, CITY_PHOTO_ZOOM, CITY_PHOTO_FULL_ZOOM)).toBe(0);
    expect(boxMix(view(52.2297, 21.0122, 4000), katowice.bounds, CITY_PHOTO_ZOOM, CITY_PHOTO_FULL_ZOOM)).toBe(0);
  });
});
