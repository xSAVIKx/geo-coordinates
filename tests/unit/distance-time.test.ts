import { describe, expect, test } from 'vitest';
import { KM_PER_DEGREE, degreesForDistance, meridianDistanceKm } from '../../src/geo/distance';
import { formatClock, localSolarMinutes, lonDifferenceForMinutes, solarOffsetMinutes, wrapDayMinutes } from '../../src/geo/time';

describe('distance', () => {
  test('constant', () => { expect(KM_PER_DEGREE).toBe(111.2); });
  test('same and opposite hemispheres', () => {
    expect(meridianDistanceKm(52, 50)).toBeCloseTo(222.4, 6);
    expect(meridianDistanceKm(10, -10)).toBeCloseTo(2224, 6);
    expect(meridianDistanceKm(10, -10, 111)).toBe(2220);
  });
  test('reverse', () => { expect(degreesForDistance(1112)).toBeCloseTo(10, 9); });
});

describe('time', () => {
  test('wrap', () => { expect(wrapDayMinutes(-60)).toBe(1380); expect(wrapDayMinutes(1500)).toBe(60); });
  test('offset: east is later, shorter way', () => {
    expect(solarOffsetMinutes(0, 15)).toBe(60);
    expect(solarOffsetMinutes(21, 30)).toBe(36);
    expect(solarOffsetMinutes(30, -45)).toBe(-300);
    expect(solarOffsetMinutes(170, -170)).toBe(80);
  });
  test('local solar time', () => { expect(localSolarMinutes(12 * 60, 15)).toBe(13 * 60); expect(localSolarMinutes(60, -30)).toBe(1380); });
  test('clock', () => { expect(formatClock(0)).toBe('00:00'); expect(formatClock(13 * 60 + 5)).toBe('13:05'); expect(formatClock(1440 + 30)).toBe('00:30'); });
  test('lon from minutes', () => { expect(lonDifferenceForMinutes(36)).toBe(9); expect(lonDifferenceForMinutes(90)).toBe(22.5); });
});
