import { extremeIndex, spansAntimeridian } from '../../geo/compare';
import { normalizeLon } from '../../geo/format';
import type { LatLon, Precision } from '../../geo/types';
import type { Text, TextParam } from '../../i18n/text';
import type { Overlay } from '../../map/types';
import { checkChoice, choiceText } from '../check';
import { LABELS, MARKER_GAP_PX, TONES, fitFlatView, gridInt, gridStepFor, minGapPx, signed, withMinutes } from '../values';
import type { Question, QuestionModule, Rng, Difficulty, TopicId } from '../types';

type Dir = 'N' | 'S' | 'E' | 'W';
const MINUTE_ROW_STEP = 2;
const OPPOSITE: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' };

function values(rng: Rng, difficulty: Difficulty, axis: 'lat' | 'lon', n: number, minutes: boolean): number[] | null {
  const max = axis === 'lat' ? 80 : 170;
  const trapSign = -1; // S or W: "bigger number" goes the "wrong" way
  const out: number[] = [];
  if (minutes) {
    const deg = rng.int(1, max - 1) * signed(rng);
    const mins = rng.shuffle([0, 10, 15, 20, 30, 40, 45, 50]).slice(0, n);
    return mins.map((m) => withMinutes(deg, m));
  }
  const sameSign = difficulty === 'easy' || (difficulty === 'hard' && rng.next() < 0.5);
  const sign = difficulty === 'hard' && rng.next() < 0.7 ? trapSign : signed(rng);
  const minGap = difficulty === 'easy' ? 10 : 3;
  for (let tries = 0; out.length < n && tries < 200; tries++) {
    const v = difficulty === 'easy' ? gridInt(rng, 10, max, 10) * sign : (sameSign ? sign : signed(rng)) * rng.int(1, max);
    if (out.every((o) => Math.abs(o - v) >= minGap)) out.push(v);
  }
  return out.length === n ? out : null;
}

function biggerRule(value: number, axis: 'lat' | 'lon'): Text {
  const letter = axis === 'lat' ? (value > 0 ? 'N' : 'S') : value > 0 ? 'E' : 'W';
  return { key: `q.rule.bigger.${letter}` };
}

// Values are never 0. One hemisphere: the bigger-number rule. Mixed: the letter rule, plus the
// bigger-number rule when another point shares the winner's hemisphere (e.g. 37°S beats 30°S).
function explanationFor(vals: number[], answer: number, axis: 'lat' | 'lon', params: Record<string, TextParam>): Text {
  const win = vals[answer]!;
  if (new Set(vals.map(Math.sign)).size === 1) return { key: 'q.further.explain', params: { ...params, rule: { text: biggerRule(win, axis) } } };
  const mixed: Text = { key: `q.rule.mixed.${axis}` };
  const rival = vals.some((v, i) => i !== answer && Math.sign(v) === Math.sign(win));
  return rival
    ? { key: 'q.further.explain2', params: { ...params, rule: { text: mixed }, rule2: { text: biggerRule(win, axis) } } }
    : { key: 'q.further.explain', params: { ...params, rule: { text: mixed } } };
}

export const further: QuestionModule = {
  type: 'further',
  topics: [2, 5],
  generate(rng, difficulty, topic: TopicId): Question {
    const minutes = topic === 5;
    const precision: Precision = minutes ? 'minute' : 'degree';
    const n = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 3 : 4;
    for (;;) {
      const dir = rng.pick(['N', 'S', 'E', 'W'] as const);
      const axis = dir === 'N' || dir === 'S' ? 'lat' : 'lon';
      const vals = values(rng, difficulty, axis, n, minutes);
      if (!vals) continue;
      if (axis === 'lon') {
        // "Further east/west" is only clear on a stretch narrower than 180° that does not cross the 180° meridian.
        const lons = vals.map(normalizeLon);
        if (spansAntimeridian(vals) || Math.max(...lons) - Math.min(...lons) >= 180) continue;
      }
      // With minutes the values differ by less than a degree, so the markers stand in a row 2° apart along the other axis
      // (far enough apart at the fitted zoom of 12 to tell them apart).
      const otherBase = minutes ? (axis === 'lat' ? rng.int(-170, 170) : rng.int(-60, 60)) : 0;
      const points: LatLon[] = vals.map((v, i) => {
        const other = minutes ? otherBase + i * MINUTE_ROW_STEP : axis === 'lat' ? rng.int(-160, 160) : rng.int(-60, 60);
        return axis === 'lat' ? { lat: v, lon: other } : { lat: other, lon: v };
      });
      const answer = extremeIndex(points, dir);
      const opposite = extremeIndex(points, OPPOSITE[dir]);
      // The view fits the markers, so markers a few degrees apart are drawn apart on a phone and on paper; a set still too
      // crowded at that zoom is drawn again.
      const flatView = fitFlatView(points, 'markers');
      if (minGapPx(points, flatView.zoom) < MARKER_GAP_PX) continue;
      const overlays: Overlay[] = points.map((p, i) => ({ kind: 'marker', p, tone: TONES[i]!, label: LABELS[i] }));
      const winner = points[answer]!;
      return {
        id: '', type: 'further', topic, difficulty,
        prompt: { key: `q.further.prompt.${dir}` },
        input: { kind: 'choice', options: points.map((p, i): Text => ({ key: 'q.further.option', params: { label: LABELS[i]!, coord: { coord: p, axis, precision } } })) },
        answer: { kind: 'choice', index: answer },
        explanation: explanationFor(vals, answer, axis, { label: LABELS[answer]!, coord: { coord: winner, axis, precision }, dir: { text: { key: `q.dirWord.${dir}` } } }),
        scene: {
          views: ['flat'], point: null, flatProjection: 'grid',
          layers: { specialLines: true, places: false, graticuleStep: minutes ? 1 : gridStepFor(flatView.zoom) },
          flatView,
          overlays,
        },
        solution: [{ kind: 'marker', p: winner, tone: 'answer' }],
        meta: { opposite, dir },
      };
    }
  },
  check(q, r) {
    const res = checkChoice(q, r);
    if (!res.correct && r.kind === 'choice' && r.index === q.meta?.opposite) {
      const dir = q.meta?.dir as Dir;
      res.mistake = { key: 'q.further.mistake.opposite', params: { dir: { text: { key: `q.dirWord.${OPPOSITE[dir]}` } } } };
    }
    return res;
  },
  describeAnswer: choiceText,
};
