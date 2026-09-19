import { describe, expect, test } from 'vitest';
import { FLAT_MAX_ZOOM, MapState, SCHOOL_MAX_ZOOM } from '../../src/map/mapState.svelte';
import { CITY_BOXES } from '../../src/map/cityBoxes';

describe('MapState and the city close-ups', () => {
  test('the flat map reaches every box\'s fit zoom; the globe and the school views do not follow it up', () => {
    expect(FLAT_MAX_ZOOM).toBe(6000);
    expect(SCHOOL_MAX_ZOOM).toBe(80);
    const s = new MapState();
    for (const b of CITY_BOXES) {
      s.setFlatView(b, b.fitZoom);
      expect(s.flat.zoom, b.id).toBeCloseTo(b.fitZoom, 6);
      expect(s.flat.center.lat, b.id).toBeCloseTo(b.lat, 4);
      expect(s.flat.center.lon, b.id).toBeCloseTo(b.lon, 4);
    }
    s.setFlatView({ lat: 0, lon: 0 }, 99_999);
    expect(s.flat.zoom).toBe(FLAT_MAX_ZOOM);
  });

  test('a scene says whether it offers close-ups, and it is off unless it does', () => {
    const s = new MapState();
    s.applyScene({ views: ['flat'] });
    expect(s.closeUps).toBe(false);
    s.applyScene({ views: ['flat'], closeUps: true });
    expect(s.closeUps).toBe(true);
    s.applyScene({ views: ['flat'] });
    expect(s.closeUps).toBe(false);
  });
});
