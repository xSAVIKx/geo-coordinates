import { expect, test } from 'vitest';
import { EDGE_LEFT, labelWidth } from '../../src/map/brackets';
import { makeFlatCtx, makeGlobeCtx } from '../../src/map/geometry';
import { overlaps, placeLabelOptions, pointBox, textBox } from '../../src/map/labelLayout';
import { lineLabelSpecs } from '../../src/map/lineLabels';
import { MapState } from '../../src/map/mapState.svelte';
import { bracketBoxes, LINE_LABEL, markerLabelSize, markerLayout, noonLabel, NOON_LABEL, pathBox, placeLineLabels } from '../../src/map/overlayLayout';
import { tierVisible, tierZoom } from '../../src/map/places';
import type { Overlay } from '../../src/map/types';
import { topic6 } from '../../src/topics/t6-differences';
import { topic8 } from '../../src/topics/t8-time';
import { meanSunPoint } from '../../src/geo/sun';

const fmt = (v: number, unit: 'deg' | 'km') => (unit === 'km' ? `${v} km` : `${v}°`);
const text = (o: { label?: string; labelKey?: string }) => o.label ?? o.labelKey ?? '';
const lineCtx = (ctx: ReturnType<typeof makeFlatCtx>) => ({ kind: ctx.kind, width: ctx.width, height: ctx.height, px: ctx.px, project: (p: { lat: number; lon: number }) => ctx.project(p), rotateLambda: ctx.projection.rotate()[0] });

test('place names sit about 6 CSS px from their dot on every side', () => {
  for (const px of [1, 2.75]) {
    const size = 12 * px, w = 50 * px;
    const [right, left, above, below] = placeLabelOptions([500, 200], w, size, px);
    expect(right!.box.left - 500).toBeCloseTo(6 * px);
    expect(500 - left!.box.right).toBeCloseTo(6 * px);
    expect(200 - above!.box.bottom).toBeCloseTo(6 * px);
    expect(below!.box.top - 200).toBeCloseTo(6 * px);
    expect([right, left, above, below].map((o) => o!.side)).toEqual(['right', 'left', 'above', 'below']);
  }
});

test('a mark centred on the dot adds the four sides just past it; a mark beside the dot does not', () => {
  const px = 1;
  const ring = pointBox(500, 200, px); // the point placed on this very city
  const options = placeLabelOptions([500, 200], 50, 12, px, [ring]);
  expect(options).toHaveLength(8);
  const farRight = options[4]!;
  expect(farRight.side).toBe('right');
  expect(farRight.box.left).toBeCloseTo(ring.right + 3);
  expect(overlaps(farRight.box, ring)).toBe(false);
  // The point 9 px away (a neighbouring city): no far sides, so the name cannot drift past the point.
  expect(placeLabelOptions([509, 200], 50, 12, px, [ring])).toHaveLength(4);
});

test('tier zoom: a narrow map counts as zoomed out, down to half', () => {
  expect(tierZoom(9, 975)).toBe(9);
  expect(tierZoom(9, 640)).toBe(9);
  expect(tierZoom(9, 320)).toBe(4.5);
  expect(tierZoom(9, 100)).toBe(4.5);
  // A phone's Poland view keeps the region's cities but not the towns; a phone's Europe view no region dots.
  expect(tierVisible('region', tierZoom(9, 349))).toBe(true);
  expect(tierVisible('local', tierZoom(9, 349))).toBe(false);
  expect(tierVisible('region', tierZoom(3.5, 349))).toBe(false);
  expect(tierVisible('region', tierZoom(3.5, 975))).toBe(true);
});

test('pathBox reads absolute and relative line commands', () => {
  expect(pathBox('M10,20V60')).toEqual([{ left: 7, right: 13, top: 17, bottom: 63 }]);
  expect(pathBox('M10,20h9')).toEqual([{ left: 7, right: 22, top: 17, bottom: 23 }]);
  expect(pathBox('M0,0L5,5L-5,10Z')).toEqual([{ left: -8, right: 8, top: -3, bottom: 13 }]);
  expect(pathBox('')).toEqual([]);
});

test('marker labels are smaller on a phone-sized map', () => {
  expect(markerLabelSize({ width: 960, px: 1 })).toBe(15);
  expect(markerLabelSize({ width: 960, px: 960 / 349 })).toBe(13);
});

test('topic 6, step 2 on a Ukrainian phone: the equator name is inside the map and clear of the bracket; the prime meridian name never covers it', () => {
  const step = topic6.steps.find((s) => s.id === 'opposite-lat')!;
  const ms = new MapState();
  ms.applyScene(step.scene);
  const px = 960 / 349;
  const ctx = makeFlatCtx(960, 480, ms.flat.center, ms.flat.zoom, px, 'grid');
  const overlays = step.scene.overlays!;
  const markers = markerLayout(overlays, ctx, text);
  const avoid = [...bracketBoxes(overlays, ctx, fmt, markers.room), ...markers.labels];
  const names: Record<string, string> = { 'line.equator': 'Екватор 0°', 'line.prime': 'Нульовий меридіан 0° (Гринвіч)', 'line.antimeridian': 'Меридіан 180°' };
  const labels = placeLineLabels(lineLabelSpecs(ms.layers), lineCtx(ctx), (spec) => labelWidth(names[spec.labelKey]!, LINE_LABEL, px), avoid);
  const equator = labels.find((l) => l.spec.id === 'eq')!;
  expect(equator.box.left).toBeGreaterThanOrEqual(EDGE_LEFT * px - 0.5);
  expect(equator.box.right).toBeLessThanOrEqual(ctx.width);
  expect(avoid.some((a) => overlaps(equator.box, a))).toBe(false);
  const prime = labels.find((l) => l.spec.id === 'pm');
  if (prime) expect(avoid.some((a) => overlaps(prime.box, a))).toBe(false);
});

test('a vertical line name moves to the other side of its meridian when a bracket takes its usual side', () => {
  const ctx = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1, 'grid');
  const pm = lineLabelSpecs({ specialLines: true, tropics: false }).find((s) => s.id === 'pm');
  const x0 = ctx.project({ lat: 0, lon: 0 })![0];
  const free = placeLineLabels([pm!], lineCtx(ctx), () => 120, []);
  expect(free[0]!.x).toBeCloseTo(x0 + 15);
  const blocked = placeLineLabels([pm!], lineCtx(ctx), () => 120, [{ left: x0 + 2, right: x0 + 30, top: 0, bottom: 480 }]);
  expect(blocked[0]!.x).toBeCloseTo(x0 - 5);
  expect(placeLineLabels([pm!], lineCtx(ctx), () => 120, [{ left: x0 - 30, right: x0 + 30, top: 0, bottom: 480 }])).toEqual([]);
});

test('topic 8 far-away step on a phone: "Noon 12:00" is clear of the markers, their labels and the line names', () => {
  const step = topic8.steps.find((s) => s.id === 'far-away')!;
  const ms = new MapState();
  ms.applyScene(step.scene);
  for (const px of [1, 960 / 349]) {
    const ctx = makeFlatCtx(960, 480, ms.flat.center, ms.flat.zoom, px, 'grid');
    const overlays: Overlay[] = step.scene.overlays!;
    const markers = markerLayout(overlays, ctx, text);
    const lines = placeLineLabels(lineLabelSpecs(ms.layers), lineCtx(ctx), (spec) => labelWidth(spec.labelKey, LINE_LABEL, px), markers.labels).map((l) => l.box);
    const obstacles = [...markers.symbols, ...markers.labels, ...lines];
    const noon = noonLabel(ctx, meanSunPoint(ms.sunDate()!).lon, labelWidth('Noon 12:00', NOON_LABEL, px), obstacles)!;
    expect(noon, `px ${px}`).not.toBeNull();
    expect(obstacles.some((o) => overlaps(noon.box, o)), `px ${px}`).toBe(false);
    expect(noon.box.right).toBeLessThanOrEqual(ctx.width);
  }
});

test('noon label falls back to a spot in view when everything is taken', () => {
  const ctx = makeGlobeCtx(500, [0, -20], 1);
  const all = [textBox(-1e4, 1e4, 2e4, 2e4)];
  expect(noonLabel(ctx, 0, 90, all)).not.toBeNull();
});

test('line names never pile up: a horizontal name touching an earlier one is left out', () => {
  const ctx = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 960 / 120, 'grid'); // a 120 px wide world map
  const labels = placeLineLabels(lineLabelSpecs({ specialLines: true, tropics: true }), lineCtx(ctx), () => 100 * ctx.px);
  const flat = labels.filter((l) => !l.vertical);
  expect(flat[0]!.spec.id).toBe('eq');
  flat.forEach((a, i) => flat.forEach((b, j) => { if (i < j) expect(overlaps(a.box, b.box)).toBe(false); }));
  const roomy = placeLineLabels(lineLabelSpecs({ specialLines: true, tropics: true }), lineCtx(makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1, 'grid')), () => 100);
  expect(roomy.filter((l) => !l.vertical)).toHaveLength(5);
});
