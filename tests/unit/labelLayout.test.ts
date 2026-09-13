import { expect, test } from 'vitest';
import { createLabelMemory, overlaps, pointBox, selectLabelPlacements, rotateBoxAround, selectStableLabels, selectVisibleLabels, textBox } from '../../src/map/labelLayout';

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

test('rotateBoxAround: a 90°-rotated box swaps width and height around the pivot', () => {
  // A wide, short box (width 20, height 4) anchored with its top-left corner at the pivot.
  const box = textBox(0, 0, 20, 4, 'start'); // left=0, right=20, top=-3.2, bottom=1
  const rotated = rotateBoxAround(box, 0, 0, -90);
  // Rotating -90° about the origin: what was horizontal extent becomes vertical extent and vice
  // versa, so the rotated box is tall and narrow instead of wide and short.
  expect(rotated.right - rotated.left).toBeCloseTo(box.bottom - box.top, 6);
  expect(rotated.bottom - rotated.top).toBeCloseTo(box.right - box.left, 6);
});

test('rotateBoxAround: an unrotated (0°) box is unchanged', () => {
  const box = textBox(10, 20, 30, 12, 'middle');
  expect(rotateBoxAround(box, 10, 20, 0)).toEqual(box);
});

test('selectStableLabels: hysteresis keeps a previously visible label through small centre-distance jitter', () => {
  // Two overlapping candidates, neither featured; simulate a sequence of small centre shifts
  // (jittering the two distances a little each step) after 'a' first wins the tie.
  const boxAt = (x: number) => textBox(x, 0, 20, 10);
  const items = [{ id: 'a', x: 0 }, { id: 'b', x: 10 }] as const;
  let visible = new Set<string>();
  const distanceSteps: Array<Record<'a' | 'b', number>> = [
    { a: 5, b: 4.9 }, { a: 5.2, b: 4.8 }, { a: 4.8, b: 5.1 }, { a: 5.1, b: 4.85 }, { a: 4.95, b: 5.05 },
  ];
  for (const d of distanceSteps) {
    const result = selectStableLabels(
      items,
      (i) => boxAt(i.x),
      () => false,
      (i) => d[i.id],
      (i) => visible.has(i.id),
    );
    const shown = items.filter((_, idx) => result[idx]).map((i) => i.id);
    expect(shown).toEqual(['a']); // never toggles to 'b', even though raw distance jitters around a tie
    visible = new Set(shown);
  }
});

test('selectStableLabels: a newly-relevant featured label still wins over a previously visible one', () => {
  const boxAt = (x: number) => textBox(x, 0, 20, 10);
  const items = [{ id: 'a', x: 0, featured: false }, { id: 'b', x: 10, featured: true }];
  const wasVisible = (i: (typeof items)[number]) => i.id === 'a';
  const result = selectStableLabels(items, (i) => boxAt(i.x), (i) => i.featured, () => 0, wasVisible);
  expect(result).toEqual([false, true]); // b (featured) beats a's hysteresis bonus
});

test('createLabelMemory: the hysteresis bonus survives view changes but not a new scene', () => {
  const boxAt = (x: number) => textBox(x, 0, 20, 10);
  const items = [{ id: 'a', x: 0 }, { id: 'b', x: 10 }] as const;
  const memory = createLabelMemory();
  const run = (scene: number, d: Record<'a' | 'b', number>) => {
    const previous = memory.previous(scene);
    const result = selectStableLabels(items, (i) => boxAt(i.x), () => false, (i) => d[i.id], (i) => previous.has(i.id));
    const shown = new Set(items.filter((_, idx) => result[idx]).map((i) => i.id));
    memory.remember(shown);
    return [...shown];
  };
  expect(run(1, { a: 1, b: 50 })).toEqual(['a']);
  // Same scene, 'b' now clearly closer: 'a' keeps its label thanks to the bonus.
  expect(run(1, { a: 50, b: 1 })).toEqual(['a']);
  // A new scene (applyScene bumped sceneVersion): no bonus carried over, the closer 'b' wins.
  expect(run(2, { a: 50, b: 1 })).toEqual(['b']);
});

test('selectLabelPlacements: a name moves to its second box when the first is taken, or hides', () => {
  const right = textBox(10, 0, 20, 10), left = textBox(-10, 0, 20, 10, 'end');
  const items = [{ id: 'a' }];
  expect(selectLabelPlacements(items, () => [right, left], () => 0)).toEqual([0]);
  expect(selectLabelPlacements(items, () => [right, left], () => 0, [pointBox(15, -3, 1)])).toEqual([1]);
  expect(selectLabelPlacements(items, () => [right, left], () => 0, [pointBox(15, -3, 1), pointBox(-15, -3, 1)])).toEqual([-1]);
});

test('pointBox covers the point ring (9 px radius plus halo) at any scale', () => {
  const b = pointBox(100, 50, 2);
  expect(b.left).toBeLessThanOrEqual(100 - 9 * 2); expect(b.right).toBeGreaterThanOrEqual(100 + 9 * 2);
  expect(b.top).toBeLessThanOrEqual(50 - 9 * 2); expect(b.bottom).toBeGreaterThanOrEqual(50 + 9 * 2);
});
