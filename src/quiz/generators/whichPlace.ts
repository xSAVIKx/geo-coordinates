import { lonDifference } from '../../geo/compare';
import type { LatLon } from '../../geo/types';
import type { Text } from '../../i18n/text';
import { PLACES } from '../../map/places';
import { checkChoice, choiceText } from '../check';
import { LABELS, TONES, signed } from '../values';
import type { Question, QuestionModule, Rng, Difficulty } from '../types';

type Kind = 'answer' | 'ns' | 'ew' | 'both' | 'swap' | 'random';
const far = (a: LatLon, b: LatLon, d: number) => Math.abs(a.lat - b.lat) >= d || lonDifference(a.lon, b.lon) >= d;

function distractors(rng: Rng, difficulty: Difficulty, p: LatLon): { p: LatLon; kind: Kind }[] | null {
  const out: { p: LatLon; kind: Kind }[] = [];
  if (difficulty === 'hard') {
    const cands: { p: LatLon; kind: Kind }[] = [
      { p: { lat: -p.lat, lon: p.lon }, kind: 'ns' },
      { p: { lat: p.lat, lon: -p.lon }, kind: 'ew' },
      { p: { lat: -p.lat, lon: -p.lon }, kind: 'both' },
    ];
    // |lat| = |lon| would make the swap coincide with the answer or a mirror.
    if (Math.abs(p.lon) <= 85 && Math.abs(p.lat) !== Math.abs(p.lon)) cands.push({ p: { lat: p.lon, lon: p.lat }, kind: 'swap' });
    return rng.shuffle(cands).slice(0, 3);
  }
  const minDist = difficulty === 'easy' ? 25 : 8;
  for (let tries = 0; out.length < 3 && tries < 300; tries++) {
    const q: LatLon = difficulty === 'easy'
      ? { lat: rng.int(5, 70) * signed(rng), lon: rng.int(5, 175) * signed(rng) }
      : { lat: Math.max(-80, Math.min(80, p.lat + rng.int(-30, 30))), lon: Math.max(-179, Math.min(179, p.lon + rng.int(-40, 40))) };
    if ([p, ...out.map((o) => o.p)].every((x) => far(x, q, minDist))) out.push({ p: q, kind: 'random' });
  }
  return out.length === 3 ? out : null;
}

export const whichPlace: QuestionModule = {
  type: 'which-place',
  topics: [4],
  generate(rng, difficulty): Question {
    for (;;) {
      const place = rng.pick(PLACES.filter((x) => x.kind === 'city'));
      const p: LatLon = { lat: Math.round(place.lat), lon: Math.round(place.lon) };
      if (Math.abs(p.lat) < 5 || Math.abs(p.lon) < 5 || Math.abs(p.lon) > 175) continue; // mirrors would be ambiguous
      const others = distractors(rng, difficulty, p);
      if (!others) continue;
      const all = rng.shuffle([{ p, kind: 'answer' as Kind }, ...others]);
      const index = all.findIndex((x) => x.kind === 'answer');
      const meta: Record<string, string | number> = { placeId: place.id };
      all.forEach((x, i) => { meta[`kind${i}`] = x.kind; });
      return {
        id: '', type: 'which-place', topic: 4, difficulty,
        prompt: { key: 'q.which.prompt', params: { coords: { coord: p } } },
        input: { kind: 'choice', options: all.map((_, i): Text => ({ key: 'q.which.option', params: { label: LABELS[i]! } })) },
        answer: { kind: 'choice', index },
        explanation: { key: 'q.which.explain', params: { label: LABELS[index]!, coords: { coord: p }, place: { place: place.id } } },
        scene: { views: ['flat'], point: null, layers: { specialLines: true, places: false }, overlays: all.map((x, i) => ({ kind: 'marker' as const, p: x.p, tone: TONES[i]!, label: LABELS[i] })) },
        solution: [{ kind: 'marker', p, tone: 'answer' }],
        meta,
      };
    }
  },
  check(q, r) {
    const res = checkChoice(q, r);
    if (!res.correct && r.kind === 'choice') {
      const kind = q.meta?.[`kind${r.index}`];
      const key = { ns: 'q.mistake.nsLetter', ew: 'q.mistake.ewLetter', both: 'q.mistake.bothLetters', swap: 'q.mistake.swapped' }[kind as 'ns'];
      if (key) res.mistake = { key };
    }
    return res;
  },
  describeAnswer: choiceText,
};
