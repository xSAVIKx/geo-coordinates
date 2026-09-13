import { checkCoords } from '../check';
import type { Question, QuestionModule } from '../types';
import { coordTask } from './coordValues';

export const readCoords: QuestionModule = {
  type: 'read-coords',
  topics: [3, 5],
  generate(rng, difficulty, topic): Question {
    const { p, precision, graticuleStep, flatView } = coordTask(rng, difficulty, topic === 5);
    return {
      id: '', type: 'read-coords', topic, difficulty,
      prompt: { key: 'q.read.prompt' },
      input: { kind: 'coords', precision, fields: 'both', mapPick: false },
      answer: { kind: 'coords', value: p },
      explanation: { key: 'q.read.explain', params: { lat: { coord: p, axis: 'lat', precision }, lon: { coord: p, axis: 'lon', precision }, coords: { coord: p, precision } } },
      scene: { views: ['flat'], point: p, pointEditable: false, showReadout: false, precision, flatView, layers: { graticuleStep, specialLines: true, places: false, pointGuides: difficulty !== 'hard' } },
      solution: [{ kind: 'highlight-line', axis: 'lat', value: p.lat }, { kind: 'highlight-line', axis: 'lon', value: p.lon }, { kind: 'marker', p, tone: 'answer' }],
    };
  },
  check: checkCoords,
  describeAnswer: (q) => ({ key: 'q.answer.coords', params: { coords: { coord: (q.answer as { value: { lat: number; lon: number } }).value, precision: q.input.kind === 'coords' ? q.input.precision : 'degree' } } }),
};
