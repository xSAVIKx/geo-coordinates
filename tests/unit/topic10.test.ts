import { afterEach, describe, expect, test, vi } from 'vitest';
import en from '../../src/i18n/en.json';
import pl from '../../src/i18n/pl.json';
import uk from '../../src/i18n/uk.json';
import { formatLat } from '../../src/geo/format';
import { AXIAL_TILT } from '../../src/geo/orbit';
import { dateFromDayAndMinutes, dayLightMinutes, daysInYear, solarParams } from '../../src/geo/sun';
import type { LangCode } from '../../src/geo/types';
import { MapState } from '../../src/map/mapState.svelte';
import { HOME, placeById } from '../../src/map/places';
import { TOPICS } from '../../src/topics';

const FILES: Record<LangCode, Record<string, string>> = { en, pl, uk };
const body = (lang: LangCode, id: string) => FILES[lang][`topic.10.step.${id}.body`]!;
const decl = (month: number, day: number) => solarParams(new Date(Date.UTC(2026, month, day, 12))).declination;
const hours = (lat: number, month: number, day: number) => Math.round(dayLightMinutes(lat, decl(month, day)) / 60);
const HOURS: Record<LangCode, (n: number) => string> = { en: (n) => `about ${n} hours`, pl: (n) => `około ${n} godzin`, uk: (n) => `близько ${n} годин` };

describe('topic 10: the numbers in the texts are what the model says', () => {
  const topic = TOPICS[10]!;
  test('explore only, seven steps, the last one free play at Katowice', () => {
    expect(topic.questionTypes).toEqual([]);
    expect(topic.steps.map((s) => s.id)).toEqual(['orbit', 'tilt', 'june', 'december', 'equinox', 'katowice', 'play']);
    expect(topic.steps.at(-1)!.scene.point).toEqual(HOME);
  });

  test('orbit: a year is 365 days', () => {
    expect(daysInYear(2026)).toBe(365);
    for (const lang of ['en', 'pl', 'uk'] as const) expect(body(lang, 'orbit')).toContain('365');
  });

  test('tilt: about 23½°, the largest declination of the year', () => {
    let max = 0;
    for (let d = 1; d <= 365; d++) max = Math.max(max, Math.abs(solarParams(dateFromDayAndMinutes(2026, d, 720)).declination));
    expect(Math.round(max * 2) / 2).toBe(23.5);
    expect(Math.round(AXIAL_TILT * 2) / 2).toBe(23.5);
    for (const lang of ['en', 'pl', 'uk'] as const) expect(body(lang, 'tilt')).toContain('23½°');
  });

  test('June: the Sun overhead at 23°26′N on 21 June; polar day inside the Arctic Circle (66.6°N)', () => {
    for (const lang of ['en', 'pl', 'uk'] as const) {
      expect(body(lang, 'june')).toContain(formatLat(decl(5, 21), lang, 'minute'));
      expect(body(lang, 'june')).toContain('21');
    }
    expect(dayLightMinutes(66.6, decl(5, 21))).toBe(1440);
  });

  test('December: 23°26′S on 21 December; polar night inside the Arctic Circle; topic 1 has the tropics step', () => {
    for (const lang of ['en', 'pl', 'uk'] as const) {
      expect(body(lang, 'december')).toContain(formatLat(decl(11, 21), lang, 'minute'));
      expect(body(lang, 'december')).toMatch(/\b1\b/);
    }
    expect(dayLightMinutes(66.6, decl(11, 21))).toBe(0);
    expect(TOPICS[1]!.steps.map((s) => s.id)).toContain('tropics');
  });

  test('equinoxes: the Sun over the equator on 20 March and 23 September; about 12 hours of day everywhere', () => {
    for (const [m, d] of [[2, 20], [8, 23]] as const) {
      expect(Math.abs(decl(m, d))).toBeLessThan(0.5);
      for (let lat = -60; lat <= 60; lat += 10) expect(Math.abs(dayLightMinutes(lat, decl(m, d)) - 720), `${lat} ${m}`).toBeLessThanOrEqual(15);
    }
    for (const lang of ['en', 'pl', 'uk'] as const) for (const n of ['20', '23', '12']) expect(body(lang, 'equinox'), `${lang} ${n}`).toContain(n);
  });

  test('Katowice and Sydney: rounded day lengths at the solstices', () => {
    const sydney = placeById('sydney');
    expect([hours(HOME.lat, 5, 21), hours(HOME.lat, 11, 21), hours(sydney.lat, 5, 21), hours(sydney.lat, 11, 21)]).toEqual([16, 8, 10, 14]);
    for (const lang of ['en', 'pl', 'uk'] as const) {
      const text = body(lang, 'katowice');
      for (const n of [16, 8, 10, 14]) expect(text, `${lang} ${n}`).toContain(HOURS[lang](n));
      expect(text).toContain(formatLat(HOME.lat, lang));
      expect(text).toContain(formatLat(sydney.lat, lang));
    }
  });
});

/*
 * The scenes' dates. They used to be the common-year day numbers 172 / 266 / 355, which from 2028 would have put
 * the "June solstice" step a day before the solstice — the very day the step is about. They now name the event,
 * and MapState resolves it against the year the page is open in (src/geo/orbit.ts `eventDay`).
 */
describe('topic 10: the key dates are the real ones in every year', () => {
  const topic = TOPICS[10]!;
  const dayOf = (id: string, year: number) => {
    vi.setSystemTime(new Date(Date.UTC(year, 0, 15)));
    const s = new MapState();
    s.applyScene(topic.steps.find((x) => x.id === id)!.scene);
    return s.sun!.dayOfYear;
  };
  afterEach(() => vi.useRealTimers());

  test('the scenes name events, never a fixed day number', () => {
    for (const step of topic.steps) {
      const sun = step.scene.sun;
      if (!sun) continue;
      expect(sun.event, `${step.id} scene sun`).toBeTruthy();
      expect(sun.dayOfYear, `${step.id} scene sun`).toBeUndefined();
    }
  });

  test('a common year and a leap year land on the same calendar date, a day apart in day numbers', () => {
    expect([dayOf('june', 2026), dayOf('equinox', 2026), dayOf('tilt', 2026)]).toEqual([172, 266, 355]);
    expect([dayOf('june', 2028), dayOf('equinox', 2028), dayOf('tilt', 2028)]).toEqual([173, 267, 356]);
    for (const year of [2026, 2028]) {
      expect(dateFromDayAndMinutes(year, dayOf('june', year), 720).getUTCMonth()).toBe(5);
      expect(dateFromDayAndMinutes(year, dayOf('june', year), 720).getUTCDate()).toBe(21);
    }
  });
});
