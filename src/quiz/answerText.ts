import { formatClock } from '../geo/time';
import type { Text } from '../i18n/text';
import type { Answer, Question } from './types';

export function numberText(value: number, unit: 'deg' | 'km' | 'h' | 'min'): Text {
  return { key: `q.answer.${unit}`, params: { n: value } };
}

export function responseText(q: Question, a: Answer): Text {
  switch (a.kind) {
    case 'choice': return q.input.kind === 'choice' ? (q.input.options[a.index] ?? { key: 'q.answer.none' }) : { key: 'q.answer.none' };
    case 'coords': return { key: 'q.answer.coords', params: { coords: { coord: a.value, axis: q.input.kind === 'coords' ? q.input.fields : 'both', precision: q.input.kind === 'coords' ? q.input.precision : 'degree' } } };
    case 'number': return numberText(a.value, q.input.kind === 'number' ? q.input.unit : 'deg');
    case 'clock': return { key: 'q.answer.clock', params: { time: formatClock(a.minutes) } };
  }
}
