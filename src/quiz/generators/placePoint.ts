import { checkCoords } from '../check';
import type { Question, QuestionModule } from '../types';
import { coordTask } from './coordValues';

export const placePoint: QuestionModule = {
  type: 'place-point',
  topics: [4, 5],
  generate(rng, difficulty, topic): Question {
    const minutes = topic === 5;
    const { p, precision, graticuleStep, flatView } = coordTask(rng, difficulty, minutes);
    const start = minutes ? { lat: Math.round(p.lat) + 1, lon: Math.round(p.lon) - 1 } : { lat: 0, lon: 0 };
    return {
      id: '', type: 'place-point', topic, difficulty,
      prompt: { key: 'q.place.prompt', params: { coords: { coord: p, precision } } },
      input: { kind: 'coords', precision, fields: 'both', mapPick: true },
      answer: { kind: 'coords', value: p },
      explanation: { key: 'q.place.explain', params: { lat: { coord: p, axis: 'lat', precision }, lon: { coord: p, axis: 'lon', precision } } },
      scene: {
        views: minutes ? ['flat'] : ['globe', 'flat'], point: start, pointEditable: true, showReadout: true, precision,
        flatView: minutes ? flatView : undefined,
        layers: { graticuleStep: minutes ? 1 : graticuleStep === 1 ? 5 : graticuleStep, specialLines: true, places: false },
      },
      solution: [{ kind: 'marker', p, tone: 'answer' }],
    };
  },
  check: checkCoords,
  describeAnswer: (q) => ({ key: 'q.answer.coords', params: { coords: { coord: (q.answer as { value: { lat: number; lon: number } }).value, precision: q.input.kind === 'coords' ? q.input.precision : 'degree' } } }),
};
