import { latDifference } from '../../geo/compare';
import { KM_PER_DEGREE } from '../../geo/distance';
import type { LatLon } from '../../geo/types';
import type { Overlay } from '../../map/types';
import { round1 } from '../../map/brackets';
import { numberText } from '../answerText';
import { fitFlatView, gridInt, signed } from '../values';
import type { Difficulty, Question, QuestionModule, Rng } from '../types';
import { differenceExplanation, differenceMethod, differenceMistake, type DiffMethod } from './difference';

const KM_TOLERANCE = 1;   // km answers: ±1 km
const DEG_TOLERANCE = 0.1; // degree answers from a km distance: ±0.1°

// Latitudes stay ≤ 70° so markers and labels are never squeezed against the map edge.
function pickLatitudes(rng: Rng, d: Difficulty): [number, number] {
  for (;;) {
    let a: number, b: number;
    if (d === 'easy') {
      // One hemisphere, multiples of 10.
      const s = signed(rng);
      a = gridInt(rng, 10, 70, 10) * s; b = gridInt(rng, 10, 70, 10) * s;
    } else if (d === 'medium') {
      // Any whole degree, mostly across the equator.
      if (rng.next() < 0.6) { a = rng.int(1, 60); b = -rng.int(1, 60); if (rng.next() < 0.5) [a, b] = [b, a]; }
      else { const s = signed(rng); a = rng.int(1, 70) * s; b = rng.int(1, 70) * s; }
    } else {
      // Hard: anywhere up to 70°, including a point on the equator.
      a = rng.int(-70, 70); b = rng.int(-70, 70);
    }
    if (a !== b) return [a, b];
  }
}

export const distance: QuestionModule = {
  type: 'distance',
  topics: [7],
  generate(rng, difficulty): Question {
    const reverse = difficulty === 'hard' && rng.next() < 0.5;
    const [a, b] = pickLatitudes(rng, difficulty);
    // Away from the middle of a world map, so the bracket and its numbers fit beside the meridian even at zoom 1.
    const lon = rng.int(60, 170) * signed(rng);
    const A: LatLon = { lat: a, lon }, B: LatLon = { lat: b, lon };
    const deg = latDifference(a, b);
    const km = round1(deg * KM_PER_DEGREE);
    const method = differenceMethod('lat', a, b);
    const markers: Overlay[] = [{ kind: 'marker', p: A, tone: 'a', label: 'A' }, { kind: 'marker', p: B, tone: 'b', label: 'B' }];
    const meridian: Overlay = { kind: 'highlight-line', axis: 'lon', value: lon };
    const bracket: Overlay = { kind: 'distance', a: A, b: B };
    const base = { id: '', type: 'distance' as const, topic: 7 as const, difficulty };
    // Grid map: straight meridians, so the bracket runs alongside the meridian it measures.
    const flatView = fitFlatView([A, B], 'side');
    if (reverse) {
      // Only the distance is given, so the map shows the meridian but not the places (their latitudes would give the answer away).
      return {
        ...base,
        prompt: { key: 'q.dist.promptReverse', params: { km } },
        input: { kind: 'number', unit: 'deg' },
        answer: { kind: 'number', value: deg },
        explanation: { key: 'q.dist.explainReverse', params: { km, deg } },
        scene: { views: ['flat'], point: null, flatView, flatProjection: 'grid', layers: { specialLines: true, places: false }, overlays: [meridian] },
        solution: [...markers, bracket],
        meta: { mode: 'reverse', deg, km },
      };
    }
    return {
      ...base,
      prompt: { key: 'q.dist.prompt', params: { a: { coord: A, axis: 'lat' }, b: { coord: B, axis: 'lat' } } },
      input: { kind: 'number', unit: 'km' },
      answer: { kind: 'number', value: km },
      explanation: { key: 'q.dist.explain', params: { diff: { text: differenceExplanation('lat', a, b) }, deg, km } },
      scene: { views: ['flat'], point: null, flatView, flatProjection: 'grid', layers: { specialLines: true, places: false }, overlays: [meridian, ...markers] },
      solution: [bracket],
      meta: { mode: 'forward', deg, km, method, x: Math.abs(a), y: Math.abs(b) },
    };
  },
  check(q, r) {
    if (r.kind !== 'number' || q.answer.kind !== 'number') return { correct: false };
    const m = q.meta as { mode: 'forward' | 'reverse'; deg: number; km: number; method?: DiffMethod; x?: number; y?: number };
    const v = r.value;
    if (m.mode === 'reverse') {
      if (Math.abs(v - m.deg) <= DEG_TOLERANCE) return { correct: true };
      if (Math.abs(v - m.km / 111) <= DEG_TOLERANCE) return { correct: true, note: { key: 'q.dist.note111' } };
      if (Math.abs(v - m.km * KM_PER_DEGREE) <= KM_TOLERANCE || Math.abs(v - m.km * 111) <= KM_TOLERANCE) return { correct: false, mistake: { key: 'q.dist.mistake.multiplied' } };
      return { correct: false };
    }
    if (Math.abs(v - m.deg * KM_PER_DEGREE) <= KM_TOLERANCE) return { correct: true };
    if (Math.abs(v - m.deg * 111) <= KM_TOLERANCE) return { correct: true, note: { key: 'q.dist.note111' } };
    if (Math.abs(v - m.deg) < 1e-9) return { correct: false, mistake: { key: 'q.dist.mistake.degrees' } };
    // The wrong rule for the degrees, then either km factor.
    const mistake = differenceMistake('lat', m.method!, m.x!, m.y!, v, KM_PER_DEGREE, KM_TOLERANCE) ?? differenceMistake('lat', m.method!, m.x!, m.y!, v, 111, KM_TOLERANCE);
    return mistake ? { correct: false, mistake } : { correct: false };
  },
  describeAnswer: (q) => numberText((q.answer as { value: number }).value, q.input.kind === 'number' ? q.input.unit : 'km'),
};
