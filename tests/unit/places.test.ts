import { expect, test } from 'vitest';
import en from '../../src/i18n/en.json';
import pl from '../../src/i18n/pl.json';
import uk from '../../src/i18n/uk.json';
import { HOME, MAP_LABELS, PLACES, placeById, tierVisible } from '../../src/map/places';

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

test('tiers: world places always, region places from zoom 3, local places from zoom 8', () => {
  expect(tierVisible('world', 1)).toBe(true);
  expect(tierVisible('region', 2.9)).toBe(false);
  expect(tierVisible('region', 3)).toBe(true);
  expect(tierVisible('local', 7.9)).toBe(false);
  expect(tierVisible('local', 8)).toBe(true);
  expect(placeById('katowice').tier).toBe('region');
  expect(placeById('zakopane').tier).toBe('local');
  expect(placeById('mumbai').tier).toBe('world');
  // Everything that existed before tiers stays on the world map.
  for (const id of ['warsaw', 'krakow', 'kyiv', 'london', 'newyork', 'delhi', 'tokyo']) expect(placeById(id).tier).toBe('world');
});

test('Katowice is home: HOME matches the place, and every new place has names in all languages', () => {
  expect(HOME).toEqual({ lat: placeById('katowice').lat, lon: placeById('katowice').lon });
  for (const id of ['katowice', 'lodz', 'szczecin', 'lublin', 'bialystok', 'rzeszow', 'bydgoszcz', 'olsztyn', 'zakopane', 'mumbai', 'bengaluru', 'washington', 'chicago', 'berlin', 'prague', 'bratislava', 'vienna', 'budapest', 'vilnius', 'riga']) {
    expect(() => placeById(id)).not.toThrow();
    for (const dict of [en, pl, uk]) expect(dict).toHaveProperty([`place.${id}`]);
  }
});
