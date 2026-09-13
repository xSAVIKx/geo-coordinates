import { describe, expect, test } from 'vitest';
import { clampLat, formatLat, formatLatLon, formatLon, normalizeLon, parseAngle, roundTo, toDegMin } from '../../src/geo/format';

describe('normalize', () => {
  test.each([[0, 0], [180, 180], [-180, 180], [190, -170], [-190, 170], [360, 0], [540, 180], [-45, -45]])('normalizeLon(%d) = %d', (i, o) => {
    expect(normalizeLon(i)).toBe(o);
  });
  test('clampLat', () => { expect(clampLat(95)).toBe(90); expect(clampLat(-91)).toBe(-90); expect(clampLat(12.5)).toBe(12.5); });
  test('roundTo', () => { expect(roundTo(52.26, 'degree')).toBe(52); expect(roundTo(52.2334, 'minute')).toBeCloseTo(52 + 14 / 60, 9); });
  test('toDegMin carries 60 minutes', () => {
    expect(toDegMin(52.2334)).toEqual({ deg: 52, min: 14 });
    expect(toDegMin(-21.9999)).toEqual({ deg: 22, min: 0 });
  });
});

describe('format', () => {
  test('en/pl degrees', () => {
    for (const lang of ['en', 'pl'] as const) {
      expect(formatLat(52, lang)).toBe('52°N');
      expect(formatLat(-34, lang)).toBe('34°S');
      expect(formatLon(21, lang)).toBe('21°E');
      expect(formatLon(-58, lang)).toBe('58°W');
    }
  });
  test('uk degrees', () => {
    expect(formatLat(52, 'uk')).toBe('52° пн. ш.');
    expect(formatLat(-34, 'uk')).toBe('34° пд. ш.');
    expect(formatLon(21, 'uk')).toBe('21° сх. д.');
    expect(formatLon(-58, 'uk')).toBe('58° зх. д.');
  });
  test('boundaries have no letter', () => {
    expect(formatLat(0, 'en')).toBe('0°');
    expect(formatLon(0, 'uk')).toBe('0°');
    expect(formatLon(180, 'pl')).toBe('180°');
    expect(formatLon(-180, 'en')).toBe('180°');
    expect(formatLat(90, 'en')).toBe('90°N');
    expect(formatLat(-90, 'uk')).toBe('90° пд. ш.');
  });
  test('minutes', () => {
    expect(formatLat(52 + 14 / 60, 'en', 'minute')).toBe('52°14′N');
    expect(formatLon(-(21 + 5 / 60), 'uk', 'minute')).toBe('21°05′ зх. д.');
    expect(formatLat(0.2, 'pl', 'minute')).toBe('0°12′N');
  });
  test('degree precision rounds', () => { expect(formatLat(51.6, 'en')).toBe('52°N'); });
  test('formatLatLon', () => {
    expect(formatLatLon({ lat: 52, lon: 21 }, 'en')).toBe('52°N, 21°E');
    expect(formatLatLon({ lat: 50, lon: 30 }, 'uk')).toBe('50° пн. ш., 30° сх. д.');
  });
});

describe('parseAngle', () => {
  test.each([
    ['52N', 'lat', 52], ['52 N', 'lat', 52], ['52°N', 'lat', 52], ['52° N', 'lat', 52], ['52°s', 'lat', -52],
    ['52° пн. ш.', 'lat', 52], ['52 пд', 'lat', -52], ['21° сх. д.', 'lon', 21], ['21 зх', 'lon', -21],
    ['52°14′N', 'lat', 52 + 14 / 60], ["52°14'N", 'lat', 52 + 14 / 60], ['52 14 N', 'lat', 52 + 14 / 60],
    ['0', 'lat', 0], ['0°', 'lon', 0], ['180', 'lon', 180], ['180°E', 'lon', 180], ['180°W', 'lon', 180],
    ['-21', 'lon', -21], ['21e', 'lon', 21], ['  21 , E ', 'lon', 21], ['52,5N', 'lat', 52.5],
  ] as const)('%s (%s) -> %d', (input, axis, expected) => {
    expect(parseAngle(input, axis)).toBeCloseTo(expected, 9);
  });
  test.each([
    ['52E', 'lat'], ['21N', 'lon'], ['91N', 'lat'], ['181E', 'lon'], ['52°60′N', 'lat'], ['abc', 'lat'], ['', 'lon'],
    ['52', 'lat'], ['21', 'lon'], ['-5N', 'lat'],
  ] as const)('rejects %s (%s)', (input, axis) => {
    expect(parseAngle(input, axis)).toBeNull();
  });
});
