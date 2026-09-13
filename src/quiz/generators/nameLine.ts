import { hemisphereLat, hemisphereLon } from '../../geo/compare';
import type { LatLon } from '../../geo/types';
import type { Text } from '../../i18n/text';
import { POLAR, TROPIC } from '../../map/geometry';
import type { Overlay } from '../../map/types';
import { checkChoice, choiceText } from '../check';
import type { Difficulty, Question, QuestionModule, Rng } from '../types';

type LineKind = 'equator' | 'prime' | 'antimeridian' | 'parallel' | 'meridian' | 'tropicCancer' | 'tropicCapricorn' | 'arcticCircle' | 'antarcticCircle';
const EASY: LineKind[] = ['equator', 'prime', 'parallel', 'meridian'];
const HARD: LineKind[] = [...EASY, 'antimeridian', 'tropicCancer', 'tropicCapricorn', 'arcticCircle', 'antarcticCircle'];
const PARALLEL_KINDS: LineKind[] = ['equator', 'tropicCancer', 'tropicCapricorn', 'arcticCircle', 'antarcticCircle'];
const MERIDIAN_KINDS: LineKind[] = ['prime', 'antimeridian'];

function lineFor(kind: LineKind, rng: Rng): { axis: 'lat' | 'lon'; value: number } {
  switch (kind) {
    case 'equator': return { axis: 'lat', value: 0 };
    case 'prime': return { axis: 'lon', value: 0 };
    case 'antimeridian': return { axis: 'lon', value: 180 };
    case 'tropicCancer': return { axis: 'lat', value: TROPIC };
    case 'tropicCapricorn': return { axis: 'lat', value: -TROPIC };
    case 'arcticCircle': return { axis: 'lat', value: POLAR };
    case 'antarcticCircle': return { axis: 'lat', value: -POLAR };
    case 'parallel': return { axis: 'lat', value: rng.pick([10, 20, 30, 40, 50, 60, 70, 80]) * (rng.next() < 0.5 ? 1 : -1) };
    case 'meridian': return { axis: 'lon', value: rng.pick([30, 60, 90, 120, 150]) * (rng.next() < 0.5 ? 1 : -1) };
  }
}

function base(difficulty: Difficulty, rest: Omit<Question, 'id' | 'type' | 'topic' | 'difficulty'>): Question {
  return { id: '', type: 'name-line', topic: 1, difficulty, ...rest };
}

function lineQuestion(rng: Rng, difficulty: Difficulty): Question {
  const pool = difficulty === 'easy' ? EASY : HARD;
  const kind = rng.pick(pool);
  // A distractor must not also be true: the equator and named parallels ARE parallels, 0° and 180° ARE meridians.
  const forbidden = PARALLEL_KINDS.includes(kind) ? 'parallel' : MERIDIAN_KINDS.includes(kind) ? 'meridian' : null;
  const distractors = rng.shuffle(pool.filter((k) => k !== kind && k !== forbidden)).slice(0, 3);
  const options = rng.shuffle([kind, ...distractors]);
  const { axis, value } = lineFor(kind, rng);
  const overlay: Overlay = { kind: 'highlight-line', axis, value };
  const explainParams = kind === 'parallel' || kind === 'meridian' ? { value: { coord: { lat: value, lon: value }, axis } } : undefined;
  return base(difficulty, {
    prompt: { key: 'q.nameLine.prompt' },
    input: { kind: 'choice', options: options.map((k): Text => ({ key: `q.opt.${k}` })) },
    answer: { kind: 'choice', index: options.indexOf(kind) },
    explanation: { key: `q.nameLine.explain.${kind}`, params: explainParams },
    scene: {
      views: ['globe', 'flat'], point: null,
      rotate: axis === 'lon' ? [-(value === 180 ? 180 : value), -15] : [-20, -Math.max(-60, Math.min(60, value))],
      layers: { specialLines: false, tropics: false, places: false, graticuleStep: 10 },
      overlays: [overlay],
    },
    solution: [],
  });
}

function hemisphereQuestion(rng: Rng, difficulty: Difficulty): Question {
  const regions = ['N', 'S', 'E', 'W'] as const;
  const region = rng.pick(regions);
  const options = rng.shuffle(regions);
  const rotate: Record<typeof region, [number, number]> = { N: [-20, -40], S: [-20, 40], E: [-90, -10], W: [90, -10] };
  return base(difficulty, {
    prompt: { key: 'q.nameLine.promptHemi' },
    input: { kind: 'choice', options: options.map((r): Text => ({ key: `hemi.${r}` })) },
    answer: { kind: 'choice', index: options.indexOf(region) },
    explanation: { key: `q.nameLine.explainHemi.${region}` },
    scene: { views: ['globe', 'flat'], point: null, rotate: rotate[region], layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-region', region }] },
    solution: [],
  });
}

function pointQuestion(rng: Rng, difficulty: Difficulty): Question {
  const p: LatLon = { lat: rng.int(5, 75) * (rng.next() < 0.5 ? 1 : -1), lon: rng.int(5, 175) * (rng.next() < 0.5 ? 1 : -1) };
  const pair = `${hemisphereLat(p.lat)}${hemisphereLon(p.lon)}`;
  const options = rng.shuffle(['NE', 'NW', 'SE', 'SW']);
  return base(difficulty, {
    prompt: { key: 'q.nameLine.promptPoint' },
    input: { kind: 'choice', options: options.map((c): Text => ({ key: `q.opt.pair.${c}` })) },
    answer: { kind: 'choice', index: options.indexOf(pair) },
    explanation: { key: 'q.nameLine.explainPoint', params: { coords: { coord: p }, nsHemi: { text: { key: `q.nameLine.hemiAdj.${hemisphereLat(p.lat)}` } }, ewHemi: { text: { key: `q.nameLine.hemiAdj.${hemisphereLon(p.lon)}` } } } },
    scene: { views: ['flat'], point: null, layers: { specialLines: true, places: false }, overlays: [{ kind: 'marker', p, tone: 'a', label: 'A' }] },
    solution: [],
  });
}

export const nameLine: QuestionModule = {
  type: 'name-line',
  topics: [1],
  generate(rng, difficulty) {
    const variant = difficulty === 'easy' ? rng.pick(['line', 'hemisphere'] as const) : rng.pick(['line', 'hemisphere', 'point'] as const);
    return variant === 'line' ? lineQuestion(rng, difficulty) : variant === 'hemisphere' ? hemisphereQuestion(rng, difficulty) : pointQuestion(rng, difficulty);
  },
  check: checkChoice,
  describeAnswer: choiceText,
};
