import { describe, expect, test } from 'vitest';
import data from '../../src/map/data/maple-bear-schools.json';
import { countryName, validateSchools } from '../../scripts/validate-schools.ts';

describe('Maple Bear schools dataset', () => {
  test('passes the validation script', () => {
    expect(validateSchools(data)).toEqual([]);
  });

  test('has source, retrieved date and note', () => {
    expect(data.source.length).toBeGreaterThan(0);
    expect(data.source).toMatch(/maplebear/);
    expect(data.retrieved).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(data.note.length).toBeGreaterThan(0);
  });

  test('required fields, coordinate ranges and precision', () => {
    expect(data.schools.length).toBeGreaterThan(0);
    for (const s of data.schools) {
      for (const key of ['id', 'name', 'city', 'country', 'url'] as const) expect(s[key].length, `${s.id}.${key}`).toBeGreaterThan(0);
      expect(s.lat).toBeGreaterThanOrEqual(-90);
      expect(s.lat).toBeLessThanOrEqual(90);
      expect(s.lon).toBeGreaterThanOrEqual(-180);
      expect(s.lon).toBeLessThanOrEqual(180);
      expect(Math.round(s.lat * 1e4) / 1e4).toBe(s.lat);
      expect(Math.round(s.lon * 1e4) / 1e4).toBe(s.lon);
      expect(['address', 'city']).toContain(s.precision);
      expect(s.url).toMatch(/^https?:\/\//);
    }
  });

  test('ids are unique', () => {
    const ids = data.schools.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('country codes are ISO 3166-1 alpha-2 and resolve with Intl.DisplayNames', () => {
    const names = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });
    for (const s of data.schools) {
      expect(s.country, s.id).toMatch(/^[A-Z]{2}$/);
      expect(names.of(s.country), s.id).toBeTruthy();
      expect(countryName(s.country), s.id).toBeTruthy();
    }
  });

  test('Maple Bear Katowice is included', () => {
    const katowice = data.schools.find((s) => s.id === 'pl-katowice');
    expect(katowice).toBeDefined();
    expect(katowice?.country).toBe('PL');
    expect(katowice?.city).toBe('Katowice');
    expect(katowice?.lat).toBeCloseTo(50.26, 1);
    expect(katowice?.lon).toBeCloseTo(19.02, 1);
  });

  test('validator reports invalid data', () => {
    const bad = {
      source: '', retrieved: '2026-13-01', note: 'x',
      schools: [
        { id: 'pl-a', name: 'A', city: 'A', country: 'PL', lat: 91, lon: 0.123456, precision: 'city', url: 'https://x' },
        { id: 'pl-a', name: 'B', city: 'B', country: 'XX', lat: 1, lon: 1, precision: 'street', url: 'ftp://x' },
        { id: 'pl-c', name: '', city: 'C', country: 'EU', lat: 1, lon: 1, precision: 'city', url: 'https://x', extra: 1 },
      ],
    };
    const errors = validateSchools(bad).join('\n');
    for (const fragment of ['"source"', '"retrieved"', 'out of range', 'more than 4 decimals', 'duplicate id',
      '"XX" is not', '"EU" is not', '"precision"', '"url"', '"name"', 'unexpected field "extra"']) {
      expect(errors).toContain(fragment);
    }
    expect(validateSchools(null)).not.toEqual([]);
  });
});
