import { expect, test } from 'vitest';
import { labelPlaces, localizeLabel } from '../../src/map/markerLabel';

test('coordinate labels follow the language notation', () => {
  expect(localizeLabel('52°45′N', 'uk')).toBe('52°45′ пн. ш.');
  expect(localizeLabel('34°S, 151°E', 'uk')).toBe('34° пд. ш., 151° сх. д.');
  expect(localizeLabel('158°W', 'uk')).toBe('158° зх. д.');
  expect(localizeLabel('21°01′E', 'pl')).toBe('21°01′E');
  expect(localizeLabel('52°N, 21°E', 'en')).toBe('52°N, 21°E');
  expect(localizeLabel('0°', 'uk')).toBe('0°');
});

test('other labels are left alone', () => {
  expect(localizeLabel('A', 'uk')).toBe('A');
  expect(localizeLabel('Warsaw', 'uk')).toBe('Warsaw');
  expect(localizeLabel('', 'uk')).toBe('');
});

test('a label that would cover an earlier label or a marker moves to the next free spot', () => {
  const w = 100;
  // Second marker 5 px lower and 40 px right: its label would overlap the first label, so it goes below.
  expect(labelPlaces([{ x: 0, y: 100, width: w }, { x: 40, y: 105, width: w }], 15, 1)).toEqual(['up-right', 'down-right']);
  // Below would cover a third marker just under it and up-left still covers the first label: it goes below-left.
  expect(labelPlaces([{ x: 200, y: 100, width: w }, { x: 240, y: 105, width: w }, { x: 260, y: 125, width: 0 }], 15, 1)[1]).toBe('down-left');
  // Far apart: both stay up-right.
  expect(labelPlaces([{ x: 0, y: 100, width: w }, { x: 300, y: 105, width: w }], 15, 1)).toEqual(['up-right', 'up-right']);
  expect(labelPlaces([null, { x: 0, y: 100, width: w }], 15, 1)).toEqual(['up-right', 'up-right']);
  // Near the right side of the view the label goes left.
  expect(labelPlaces([{ x: 900, y: 100, width: w }], 15, 1, 960)).toEqual(['up-left']);
});
