import { relativeToMeridian, relativeToParallel } from '../../geo/compare';
import type { LatLon } from '../../geo/types';
import type { Text } from '../../i18n/text';
import { checkChoice, choiceText } from '../check';
import { gridInt, signed } from '../values';
import type { Question, QuestionModule } from '../types';

export const relativeLine: QuestionModule = {
  type: 'relative-line',
  topics: [2],
  generate(rng, difficulty): Question {
    for (;;) {
      const axis = rng.pick(['lat', 'lon'] as const);
      const max = axis === 'lat' ? 70 : 150;
      let line: number, v: number;
      if (difficulty === 'easy') {
        const s = signed(rng);
        line = gridInt(rng, 10, max, 10) * s;
        v = line + gridInt(rng, 10, 30, 10) * rng.pick([1, -1]);
      } else if (difficulty === 'medium') {
        line = rng.int(-max, max);
        v = line + rng.int(3, 40) * rng.pick([1, -1]);
      } else {
        line = -rng.int(5, max);                        // S or W reference line: the trap
        v = line + rng.int(2, 25) * rng.pick([1, -1]);
      }
      const limit = axis === 'lat' ? 85 : 179;
      if (Math.abs(v) > limit || v === line) continue;
      if (difficulty === 'easy' && Math.sign(v) !== Math.sign(line)) continue; // easy: one hemisphere, no crossing of 0° (spec 5.2)
      if (axis === 'lon' && Math.abs(v - line) > 150) continue; // never across 180°
      const p: LatLon = axis === 'lat' ? { lat: v, lon: rng.int(-160, 160) } : { lat: rng.int(-60, 60), lon: v };
      const rel = axis === 'lat' ? relativeToParallel(p.lat, line) : relativeToMeridian(p.lon, line);
      const options = axis === 'lat' ? (['north', 'south'] as const) : (['east', 'west'] as const);
      const index = (options as readonly string[]).indexOf(rel);
      if (index < 0) continue;
      const letter = { north: 'N', south: 'S', east: 'E', west: 'W' }[rel as 'north'];
      const mixed = Math.sign(v) !== Math.sign(line) || v === 0 || line === 0;
      const rule: Text = mixed ? { key: `q.rule.mixed.${axis}` } : { key: `q.rule.bigger.${axis === 'lat' ? (line > 0 ? 'N' : 'S') : line > 0 ? 'E' : 'W'}` };
      const lineCoord = { coord: { lat: line, lon: line }, axis };
      return {
        id: '', type: 'relative-line', topic: 2, difficulty,
        prompt: { key: `q.relative.prompt.${axis}`, params: { point: { coord: p }, line: lineCoord } },
        input: { kind: 'choice', options: options.map((o): Text => ({ key: `q.opt.${o}` })) },
        answer: { kind: 'choice', index },
        explanation: { key: `q.relative.explain.${axis}`, params: { value: { coord: p, axis }, line: lineCoord, dir: { text: { key: `q.dirWord.${letter}` } }, rule: { text: rule } } },
        scene: { views: ['flat'], point: null, layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis, value: line }, { kind: 'marker', p, tone: 'a', label: 'A' }] },
        solution: [],
      };
    }
  },
  check: checkChoice,
  describeAnswer: choiceText,
};
