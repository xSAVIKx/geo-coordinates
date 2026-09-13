import { describe, expect, test } from 'vitest';
import { extremeIndex, hemisphereLat, hemisphereLon, latDifference, latDifferenceMethod, lonDifference, lonDifferenceMethod, relativeToMeridian, relativeToParallel, spansAntimeridian } from '../../src/geo/compare';

describe('hemispheres', () => {
  test('lat', () => { expect(hemisphereLat(10)).toBe('N'); expect(hemisphereLat(-1)).toBe('S'); expect(hemisphereLat(0)).toBeNull(); });
  test('lon', () => { expect(hemisphereLon(10)).toBe('E'); expect(hemisphereLon(-170)).toBe('W'); expect(hemisphereLon(0)).toBeNull(); expect(hemisphereLon(180)).toBeNull(); expect(hemisphereLon(-180)).toBeNull(); });
});

describe('relative position', () => {
  test('parallel', () => { expect(relativeToParallel(52, 50)).toBe('north'); expect(relativeToParallel(-10, 0)).toBe('south'); expect(relativeToParallel(20, 20)).toBe('on'); });
  test('meridian', () => {
    expect(relativeToMeridian(21, 20)).toBe('east');
    expect(relativeToMeridian(-10, 20)).toBe('west');
    expect(relativeToMeridian(20, 20)).toBe('on');
    expect(relativeToMeridian(170, -170)).toBe('west');   // shorter way crosses 180°
    expect(relativeToMeridian(-160, 0)).toBe('west');
    expect(relativeToMeridian(180, 0)).toBe('opposite');
  });
});

describe('differences', () => {
  test('latitude', () => {
    expect(latDifference(52, 20)).toBe(32); expect(latDifferenceMethod(52, 20)).toBe('same-subtract');
    expect(latDifference(30, -20)).toBe(50); expect(latDifferenceMethod(30, -20)).toBe('opposite-add');
    expect(latDifference(0, -20)).toBe(20); expect(latDifferenceMethod(0, -20)).toBe('zero-line');
  });
  test('longitude', () => {
    expect(lonDifference(21, 30)).toBe(9); expect(lonDifferenceMethod(21, 30)).toBe('same-subtract');
    expect(lonDifference(-10, 15)).toBe(25); expect(lonDifferenceMethod(-10, 15)).toBe('opposite-add');
    expect(lonDifference(170, -150)).toBe(40); expect(lonDifferenceMethod(170, -150)).toBe('opposite-over-180');
    expect(lonDifference(90, -90)).toBe(180); expect(lonDifferenceMethod(90, -90)).toBe('opposite-add');
    expect(lonDifference(0, -75)).toBe(75); expect(lonDifferenceMethod(0, -75)).toBe('zero-line');
    expect(lonDifference(180, 20)).toBe(160); expect(lonDifferenceMethod(180, 20)).toBe('zero-line');
  });
});

describe('extremes', () => {
  const pts = [{ lat: 10, lon: -20 }, { lat: 50, lon: 30 }, { lat: -40, lon: 5 }];
  test('N/S/E/W', () => {
    expect(extremeIndex(pts, 'N')).toBe(1); expect(extremeIndex(pts, 'S')).toBe(2);
    expect(extremeIndex(pts, 'E')).toBe(1); expect(extremeIndex(pts, 'W')).toBe(0);
  });
  test('spansAntimeridian', () => {
    expect(spansAntimeridian([-20, 30, 5])).toBe(false);
    expect(spansAntimeridian([170, -175])).toBe(true);
    expect(spansAntimeridian([-100, 100])).toBe(true); // smallest covering arc is 160° through 180°
  });
});
