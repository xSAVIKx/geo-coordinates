import { expect, test } from 'vitest';
import en from '../../src/i18n/en.json';
import { MAP_LABELS, PLACES, placeById } from '../../src/map/places';

test('ids unique, coordinates in range, names exist', () => {
  const ids = new Set<string>();
  for (const p of PLACES) {
    expect(ids.has(p.id)).toBe(false); ids.add(p.id);
    expect(Math.abs(p.lat)).toBeLessThanOrEqual(90);
    expect(p.lon).toBeGreaterThan(-180); expect(p.lon).toBeLessThanOrEqual(180);
    expect(en).toHaveProperty(`place.${p.id}`);
  }
  for (const l of MAP_LABELS) expect(en).toHaveProperty(`label.${l.id}`);
  expect(PLACES.filter((p) => p.featured).length).toBeGreaterThanOrEqual(8);
});

test('placeById throws on unknown', () => {
  expect(placeById('warsaw').lat).toBe(52.23);
  expect(() => placeById('atlantis')).toThrow();
});
