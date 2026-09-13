import { expect, test } from 'vitest';
import { overlaps, selectVisibleLabels, textBox } from '../../src/map/labelLayout';

test('overlaps', () => {
  expect(overlaps({ left: 0, right: 10, top: 0, bottom: 10 }, { left: 5, right: 15, top: 5, bottom: 15 })).toBe(true);
  expect(overlaps({ left: 0, right: 10, top: 0, bottom: 10 }, { left: 10, right: 20, top: 0, bottom: 10 })).toBe(false);
  expect(overlaps({ left: 0, right: 10, top: 0, bottom: 10 }, { left: 20, right: 30, top: 20, bottom: 30 })).toBe(false);
});

test('textBox anchors', () => {
  expect(textBox(100, 50, 40, 10, 'start')).toEqual({ left: 100, right: 140, top: 42, bottom: 52.5 });
  expect(textBox(100, 50, 40, 10, 'middle')).toEqual({ left: 80, right: 120, top: 42, bottom: 52.5 });
  expect(textBox(100, 50, 40, 10, 'end')).toEqual({ left: 60, right: 100, top: 42, bottom: 52.5 });
});

test('selectVisibleLabels: no overlap keeps everyone', () => {
  const boxes = [textBox(0, 0, 10, 10), textBox(100, 0, 10, 10)];
  const visible = selectVisibleLabels(boxes, (b) => b, () => 0);
  expect(visible).toEqual([true, true]);
});

test('selectVisibleLabels: the higher-rank (lower priority) overlapping item is hidden', () => {
  const items = [
    { box: textBox(0, 0, 20, 10), rank: 0 },
    { box: textBox(5, 0, 20, 10), rank: 1 },
  ];
  const visible = selectVisibleLabels(items, (i) => i.box, (i) => i.rank);
  expect(visible).toEqual([true, false]);
});

test('selectVisibleLabels: placement order follows rank, not array order', () => {
  const items = [
    { box: textBox(5, 0, 20, 10), rank: 1 },
    { box: textBox(0, 0, 20, 10), rank: 0 },
  ];
  const visible = selectVisibleLabels(items, (i) => i.box, (i) => i.rank);
  // Lower rank (index 1) is placed first, so the overlapping higher-rank one (index 0) loses.
  expect(visible).toEqual([false, true]);
});

test('selectVisibleLabels: a fixed obstacle hides an otherwise free label', () => {
  const box = textBox(0, 0, 20, 10);
  const obstacle = textBox(5, 0, 20, 10);
  const visible = selectVisibleLabels([box], (b) => b, () => 0, [obstacle]);
  expect(visible).toEqual([false]);
});

test('selectVisibleLabels: non-overlapping candidates around an obstacle all stay visible', () => {
  const obstacle = textBox(100, 0, 20, 10);
  const boxes = [textBox(0, 0, 20, 10), textBox(200, 0, 20, 10)];
  const visible = selectVisibleLabels(boxes, (b) => b, () => 0, [obstacle]);
  expect(visible).toEqual([true, true]);
});
