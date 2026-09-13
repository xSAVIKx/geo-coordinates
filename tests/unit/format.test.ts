import { describe, expect, test } from 'vitest';
import { clampLat, formatDecimal, formatDMS, formatLat, formatLatLon, formatLon, normalizeLon, parseAngle, parseDecimalPair, roundTo, toDegMin, toDegMinSec } from '../../src/geo/format';

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

describe('formatDecimal', () => {
  test('four digits, a dot and comma + space, like map apps', () => {
    expect(formatDecimal({ lat: 50.2649, lon: 19.0238 })).toBe('50.2649, 19.0238');
    expect(formatDecimal({ lat: -33.8688, lon: 151.2093 })).toBe('-33.8688, 151.2093');
    expect(formatDecimal({ lat: 40.7128, lon: -74.006 })).toBe('40.7128, -74.0060');
    expect(formatDecimal({ lat: 50.26, lon: 19.02 }, 2)).toBe('50.26, 19.02');
  });
  test('no negative zero, longitude normalized, latitude clamped', () => {
    expect(formatDecimal({ lat: -0.00001, lon: -0.00004 })).toBe('0.0000, 0.0000');
    expect(formatDecimal({ lat: 0, lon: -180 })).toBe('0.0000, 180.0000');
    expect(formatDecimal({ lat: 91, lon: 190 })).toBe('90.0000, -170.0000');
  });
});

describe('formatDMS', () => {
  test('en/pl letters', () => {
    for (const lang of ['en', 'pl'] as const) {
      expect(formatDMS(50.2649, 'lat', lang)).toBe('50°15′54″N');
      expect(formatDMS(19.0238, 'lon', lang)).toBe('19°01′26″E');
      expect(formatDMS(-33.8688, 'lat', lang)).toBe('33°52′08″S');
      expect(formatDMS(-74.006, 'lon', lang)).toBe('74°00′22″W');
    }
  });
  test('uk notation', () => {
    expect(formatDMS(50.2649, 'lat', 'uk')).toBe('50°15′54″ пн. ш.');
    expect(formatDMS(-74.006, 'lon', 'uk')).toBe('74°00′22″ зх. д.');
  });
  test('seconds round and carry 60″ and 60′', () => {
    expect(toDegMinSec(10.99999)).toEqual({ deg: 11, min: 0, sec: 0 });
    expect(formatDMS(10 + 59 / 60 + 59.8 / 3600, 'lat', 'en')).toBe('11°00′00″N');
    expect(formatDMS(10 + 30 / 60 + 59.6 / 3600, 'lon', 'en')).toBe('10°31′00″E');
    expect(formatDMS(-(0.5 / 3600), 'lat', 'en')).toBe('0°00′01″S');
  });
  test('boundaries have no letter', () => {
    expect(formatDMS(0.0001 / 3600, 'lat', 'en')).toBe('0°00′00″');
    expect(formatDMS(0, 'lon', 'uk')).toBe('0°00′00″');
    expect(formatDMS(-180, 'lon', 'en')).toBe('180°00′00″');
    expect(formatDMS(179.99999, 'lon', 'en')).toBe('180°00′00″');
    expect(formatDMS(90, 'lat', 'en')).toBe('90°00′00″N');
  });
});

describe('parseDecimalPair', () => {
  test.each([
    ['50.2649, 19.0238', 50.2649, 19.0238], ['50.2649 19.0238', 50.2649, 19.0238], ['-33.87,151.21', -33.87, 151.21],
    ['  40.7128 ,  -74.0060 ', 40.7128, -74.006], ['−33.8688, 151.2093', -33.8688, 151.2093], ['0, -180', 0, 180], ['52 21', 52, 21],
  ] as const)('%s', (input, lat, lon) => {
    expect(parseDecimalPair(input)).toEqual({ lat, lon });
  });
  test.each(['', '50.2649', '50,2649 19,0238', '91, 10', '10, 181', 'abc, def', '50.2649, 19.0238, 3', '50°N, 19°E', '1.2.3 4'])('rejects %s', (input) => {
    expect(parseDecimalPair(input)).toBeNull();
  });
});
