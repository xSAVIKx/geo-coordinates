import { describe, expect, test } from 'vitest';
import { renderText } from '../../src/i18n/text';
import { dayShift, time } from '../../src/quiz/generators/time';
import { createRng } from '../../src/quiz/rng';
import type { Difficulty, Question } from '../../src/quiz/types';

/** Sums are rendered with no-break spaces round their operators (see keepSumsTogether); compared here as plain spaces. */
const plain = (s: string) => s.replace(/\u00a0/g, ' ');

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
const SEEDS = 1000;

test('clock answers follow "east is later" and wrap around midnight', () => {
  for (let s = 0; s < 500; s++) {
    for (const d of ['easy', 'medium', 'hard'] as const) {
      const q = time.generate(createRng(`t${s}`), d, 8);
      if (q.answer.kind !== 'clock') continue;
      const m = q.meta as { lonA: number; lonB: number; minutesA: number };
      const expected = ((m.minutesA + (((m.lonB - m.lonA + 540) % 360) - 180) * 4) % 1440 + 1440) % 1440;
      expect(q.answer.minutes).toBe(expected);
      const wrongWay = ((m.minutesA - (((m.lonB - m.lonA + 540) % 360) - 180) * 4) % 1440 + 1440) % 1440;
      // Across 180° the same wrong clock also comes from forgetting 360° − sum, so that hint names both causes.
      const across = Math.sign(m.lonA) * Math.sign(m.lonB) === -1 && Math.abs(m.lonA) + Math.abs(m.lonB) > 180;
      if (wrongWay !== expected) expect(time.check(q, { kind: 'clock', minutes: wrongWay }).mistake?.key).toBe(across ? 'q.time.mistake.over180' : 'q.time.mistake.direction');
    }
  }
});

// Independent re-computation of the geography, so the tests do not reuse the generator's helpers.
const wrap = (m: number) => ((m % 1440) + 1440) % 1440;
const hhmm = (m: number) => `${String(Math.floor(wrap(m) / 60)).padStart(2, '0')}:${String(wrap(m) % 60).padStart(2, '0')}`;
const apart = (a: number, b: number) => { const d = Math.abs(a - b); return d > 180 ? 360 - d : d; };
/** +1 when B is east of A the shorter way, −1 when west. */
const eastward = (a: number, b: number) => Math.sign(((b - a + 540) % 360) - 180);
type Marker = { kind: 'marker'; p: { lat: number; lon: number }; label?: string };
const markers = (q: Question) => (q.scene.overlays ?? []).filter((o) => o.kind === 'marker') as Marker[];
const keysIn = (t: unknown): string[] => {
  if (!t || typeof t !== 'object') return [];
  const o = t as { key?: string; params?: Record<string, unknown>; text?: unknown };
  return [...(o.key ? [o.key] : []), ...Object.values(o.params ?? {}).flatMap(keysIn), ...(o.text ? keysIn(o.text) : [])];
};

function ruleKey(a: number, b: number): string {
  if (a === 0 || b === 0) return 'q.rule.zero.lon';
  if (Math.sign(a) === Math.sign(b)) return `q.rule.bigger.${a > 0 ? 'E' : 'W'}`;
  return Math.abs(a) + Math.abs(b) > 180 ? `q.time.rule.across180.${eastward(a, b) > 0 ? 'east' : 'west'}` : 'q.rule.mixed.lon';
}

describe('date changes in the solar-time model', () => {
  test('midnight changes the date, the 180° meridian shifts it the other way', () => {
    expect(dayShift(23 * 60, 10, 30)).toBe(1);            // 23:00 + 80 min = 00:20 the next day
    expect(dayShift(30, 30, 10)).toBe(-1);                // 00:30 − 80 min = 23:10 the day before
    expect(dayShift(12 * 60, 10, 30)).toBe(0);
    expect(dayShift(23 * 60 + 45, 157, -134)).toBe(0);    // east across 180°: 23:45 + 276 min = 04:21, same date
    expect(dayShift(2 * 60, 170, -170)).toBe(-1);         // east across 180°: 02:00 + 80 min = 03:20, still the day before
    expect(dayShift(23 * 60, -170, 170)).toBe(1);         // west across 180°: 23:00 − 80 min = 21:40, already the next day
    expect(dayShift(3 * 60, -134, 157)).toBe(0);          // west across 180°: 03:00 − 276 min = 22:24, same date
  });
});

describe('time questions (property tests)', () => {
  for (const d of DIFFS) {
    test(`${d}: answers, explanations, hints and difficulty all follow the two meridians`, () => {
      const variants = { later: 0, clock: 0, degrees: 0, midnight: 0, primeCrossing: 0, dateLineBack: 0, dateLineForward: 0, dateLineSameDay: 0 };
      for (let s = 0; s < SEEDS; s++) {
        const q = time.generate(createRng(`time-prop:${d}:${s}`), d, 8);
        expect(q.type).toBe('time');
        expect(q.topic).toBe(8);
        const variant = q.meta!.variant as 'later' | 'clock' | 'degrees';
        variants[variant]++;
        const a = q.meta!.lonA as number, b = q.meta!.lonB as number;
        const deg = apart(a, b), min = deg * 4, east = eastward(a, b);
        // Never ambiguous: a real difference, shorter than 180°, and whole degrees.
        expect(deg, `seed ${s}`).toBeGreaterThan(0);
        expect(deg, `seed ${s}`).toBeLessThan(180);
        expect(Number.isInteger(a) && Number.isInteger(b)).toBe(true);
        expect(Math.abs(a)).toBeLessThan(180);
        expect(Math.abs(b)).toBeLessThan(180);
        expect(Object.is(a, -0) || Object.is(b, -0)).toBe(false);
        const opposite = a !== 0 && b !== 0 && Math.sign(a) !== Math.sign(b);
        const across180 = opposite && Math.abs(a) + Math.abs(b) > 180;
        if (opposite && !across180) variants.primeCrossing++;
        // Difficulty (spec 5.2): easy is multiples of 15° in one hemisphere, medium never crosses 180°, hard always does.
        if (d === 'easy') { expect(Math.abs(a % 15)).toBe(0); expect(Math.abs(b % 15)).toBe(0); expect(opposite).toBe(false); }
        if (d === 'medium') expect(across180, `seed ${s}`).toBe(false);
        if (d === 'hard') expect(across180, `seed ${s}`).toBe(true);
        if (d === 'easy') expect(variant).not.toBe('degrees');

        const en = plain(renderText(q.explanation, 'en'));
        if (variant === 'degrees') {
          expect(q.input).toEqual({ kind: 'number', unit: 'deg' });
          expect(q.answer).toEqual({ kind: 'number', value: deg });
          const h = Math.floor(min / 60), m = min % 60;
          const duration = h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
          expect(renderText(q.prompt, 'en'), `seed ${s}`).toContain(`differs by ${duration}.`);
          expect(en).toContain(`${min} ÷ 4 = ${deg}°`);
          if (h > 0) expect(en).toContain(`${duration} = ${min} min.`);
          else expect(en).not.toContain(' h ');
          expect(markers(q)).toEqual([]); // no places to count grid lines between
          expect(time.check(q, { kind: 'number', value: min })).toEqual({ correct: false, mistake: { key: 'q.time.mistake.minutes' } });
          expect(time.check(q, { kind: 'number', value: min * 4 })).toEqual({ correct: false, mistake: { key: 'q.time.mistake.multiplied' } });
          for (const c of [deg + 1, deg - 1, deg * 15, 360 - deg]) if (c !== deg && c !== min && c !== min * 4) expect(time.check(q, { kind: 'number', value: c }), `seed ${s} candidate ${c}`).toEqual({ correct: false });
          continue;
        }

        const [A, B] = markers(q);
        expect(A!.label).toBe('A');
        expect(B!.label).toBe('B');
        expect(A!.p.lon).toBe(a);
        expect(B!.p.lon).toBe(b);
        expect(Math.abs(A!.p.lat - B!.p.lat), `seed ${s}`).toBeGreaterThanOrEqual(8);
        expect(Math.abs(A!.p.lat)).toBeLessThanOrEqual(65);
        expect(Math.abs(B!.p.lat)).toBeLessThanOrEqual(65);
        expect(q.solution).toEqual([{ kind: 'lon-diff', a: A!.p, b: B!.p }]);
        // The flat map cannot wrap across 180°, so those questions put the globe first.
        expect(q.scene.views[0]).toBe(across180 ? 'globe' : 'flat');
        expect(q.scene.phoneView).toBe(across180 ? 'globe' : undefined); // phones open on the globe too
        const allKeys = keysIn(q.explanation);
        expect(allKeys, `seed ${s}`).toContain(ruleKey(a, b));

        if (variant === 'later') {
          expect(q.input.kind).toBe('choice');
          expect(q.answer).toEqual({ kind: 'choice', index: east > 0 ? 1 : 0 });
          expect(q.explanation.key).toBe(`q.time.explain.later.${east > 0 ? 'east' : 'west'}`);
          expect(en).toContain(east > 0 ? 'So B is further east than A.' : 'So A is further east than B.');
          expect(time.check(q, { kind: 'choice', index: east > 0 ? 0 : 1 })).toEqual({ correct: false, mistake: { key: 'q.time.mistake.direction' } });
          expect(q.scene.layers?.daylight ?? false).toBe(false); // no time given, so no Sun to draw
          continue;
        }

        // Clock variant.
        expect(q.input).toEqual({ kind: 'clock' });
        const minutesA = q.meta!.minutesA as number;
        const answer = wrap(minutesA + east * min);
        expect(q.answer).toEqual({ kind: 'clock', minutes: answer });
        expect(renderText(q.prompt, 'en')).toContain(`it is ${hhmm(minutesA)} local solar time`);
        // The date at B in the solar-time model: both clocks read the same UTC instant, local = UTC + lon × 4 (lon in (−180, 180]).
        // Plain midnight crossings change the date; crossing the 180° meridian shifts it the other way.
        const rawB = minutesA + (b - a) * 4;
        const nextDay = rawB >= 1440, dayBefore = rawB < 0;
        if (nextDay || dayBefore) variants.midnight++;
        if (across180) {
          if (east > 0 && dayBefore) variants.dateLineBack++;
          else if (east < 0 && nextDay) variants.dateLineForward++;
          else if (!nextDay && !dayBefore && (minutesA + east * min >= 1440 || minutesA + east * min < 0)) variants.dateLineSameDay++;
        }
        if (d === 'easy') { expect(nextDay || dayBefore, `seed ${s}`).toBe(false); expect(minutesA % 60).toBe(0); }
        else expect(minutesA % 15).toBe(0);
        // The explanation shows the degrees, the minutes and the addition or subtraction, and says when the date changes.
        expect(en, `seed ${s}`).toContain(`${deg}°.`);
        expect(en).toContain(`${deg} × 4 = ${min} min`);
        if (min >= 60) expect(en).toContain(`${min} min = ${Math.floor(min / 60)} h`);
        expect(en).toContain(east > 0 ? `${hhmm(minutesA)} + ${min} min = ${hhmm(answer)}` : `${hhmm(minutesA)} − ${min} min = ${hhmm(answer)}`);
        expect(en).toContain(east > 0 ? 'B is further east, so its time is later' : 'B is further west, so its time is earlier');
        expect(en.includes('the next day'), `seed ${s}`).toBe(nextDay);
        expect(en.includes('the day before'), `seed ${s}`).toBe(dayBefore);
        expect(en.includes('the date goes back one day')).toBe(across180 && dayBefore);
        expect(en.includes('the date moves forward one day')).toBe(across180 && nextDay);
        // The map shows day and night as they are at that moment: the Sun gives A exactly the asked time.
        expect(q.scene.layers?.daylight).toBe(true);
        expect(wrap(q.scene.sun!.utcMinutes + a * 4)).toBe(minutesA);
        // Hints fire only in their own situation.
        const wrongWay = wrap(minutesA - east * min);
        const perDegree = [wrap(minutesA + deg), wrap(minutesA - deg)];
        const candidates = new Set([wrongWay, ...perDegree, wrap(answer + 1), wrap(answer - 4), wrap(answer + 60), wrap(minutesA), wrap(answer + 720)]);
        for (const c of candidates) {
          if (c === answer) continue;
          const res = time.check(q, { kind: 'clock', minutes: c });
          expect(res.correct).toBe(false);
          const want = c === wrongWay ? (across180 ? 'q.time.mistake.over180' : 'q.time.mistake.direction') : perDegree.includes(c) ? 'q.time.mistake.perDegree' : undefined;
          expect(res.mistake?.key, `seed ${s} candidate ${hhmm(c)}`).toBe(want);
        }
      }
      expect(variants.later).toBeGreaterThan(SEEDS / 6);
      expect(variants.clock).toBeGreaterThan(SEEDS / 4);
      if (d === 'easy') expect(variants.degrees).toBe(0);
      else { expect(variants.degrees).toBeGreaterThan(SEEDS / 10); expect(variants.midnight).toBeGreaterThan(SEEDS / 50); }
      if (d === 'medium') expect(variants.primeCrossing).toBeGreaterThan(SEEDS / 5);
      if (d === 'hard') { expect(variants.dateLineBack).toBeGreaterThan(0); expect(variants.dateLineForward).toBeGreaterThan(0); expect(variants.dateLineSameDay).toBeGreaterThan(0); }
    });
  }

  test('every language renders the explanations without leftovers', () => {
    for (const d of DIFFS) for (let s = 0; s < 200; s++) {
      const q = time.generate(createRng(`time-render:${d}:${s}`), d, 8);
      for (const lang of ['en', 'pl', 'uk'] as const) {
        const out = [q.prompt, q.explanation].map((t) => renderText(t, lang)).join(' ');
        expect(out).not.toMatch(/\{\w+\}|\.\.|  /);
      }
    }
  });
});
