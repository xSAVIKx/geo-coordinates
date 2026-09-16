import { describe, expect, test } from 'vitest';
import { dateFromDayAndMinutes, meanSunPoint, solarParams, subsolarPoint, sunPoint } from '../../src/geo/sun';
import { apparentSolarMinutes, localSolarMinutes } from '../../src/geo/time';
import { MapState } from '../../src/map/mapState.svelte';
import { TOPICS } from '../../src/topics';
import en from '../../src/i18n/en.json';
import pl from '../../src/i18n/pl.json';
import uk from '../../src/i18n/uk.json';

const close = (a: number, b: number, tol: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);
const noon = (iso: string) => solarParams(new Date(`${iso}T12:00:00Z`));

describe('equation of time and declination against published values (2026)', () => {
  test('equation of time', () => {
    close(noon('2026-02-11').eqTimeMin, -14.22, 0.3);
    close(noon('2026-11-03').eqTimeMin, 16.43, 0.3);
    close(noon('2026-07-26').eqTimeMin, -6.53, 0.3);
    for (const d of ['2026-04-15', '2026-06-13', '2026-09-01', '2026-12-25']) close(noon(d).eqTimeMin, 0, 0.6);
  });
  test('declination and the Sun\'s apparent longitude at the equinoxes and solstices', () => {
    const at = (iso: string) => solarParams(new Date(iso));
    close(at('2026-03-20T14:46:00Z').declination, 0, 0.02);
    close(at('2026-06-21T08:24:00Z').declination, 23.44, 0.02);
    close(at('2026-09-23T00:05:00Z').declination, 0, 0.02);
    close(at('2026-12-21T20:50:00Z').declination, -23.44, 0.02);
    close(Math.min(at('2026-03-20T14:46:00Z').appLongitude, 360 - at('2026-03-20T14:46:00Z').appLongitude), 0, 0.02);
    close(at('2026-06-21T08:24:00Z').appLongitude, 90, 0.02);
    close(at('2026-09-23T00:05:00Z').appLongitude, 180, 0.02);
    close(at('2026-12-21T20:50:00Z').appLongitude, 270, 0.02);
  });
  test('the spec note: the real Sun is up to 16 minutes off clock time, so noon moves up to 4°', () => {
    let max = 0;
    for (let day = 1; day <= 365; day++) max = Math.max(max, Math.abs(solarParams(dateFromDayAndMinutes(2026, day, 720)).eqTimeMin));
    expect(Math.floor(max)).toBe(16);
    expect(Math.floor(max / 4)).toBe(4);
  });
});

describe('mean Sun and real Sun', () => {
  test('sunPoint is the lesson\'s mean Sun unless asked for the real one', () => {
    const d = new Date('2026-11-03T12:00:00Z');
    expect(sunPoint(d, false)).toEqual(meanSunPoint(d));
    expect(sunPoint(d, true)).toEqual(subsolarPoint(d));
    close(sunPoint(d, true).lon, -16.43 / 4, 0.1);
  });
  test('apparent solar time = mean solar time + equation of time', () => {
    expect(apparentSolarMinutes(720, 0, 16.43)).toBe(736);
    expect(apparentSolarMinutes(720, 21, 0)).toBe(localSolarMinutes(720, 21));
    expect(apparentSolarMinutes(10, -10, -14.2)).toBe(1396);
  });
  test('MapState uses the mean Sun unless its switch is on, and every scene switches it off', () => {
    const s = new MapState();
    s.applyScene({ views: ['flat'], sun: { utcMinutes: 720, dayOfYear: 307 } });
    const mean = s.sunPoint()!;
    s.realSun = true;
    expect(s.sunPoint()!.lon).not.toBe(mean.lon);
    s.applyScene({ views: ['flat'], sun: { utcMinutes: 720, dayOfYear: 307 } });
    expect(s.realSun).toBe(false);
    expect(s.sunPoint()).toEqual(mean);
  });
  test('no topic scene can turn on the real Sun (lessons and topic 8 always use the mean Sun)', () => {
    for (const topic of Object.values(TOPICS)) for (const step of topic!.steps) expect(JSON.stringify(step.scene), `${topic!.id} ${step.id}`).not.toMatch(/realSun|real-sun/);
  });
});

test('the real-Sun note states the verified numbers in every language', () => {
  for (const f of [en, pl, uk] as Record<string, string>[]) { expect(f['lab.realSunNote']).toMatch(/\b16\b/); expect(f['lab.realSunNote']).toContain('4°'); expect(f['lab.realSunNote']).toContain('12:00'); }
});
