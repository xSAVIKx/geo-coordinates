import { describe, expect, test } from 'vitest';
import { formatLat } from '../../src/geo/format';
import { dayInfo, polarLimits, splitMinutes } from '../../src/geo/seasons';
import { solarParams } from '../../src/geo/sun';

const close = (a: number | null, b: number, tol: number) => expect(Math.abs(a! - b)).toBeLessThanOrEqual(tol);
const d = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe('day length, sunrise and sunset (geometric, local mean solar time)', () => {
  test('Katowice (50.26°N) at the solstices: 16 h 11 min and 7 h 49 min', () => {
    const june = dayInfo(50.26, d('2026-06-21'), false);
    close(june.dayMinutes, 971.4, 1);
    expect(splitMinutes(june.dayMinutes)).toEqual({ h: 16, m: 11 });
    close(june.sunrise, 720 - 971.4 / 2, 1);
    close(june.sunset, 720 + 971.4 / 2, 1);
    const december = dayInfo(50.26, d('2026-12-21'), false);
    close(december.dayMinutes, 468.6, 1);
    expect(splitMinutes(december.dayMinutes)).toEqual({ h: 7, m: 49 });
  });
  test('Sydney (33.87°S) the other way round; the equator always 12 h', () => {
    close(dayInfo(-33.87, d('2026-06-21'), false).dayMinutes, 585, 2);
    close(dayInfo(-33.87, d('2026-12-21'), false).dayMinutes, 855, 2);
    for (const iso of ['2026-03-20', '2026-06-21', '2026-12-21']) close(dayInfo(0, d(iso), false).dayMinutes, 720, 0.5);
  });
  test('polar day and polar night have no sunrise or sunset', () => {
    expect(dayInfo(70, d('2026-06-21'), false)).toMatchObject({ polar: 'day', dayMinutes: 1440, sunrise: null, sunset: null });
    expect(dayInfo(70, d('2026-12-21'), false)).toMatchObject({ polar: 'night', dayMinutes: 0, sunrise: null, sunset: null });
  });
  test('with the real Sun, sunrise and sunset move by the equation of time', () => {
    const date = d('2026-11-03');
    const eq = solarParams(date).eqTimeMin;
    close(dayInfo(50, date, true).sunrise, dayInfo(50, date, false).sunrise! - eq, 1e-9);
    close(dayInfo(50, date, true).sunset, dayInfo(50, date, false).sunset! - eq, 1e-9);
  });
  test('splitMinutes rounds to the minute and carries', () => {
    expect(splitMinutes(719.6)).toEqual({ h: 12, m: 0 });
    expect(splitMinutes(1440)).toEqual({ h: 24, m: 0 });
  });
});

describe('where polar day and polar night begin', () => {
  test('at the June solstice: north of 66°34′N day, south of 66°34′S night (lesson notation)', () => {
    const lim = polarLimits(23.44)!;
    expect(lim.day).toEqual({ lat: 66.56, hemisphere: 'N' });
    expect(lim.night.hemisphere).toBe('S');
    expect(formatLat(lim.day.lat, 'en', 'minute')).toBe('66°34′N');
    expect(formatLat(-lim.night.lat, 'uk', 'minute')).toBe('66°34′ пд. ш.');
  });
  test('southern summer mirrors it; no polar day at an equinox', () => {
    expect(polarLimits(-10)).toEqual({ day: { lat: 80, hemisphere: 'S' }, night: { lat: 80, hemisphere: 'N' } });
    expect(polarLimits(0)).toBeNull();
  });
});
