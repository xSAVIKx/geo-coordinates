import { describe, expect, test } from 'vitest';
import { anglesMatch, coordMistake, coordsMatch } from '../../src/quiz/check';

describe('matching', () => {
  test('degrees are exact, minutes allow ±1′, longitude wraps', () => {
    expect(anglesMatch(52, 52, 'lat', 'degree')).toBe(true);
    expect(anglesMatch(52, 53, 'lat', 'degree')).toBe(false);
    expect(anglesMatch(52.5, 52.5 + 1 / 60, 'lat', 'minute')).toBe(true);
    expect(anglesMatch(52.5, 52.5 + 2 / 60, 'lat', 'minute')).toBe(false);
    expect(anglesMatch(180, -180, 'lon', 'degree')).toBe(true);
  });
  test('coordsMatch honours fields', () => {
    expect(coordsMatch({ lat: 10, lon: 20 }, { lat: 10, lon: 99 }, 'lat', 'degree')).toBe(true);
    expect(coordsMatch({ lat: 10, lon: 20 }, { lat: 10, lon: 99 }, 'both', 'degree')).toBe(false);
  });
});

describe('mistakes', () => {
  const e = { lat: 30, lon: -60 };
  test.each([
    [{ lat: -30, lon: -60 }, 'q.mistake.nsLetter'],
    [{ lat: 30, lon: 60 }, 'q.mistake.ewLetter'],
    [{ lat: -30, lon: 60 }, 'q.mistake.bothLetters'],
    [{ lat: -60, lon: 30 }, 'q.mistake.swapped'],
    [{ lat: 31, lon: -60 }, undefined],
  ])('%o -> %s', (got, key) => {
    expect(coordMistake(e, got, 'both', 'degree')?.key).toBe(key);
  });
  test('minutes hint when degrees right but minutes wrong', () => {
    expect(coordMistake({ lat: 52.5, lon: 21 }, { lat: 52.25, lon: 21 }, 'both', 'minute')?.key).toBe('q.mistake.minutes');
  });
});
