import { extremeIndex, spansAntimeridian } from '../../geo/compare';
import type { LatLon, Precision } from '../../geo/types';
import type { Text } from '../../i18n/text';
import type { Overlay } from '../../map/types';
import { checkChoice, choiceText } from '../check';
import { LABELS, TONES, gridInt, signed, withMinutes } from '../values';
import type { Question, QuestionModule, Rng, Difficulty, TopicId } from '../types';

type Dir = 'N' | 'S' | 'E' | 'W';
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

function ruleFor(vals: number[], axis: 'lat' | 'lon'): Text {
  const signs = new Set(vals.map(Math.sign));
  if (signs.size > 1 || signs.has(0)) return { key: `q.rule.mixed.${axis}` };
  const positive = vals[0]! > 0;
  const letter = axis === 'lat' ? (positive ? 'N' : 'S') : positive ? 'E' : 'W';
  return { key: `q.rule.bigger.${letter}` };
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
      if (axis === 'lon' && spansAntimeridian(vals)) continue;
      const otherBase = minutes ? (axis === 'lat' ? rng.int(-170, 170) : rng.int(-60, 60)) : 0;
      const points: LatLon[] = vals.map((v, i) => {
        const other = minutes ? otherBase + i * 0.6 : axis === 'lat' ? rng.int(-160, 160) : rng.int(-60, 60);
        return axis === 'lat' ? { lat: v, lon: other } : { lat: other, lon: v };
      });
      const answer = extremeIndex(points, dir);
      const opposite = extremeIndex(points, OPPOSITE[dir]);
      const overlays: Overlay[] = points.map((p, i) => ({ kind: 'marker', p, tone: TONES[i]!, label: LABELS[i] }));
      const centre = points.reduce((acc, p) => ({ lat: acc.lat + p.lat / n, lon: acc.lon + p.lon / n }), { lat: 0, lon: 0 });
      const winner = points[answer]!;
      return {
        id: '', type: 'further', topic, difficulty,
        prompt: { key: `q.further.prompt.${dir}` },
        input: { kind: 'choice', options: points.map((p, i): Text => ({ key: 'q.further.option', params: { label: LABELS[i]!, coord: { coord: p, axis, precision } } })) },
        answer: { kind: 'choice', index: answer },
        explanation: { key: 'q.further.explain', params: { label: LABELS[answer]!, coord: { coord: winner, axis, precision }, dir: { text: { key: `q.dirWord.${dir}` } }, rule: { text: ruleFor(vals, axis) } } },
        scene: {
          views: ['flat'], point: null,
          layers: { specialLines: true, places: false, graticuleStep: minutes ? 1 : 10 },
          flatView: minutes ? { center: centre, zoom: 12 } : undefined,
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
