import { expect, test } from 'vitest';
import { renderText } from '../../src/i18n/text';
import { numberText, responseText } from '../../src/quiz/answerText';
import type { Question } from '../../src/quiz/types';

const q = (input: Question['input']): Question => ({ id: 'x', type: 'difference', topic: 6, difficulty: 'easy', prompt: { key: 'q.read.prompt' }, input, answer: { kind: 'number', value: 1 }, explanation: { key: 'q.read.prompt' }, scene: { views: ['flat'] }, solution: [] });

test('numbers use locale separators and units', () => {
  expect(renderText(numberText(333.6, 'km'), 'pl')).toBe('333,6 km');
  expect(renderText(numberText(25, 'deg'), 'en')).toBe('25°');
  expect(renderText(numberText(2224, 'km'), 'uk')).toBe('2224 км');
  expect(renderText(numberText(2, 'h'), 'pl')).toBe('2 godz.');
  expect(renderText(numberText(8, 'min'), 'uk')).toBe('8 хв');
});

test('responses render per input kind', () => {
  expect(renderText(responseText(q({ kind: 'coords', precision: 'degree', fields: 'both', mapPick: false }), { kind: 'coords', value: { lat: -10, lon: 20 } }), 'en')).toBe('10°S, 20°E');
  expect(renderText(responseText(q({ kind: 'coords', precision: 'minute', fields: 'lat', mapPick: false }), { kind: 'coords', value: { lat: 52.25, lon: 20 } }), 'uk')).toBe('52°15′\u00a0пн.\u00a0ш.');
  expect(renderText(responseText(q({ kind: 'choice', options: [{ key: 'q.opt.north' }, { key: 'q.opt.south' }] }), { kind: 'choice', index: 1 }), 'en')).toBe('South of it');
  expect(renderText(responseText(q({ kind: 'choice', options: [{ key: 'q.opt.north' }] }), { kind: 'choice', index: 5 }), 'en')).toBe('—');
  expect(renderText(responseText(q({ kind: 'number', unit: 'km' }), { kind: 'number', value: 1112 }), 'en')).toBe('1112 km');
  expect(renderText(responseText(q({ kind: 'clock' }), { kind: 'clock', minutes: 13 * 60 + 5 }), 'en')).toBe('13:05');
});
