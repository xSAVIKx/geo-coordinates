import { latDifference, latDifferenceMethod, lonDifference, lonDifferenceMethod } from '../../geo/compare';
import { normalizeLon } from '../../geo/format';
import type { Axis, LatLon } from '../../geo/types';
import type { Text } from '../../i18n/text';
import type { SceneSpec } from '../../map/types';
import { numberText } from '../answerText';
import { fitFlatView, gridInt, gridStepFor, signed } from '../values';
import type { Difficulty, Question, QuestionModule, Rng } from '../types';

export type DiffMethod = 'same-subtract' | 'opposite-add' | 'opposite-over-180' | 'zero-line';

export function differenceMethod(axis: Axis, a: number, b: number): DiffMethod {
  return axis === 'lat' ? latDifferenceMethod(a, b) : lonDifferenceMethod(a, b);
}

/** The worked difference for two latitudes or longitudes: which rule applies and the arithmetic. */
export function differenceExplanation(axis: Axis, a: number, b: number): Text {
  const x = Math.abs(a), y = Math.abs(b);
  const result = axis === 'lat' ? latDifference(a, b) : lonDifference(a, b);
  switch (differenceMethod(axis, a, b)) {
    case 'same-subtract': return { key: `q.diff.explain.same.${axis}`, params: { big: Math.max(x, y), small: Math.min(x, y), result } };
    case 'opposite-add': return { key: `q.diff.explain.opposite.${axis}`, params: { x, y, result } };
    case 'opposite-over-180': return { key: 'q.diff.explain.over180', params: { x, y, sum: x + y, result } };
    case 'zero-line': return { key: `q.diff.explain.zero.${axis}`, params: { result } };
  }
}

/**
 * The hint for a wrong difference, or undefined. Each hint fires only in its own situation:
 * "subtracted" when the points are on different sides and the answer is |x − y| ("subtracted over 180" when their sum
 * passes 180°), "added" when they
 * are on the same side and the answer is x + y, "over 180" when the sum passed 180° and the answer is that sum.
 */
export function differenceMistake(axis: Axis, method: DiffMethod, x: number, y: number, response: number, scale = 1, tolerance = 1e-9): Text | undefined {
  const near = (v: number) => Math.abs(response - v * scale) <= tolerance;
  if (method === 'opposite-add' && near(Math.abs(x - y))) return { key: `q.diff.mistake.subtracted.${axis}` };
  // Across 180° adding alone is not the answer either, so this hint names both steps.
  if (method === 'opposite-over-180' && near(Math.abs(x - y))) return { key: 'q.diff.mistake.subtractedOver180' };
  if (method === 'same-subtract' && near(x + y)) return { key: `q.diff.mistake.added.${axis}` };
  if (method === 'opposite-over-180' && near(x + y)) return { key: 'q.diff.mistake.over180' };
  return undefined;
}

function pickValues(rng: Rng, d: Difficulty, axis: Axis): [number, number] {
  const max = axis === 'lat' ? 70 : 170; // latitudes stay ≤ 70° so markers and labels are never squeezed against the map edge
  for (;;) {
    let a: number, b: number;
    if (d === 'easy') {
      // One hemisphere, multiples of 10.
      const s = signed(rng);
      a = gridInt(rng, 10, max, 10) * s; b = gridInt(rng, 10, max, 10) * s;
    } else if (d === 'medium') {
      // Any whole degree, mostly across the equator / prime meridian, sometimes a point on it; never across 180°.
      a = rng.int(1, max) * signed(rng); b = rng.int(1, max) * signed(rng);
      if (rng.next() < 0.6) b = -Math.sign(a) * Math.abs(b);
      if (rng.next() < 0.1) b = 0;
      if (axis === 'lon' && Math.abs(a) + Math.abs(b) >= 180) continue;
    } else if (axis === 'lon' && rng.next() < 0.6) {
      // Hard: mostly the shorter way across the 180° meridian.
      a = rng.int(100, 179); b = -rng.int(Math.max(1, 181 - a), 179);
      if (rng.next() < 0.5) [a, b] = [b, a];
    } else {
      a = rng.int(1, axis === 'lat' ? 70 : 179) * signed(rng); b = rng.int(1, axis === 'lat' ? 70 : 179) * signed(rng);
      // Exactly 180° apart across both lines: both ways are equally long, so there is no "shorter way" to show.
      if (axis === 'lon' && Math.sign(a) !== Math.sign(b) && Math.abs(a) + Math.abs(b) === 180) continue;
    }
    if (a !== b) return [a, b];
  }
}

export const difference: QuestionModule = {
  type: 'difference',
  topics: [6],
  generate(rng, difficulty): Question {
    const axis = rng.pick(['lat', 'lon'] as const);
    const [va, vb] = pickValues(rng, difficulty, axis);
    // The other coordinate only places the markers; it is kept 8–20° apart so A and B never sit on top of each other.
    const offset = rng.int(8, 20) * signed(rng);
    let A: LatLon, B: LatLon;
    if (axis === 'lat') {
      // Away from the middle of a world map, so the bracket and its numbers fit beside the markers even at zoom 1.
      const lon = rng.int(60, 150) * signed(rng);
      A = { lat: va, lon }; B = { lat: vb, lon: lon + offset };
    } else {
      const lat = rng.int(-50, 50);
      A = { lat, lon: va }; B = { lat: Math.max(-65, Math.min(65, lat + offset)), lon: vb }; // |A.lat| ≤ 50, so the clamp keeps them ≥ 15° apart
    }
    const method = differenceMethod(axis, va, vb);
    const result = axis === 'lat' ? latDifference(va, vb) : lonDifference(va, vb);
    const over180 = method === 'opposite-over-180';
    let scene: SceneSpec;
    const markers = [{ kind: 'marker', p: A, tone: 'a', label: 'A' }, { kind: 'marker', p: B, tone: 'b', label: 'B' }] as const;
    if (over180) {
      // The flat map cannot wrap across 180°, so the globe (turned to the middle of the short way) comes first.
      const east = va > 0 ? va : vb;
      const midLon = normalizeLon(east + result / 2);
      const midLat = Math.round((A.lat + B.lat) / 2);
      scene = { views: ['globe', 'flat'], phoneView: 'globe', point: null, flatProjection: 'grid', rotate: [-midLon, -Math.max(-40, Math.min(40, midLat))], layers: { specialLines: true, places: false }, overlays: [...markers] };
    } else {
      const flatView = fitFlatView([A, B], axis === 'lat' ? 'side' : 'top');
      scene = { views: ['flat'], point: null, flatView, flatProjection: 'grid', layers: { specialLines: true, places: false, graticuleStep: gridStepFor(flatView.zoom) }, overlays: [...markers] };
    }
    return {
      id: '', type: 'difference', topic: 6, difficulty,
      prompt: { key: `q.diff.prompt.${axis}`, params: { a: { coord: A, axis }, b: { coord: B, axis } } },
      input: { kind: 'number', unit: 'deg' },
      answer: { kind: 'number', value: result },
      explanation: differenceExplanation(axis, va, vb),
      scene,
      solution: [axis === 'lat' ? { kind: 'lat-diff', a: A, b: B } : { kind: 'lon-diff', a: A, b: B }],
      meta: { axis, method, x: Math.abs(va), y: Math.abs(vb) },
    };
  },
  check(q, r) {
    if (r.kind !== 'number' || q.answer.kind !== 'number') return { correct: false };
    if (Math.abs(r.value - q.answer.value) < 1e-9) return { correct: true };
    const { axis, method, x, y } = q.meta as { axis: Axis; method: DiffMethod; x: number; y: number };
    const mistake = differenceMistake(axis, method, x, y, r.value);
    return mistake ? { correct: false, mistake } : { correct: false };
  },
  describeAnswer: (q) => numberText((q.answer as { value: number }).value, 'deg'),
};
