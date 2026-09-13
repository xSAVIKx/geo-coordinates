import { describe, expect, test } from 'vitest';
import { antisolarPoint, dateFromDayAndMinutes, dayLightMinutes, dayOfYear, elevationFrom, meanSunPoint, solarElevationDeg, subsolarPoint } from '../../src/geo/sun';

const close = (a: number, b: number, tol: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe('subsolar point (NOAA approximation)', () => {
  test('June solstice declination ≈ +23.44', () => { close(subsolarPoint(new Date('2024-06-20T20:51:00Z')).lat, 23.44, 0.05); });
  test('December solstice ≈ −23.44', () => { close(subsolarPoint(new Date('2024-12-21T09:20:00Z')).lat, -23.44, 0.05); });
  test('March equinox ≈ 0', () => { close(subsolarPoint(new Date('2024-03-20T03:06:00Z')).lat, 0, 0.1); });
  test('equation of time: early November sun is west of Greenwich at 12:00 UTC', () => {
    close(subsolarPoint(new Date('2024-11-03T12:00:00Z')).lon, -4.1, 0.5);
  });
  test('equation of time: mid February sun is east of Greenwich at 12:00 UTC', () => {
    close(subsolarPoint(new Date('2024-02-11T12:00:00Z')).lon, 3.55, 0.5);
  });
  test('longitude normalized', () => {
    const lon = subsolarPoint(new Date('2024-06-01T00:00:00Z')).lon;
    expect(lon).toBeGreaterThan(-180); expect(lon).toBeLessThanOrEqual(180);
  });
});

describe('derived', () => {
  test('antisolar is opposite', () => {
    const d = new Date('2024-06-01T10:00:00Z');
    const s = subsolarPoint(d); const a = antisolarPoint(d);
    close(a.lat, -s.lat, 1e-9);
    close(Math.abs(((a.lon - s.lon + 540) % 360) - 180), 180, 1e-9);
  });
  test('elevation is 90 at subsolar and -90 at antisolar', () => {
    const d = new Date('2024-06-01T10:00:00Z');
    close(solarElevationDeg(d, subsolarPoint(d)), 90, 1e-6);
    close(solarElevationDeg(d, antisolarPoint(d)), -90, 1e-6);
  });
  test('polar day at north pole in June, polar night in December', () => {
    expect(solarElevationDeg(new Date('2024-06-21T00:00:00Z'), { lat: 89, lon: 0 })).toBeGreaterThan(0);
    expect(solarElevationDeg(new Date('2024-12-21T12:00:00Z'), { lat: 89, lon: 0 })).toBeLessThan(0);
  });
  test('day of year helpers', () => {
    expect(dayOfYear(new Date('2024-01-01T00:00:00Z'))).toBe(1);
    expect(dayOfYear(new Date('2024-12-31T23:59:00Z'))).toBe(366);
    expect(dateFromDayAndMinutes(2024, 32, 90).toISOString()).toBe('2024-02-01T01:30:00.000Z');
  });
});

describe('the Sun as the lesson clocks see it', () => {
  test('stands over the meridian where UTC + longitude × 4 min is 12:00, with the real declination', () => {
    const d = new Date('2026-01-20T10:36:00Z');
    const p = meanSunPoint(d);
    close(p.lon, 21, 1e-9);
    close(p.lat, subsolarPoint(d).lat, 1e-9);
    close(meanSunPoint(new Date('2026-03-21T12:00:00Z')).lon, 0, 1e-9);
    close(meanSunPoint(new Date('2026-03-21T00:00:00Z')).lon, 180, 1e-9);
    close(meanSunPoint(new Date('2026-03-21T18:00:00Z')).lon, -90, 1e-9);
  });
  test('never more than 4.5° from the real subsolar point', () => {
    for (let day = 1; day <= 365; day += 7) {
      const d = dateFromDayAndMinutes(2026, day, 720);
      const diff = Math.abs(((meanSunPoint(d).lon - subsolarPoint(d).lon + 540) % 360) - 180);
      expect(diff).toBeLessThan(4.5);
    }
  });
  test('elevationFrom matches solarElevationDeg for the real sun', () => {
    const d = new Date('2024-06-01T10:00:00Z');
    close(elevationFrom(subsolarPoint(d), { lat: 52, lon: 21 }), solarElevationDeg(d, { lat: 52, lon: 21 }), 1e-9);
  });
  test('day length: 12 h at the equator, polar day and polar night, longer summer days', () => {
    close(dayLightMinutes(0, 10), 720, 1e-6);
    expect(dayLightMinutes(80, 23.4)).toBe(1440);
    expect(dayLightMinutes(80, -23.4)).toBe(0);
    expect(dayLightMinutes(52, 23.4)).toBeGreaterThan(16 * 60);
    expect(dayLightMinutes(52, -23.4)).toBeLessThan(8 * 60);
  });
});
