import { lonDifference, lonDifferenceMethod } from '../../geo/compare';
import { normalizeLon } from '../../geo/format';
import { formatClock, MINUTES_PER_DEGREE, solarOffsetMinutes, wrapDayMinutes } from '../../geo/time';
import type { LatLon } from '../../geo/types';
import type { Text } from '../../i18n/text';
import type { Overlay, SceneSpec } from '../../map/types';
import { numberText } from '../answerText';
import { checkChoice, choiceText } from '../check';
import type { Difficulty, Question, QuestionModule, Rng } from '../types';
import { fitFlatView, gridInt, signed } from '../values';
import { differenceExplanation } from './difference';

export type TimeVariant = 'later' | 'clock' | 'degrees';

/**
 * Two whole-degree meridians, never the same and never exactly 180° apart, so "further east" always has one answer
 * (the shorter way). Easy: multiples of 15° in one hemisphere. Medium: any degree, often across the prime meridian,
 * never across 180°. Hard: always the shorter way across the 180° meridian.
 */
function pickLons(rng: Rng, d: Difficulty): [number, number] {
  for (;;) {
    let a: number, b: number;
    if (d === 'easy') {
      const s = signed(rng);
      a = gridInt(rng, 0, 165, 15) * s; b = gridInt(rng, 0, 165, 15) * s;
    } else if (d === 'medium') {
      a = rng.int(-90, 90); b = a + rng.int(5, 90) * signed(rng);
      if (Math.abs(b) >= 180) continue;
    } else {
      a = rng.int(120, 179) * signed(rng); b = -Math.sign(a) * rng.int(120, 179);
    }
    a += 0; b += 0; // turn −0 into 0
    const diff = lonDifference(a, b);
    if (diff > 0 && diff < 180) return [a, b];
  }
}

const duration = (min: number): Text => {
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return { key: 'q.time.duration.m', params: { m } };
  if (m === 0) return { key: 'q.time.duration.h', params: { h } };
  return { key: 'q.time.duration', params: { h, m } };
};

/** Why one meridian is further east than the other — the same rules as topic 2, plus the 180° crossing. */
export function eastRule(lonA: number, lonB: number): Text {
  switch (lonDifferenceMethod(lonA, lonB)) {
    case 'zero-line': return { key: 'q.rule.zero.lon' };
    case 'same-subtract': return { key: `q.rule.bigger.${lonA > 0 ? 'E' : 'W'}` };
    case 'opposite-add': return { key: 'q.rule.mixed.lon' };
    case 'opposite-over-180': return { key: `q.time.rule.across180.${solarOffsetMinutes(lonA, lonB) > 0 ? 'east' : 'west'}`, params: { deg: lonDifference(lonA, lonB) } };
  }
}

function sceneFor(A: LatLon, B: LatLon, daylight: { utcMinutes: number } | null): SceneSpec {
  const overlays: Overlay[] = [
    { kind: 'highlight-line', axis: 'lon', value: A.lon }, { kind: 'highlight-line', axis: 'lon', value: B.lon },
    { kind: 'marker', p: A, tone: 'a', label: 'A' }, { kind: 'marker', p: B, tone: 'b', label: 'B' },
  ];
  const base = {
    point: null, flatProjection: 'grid' as const, overlays,
    layers: { specialLines: true, places: false, graticuleStep: 15 as const, daylight: daylight !== null },
    sun: daylight ? { utcMinutes: daylight.utcMinutes, dayOfYear: 80 } : null,
  };
  if (lonDifferenceMethod(A.lon, B.lon) === 'opposite-over-180') {
    // The flat map cannot wrap across 180°, so the globe (turned to the middle of the short way) comes first.
    const east = A.lon > 0 ? A.lon : B.lon;
    const mid = normalizeLon(east + lonDifference(A.lon, B.lon) / 2);
    const midLat = Math.round((A.lat + B.lat) / 2);
    return { ...base, views: ['globe', 'flat'], rotate: [-mid, -Math.max(-40, Math.min(40, midLat))] };
  }
  return { ...base, views: ['flat'], flatView: fitFlatView([A, B], 'top') };
}

export const time: QuestionModule = {
  type: 'time',
  topics: [8],
  generate(rng, difficulty): Question {
    const [lonA, lonB] = pickLons(rng, difficulty);
    const offset = solarOffsetMinutes(lonA, lonB); // positive: B is further east, so its time is later
    const deg = lonDifference(lonA, lonB);
    const min = deg * MINUTES_PER_DEGREE;
    const dir = offset > 0 ? 'east' : 'west';
    const variant: TimeVariant = difficulty === 'easy' ? rng.pick(['later', 'clock'] as const) : rng.pick(['later', 'clock', 'clock', 'degrees'] as const);
    const base = { id: '', type: 'time' as const, topic: 8 as const, difficulty };

    if (variant === 'degrees') {
      return {
        ...base,
        prompt: { key: 'q.time.prompt.degrees', params: { duration: { text: duration(min) } } },
        input: { kind: 'number', unit: 'deg' },
        answer: { kind: 'number', value: deg },
        explanation: min >= 60
          ? { key: 'q.time.explain.degrees', params: { duration: { text: duration(min) }, min, deg } }
          : { key: 'q.time.explain.degreesShort', params: { min, deg } },
        scene: { views: ['flat'], point: null, flatProjection: 'grid', layers: { specialLines: true, places: false, graticuleStep: 15 } },
        solution: [],
        meta: { variant, lonA, lonB, min },
      };
    }

    // The other coordinate only places the markers, 8–20° apart so A and B never sit on top of each other.
    const latA = rng.int(-45, 50);
    const A: LatLon = { lat: latA, lon: lonA };
    const B: LatLon = { lat: Math.max(-60, Math.min(65, latA + rng.int(8, 20) * signed(rng))), lon: lonB };
    const solution: Overlay[] = [{ kind: 'lon-diff', a: A, b: B }];
    const rule = eastRule(lonA, lonB);

    if (variant === 'later') {
      return {
        ...base,
        prompt: { key: 'q.time.prompt.later', params: { a: { coord: A, axis: 'lon' }, b: { coord: B, axis: 'lon' } } },
        input: { kind: 'choice', options: [{ key: 'q.time.opt.a' }, { key: 'q.time.opt.b' }] },
        answer: { kind: 'choice', index: offset > 0 ? 1 : 0 },
        explanation: { key: `q.time.explain.later.${dir}`, params: { rule: { text: rule } } },
        scene: sceneFor(A, B, null),
        solution,
        meta: { variant, lonA, lonB },
      };
    }

    let minutesA: number;
    if (difficulty === 'easy') {
      // Whole hours between 06:00 and 18:00, and the answer stays on the same day.
      const shiftH = offset / 60;
      minutesA = rng.int(Math.max(6, -shiftH), Math.min(18, 23 - shiftH)) * 60;
    } else {
      minutesA = rng.int(0, 95) * 15;
    }
    const raw = minutesA + offset;
    const minutesB = wrapDayMinutes(raw);
    const day = raw >= 1440 ? 'NextDay' : raw < 0 ? 'PrevDay' : '';
    const times = { timeA: formatClock(minutesA), timeB: formatClock(minutesB), min };
    return {
      ...base,
      prompt: { key: 'q.time.prompt.clock', params: { time: formatClock(minutesA), a: { coord: A, axis: 'lon' }, b: { coord: B, axis: 'lon' } } },
      input: { kind: 'clock' },
      answer: { kind: 'clock', minutes: minutesB },
      explanation: {
        key: 'q.time.explain.clock',
        params: {
          diff: { text: differenceExplanation('lon', lonA, lonB) },
          minutes: { text: min >= 60 ? { key: 'q.time.minutesLong', params: { deg, min, duration: { text: duration(min) } } } : { key: 'q.time.minutes', params: { deg, min } } },
          calc: { text: { key: `q.time.calc.${dir}${day}`, params: { rule: { text: rule }, ...times } } },
        },
      },
      scene: sceneFor(A, B, { utcMinutes: wrapDayMinutes(minutesA - lonA * MINUTES_PER_DEGREE) }),
      solution,
      meta: { variant, lonA, lonB, minutesA },
    };
  },
  check(q, r) {
    const m = q.meta as { lonA: number; lonB: number; minutesA: number; min: number };
    if (q.input.kind === 'choice') {
      const res = checkChoice(q, r);
      return res.correct ? res : { correct: false, mistake: { key: 'q.time.mistake.direction' } };
    }
    if (q.answer.kind === 'number') {
      if (r.kind !== 'number') return { correct: false };
      if (Math.abs(r.value - q.answer.value) < 1e-9) return { correct: true };
      if (Math.abs(r.value - m.min) < 1e-9) return { correct: false, mistake: { key: 'q.time.mistake.minutes' } };
      if (Math.abs(r.value - m.min * 4) < 1e-9) return { correct: false, mistake: { key: 'q.time.mistake.multiplied' } };
      return { correct: false };
    }
    if (q.answer.kind !== 'clock' || r.kind !== 'clock') return { correct: false };
    if (r.minutes === q.answer.minutes) return { correct: true };
    const offset = solarOffsetMinutes(m.lonA, m.lonB);
    if (r.minutes === wrapDayMinutes(m.minutesA - offset)) return { correct: false, mistake: { key: 'q.time.mistake.direction' } };
    const deg = lonDifference(m.lonA, m.lonB);
    if (r.minutes === wrapDayMinutes(m.minutesA + deg) || r.minutes === wrapDayMinutes(m.minutesA - deg)) return { correct: false, mistake: { key: 'q.time.mistake.perDegree' } };
    return { correct: false };
  },
  describeAnswer(q) {
    if (q.input.kind === 'choice') return choiceText(q);
    if (q.answer.kind === 'number') return numberText(q.answer.value, 'deg');
    return { key: 'q.answer.clock', params: { time: formatClock((q.answer as { minutes: number }).minutes) } };
  },
};
