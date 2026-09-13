import { describe, expect, test } from 'vitest';
import type { LatLon } from '../../src/geo/types';
import { bracketModel, EDGE_BOTTOM, labelWidth, lonSegments, type BracketLabel, type BracketModel, type BracketOverlay } from '../../src/map/brackets';
import { makeFlatCtx, makeGlobeCtx, type ViewCtx } from '../../src/map/geometry';
import { MapState } from '../../src/map/mapState.svelte';
import type { FlatProjection, Overlay, SceneSpec } from '../../src/map/types';
import { labelBox, labelPlaces } from '../../src/map/markerLabel';
import { MODULES } from '../../src/quiz/registry';
import { MAX_FIT_ZOOM } from '../../src/quiz/values';
import { createRng } from '../../src/quiz/rng';
import { TOPICS } from '../../src/topics';

const fmt = (v: number, unit: 'deg' | 'km') => (unit === 'km' ? `${v} km` : `${v}°`);
const PXS = [1, 2.56]; // desktop (≈960 CSS px wide map) and phone (375 px)
const PROJECTIONS: FlatProjection[] = ['grid', 'equal-earth'];
const isBracket = (o: Overlay): o is BracketOverlay => o.kind === 'lat-diff' || o.kind === 'lon-diff' || o.kind === 'distance';

function flatCtx(scene: SceneSpec, px: number, projection: FlatProjection): ViewCtx {
  const ms = new MapState();
  ms.applyScene(scene);
  return makeFlatCtx(960, 480, ms.flat.center, ms.flat.zoom, px, scene.flatProjection ?? projection);
}

function box(l: BracketLabel, px: number) {
  const w = labelWidth(l.text, l.size, px);
  const left = l.anchor === 'start' ? l.x : l.anchor === 'middle' ? l.x - w / 2 : l.x - w;
  return { left, right: left + w, top: l.y - l.size * px * 0.8, bottom: l.y + l.size * px * 0.2 };
}
const overlaps = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

function expectReadable(m: BracketModel | null, ctx: ViewCtx, markers: LatLon[], where: string) {
  expect(m, where).not.toBeNull();
  const px = ctx.px;
  const boxes = m!.labels.map((l) => box(l, px));
  for (const [i, b] of boxes.entries()) {
    expect(b.left, `${where} label ${m!.labels[i]!.text} left`).toBeGreaterThanOrEqual(-0.5);
    expect(b.right, `${where} label ${m!.labels[i]!.text} right`).toBeLessThanOrEqual(ctx.width + 0.5);
    expect(b.top, `${where} label ${m!.labels[i]!.text} top`).toBeGreaterThanOrEqual(-0.5);
    expect(b.bottom, `${where} label ${m!.labels[i]!.text} bottom`).toBeLessThanOrEqual(ctx.height - (EDGE_BOTTOM - 6) * px);
    boxes.forEach((o, j) => { if (j > i) expect(overlaps(b, o), `${where} labels ${m!.labels[i]!.text} / ${m!.labels[j]!.text} overlap`).toBe(false); });
    for (const p of markers) {
      const xy = ctx.project(p)!;
      const r = 8 * px;
      expect(overlaps(b, { left: xy[0] - r, right: xy[0] + r, top: xy[1] - r, bottom: xy[1] + r }), `${where} label ${m!.labels[i]!.text} covers marker ${JSON.stringify(p)}`).toBe(false);
    }
  }
}

describe('bracket values', () => {
  const world = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1);
  const texts = (m: BracketModel | null, role: BracketLabel['role']) => m!.labels.filter((l) => l.role === role).map((l) => l.text);

  test('latitude across the equator: both parts, the total and a split on the equator', () => {
    const m = bracketModel({ kind: 'lat-diff', a: { lat: 30, lon: 31 }, b: { lat: -34, lon: 18 } }, world, fmt);
    expect(texts(m, 'part')).toEqual(['30°', '34°']);
    expect(texts(m, 'total')).toEqual(['64°']);
    expect(m!.splits).toHaveLength(1);
    expect(m!.splits[0]![1]).toBeCloseTo(world.project({ lat: 0, lon: 0 })![1]);
  });

  test('latitude on one side: only the total', () => {
    const m = bracketModel({ kind: 'lat-diff', a: { lat: 52, lon: 21 }, b: { lat: 30, lon: 31 } }, world, fmt);
    expect(texts(m, 'part')).toEqual([]);
    expect(texts(m, 'total')).toEqual(['22°']);
    expect(m!.splits).toEqual([]);
  });

  test('longitude across Greenwich splits at 0°; across 180° shows the two pieces up to 180°', () => {
    const g = bracketModel({ kind: 'lon-diff', a: { lat: 41, lon: -74 }, b: { lat: 52, lon: 21 } }, world, fmt);
    expect(texts(g, 'part')).toEqual(['74°', '21°']);
    expect(texts(g, 'total')).toEqual(['95°']);
    expect(g!.splits[0]![0]).toBeCloseTo(world.project({ lat: 0, lon: 0 })![0]);
    const t = bracketModel({ kind: 'lon-diff', a: { lat: 36, lon: 140 }, b: { lat: 21, lon: -158 } }, world, fmt);
    expect(texts(t, 'part')).toEqual(['40°', '22°']);
    expect(texts(t, 'total')).toEqual(['62°']);
    expect(lonSegments(140, -158)).toEqual([[140, 180], [-180, -158]]);
  });

  test('distance shows kilometres with the degrees below', () => {
    const m = bracketModel({ kind: 'distance', a: { lat: 10, lon: 20 }, b: { lat: -20, lon: 20 } }, world, fmt);
    expect(texts(m, 'total')).toEqual(['3336 km']);
    expect(texts(m, 'sub')).toEqual(['30°']);
    expect(texts(m, 'part')).toEqual(['10°', '20°']);
  });

  test('the globe draws the 180° crossing with its split and labels on the visible side', () => {
    const globe = makeGlobeCtx(500, [-171, -25], 1);
    const m = bracketModel({ kind: 'lon-diff', a: { lat: 36, lon: 140 }, b: { lat: 21, lon: -158 } }, globe, fmt)!;
    expect(m.paths.length).toBeGreaterThan(0);
    expect(m.splits).toHaveLength(1);
    expect(texts(m, 'total')).toEqual(['62°']);
    expect(texts(m, 'part')).toEqual(['40°', '22°']);
  });
});

describe('bracket labels stay on the map and off each other and the markers', () => {
  test('topic steps', () => {
    for (const topic of Object.values(TOPICS)) for (const step of topic!.steps) {
      const overlays = step.scene.overlays ?? [];
      const markers = overlays.filter((o) => o.kind === 'marker').map((o) => (o as { p: LatLon }).p);
      for (const o of overlays.filter(isBracket)) for (const px of PXS) for (const projection of PROJECTIONS) {
        if (!step.scene.views.includes('flat')) continue;
        const ctx = flatCtx(step.scene, px, projection);
        for (const p of markers) {
          const [x, y] = ctx.project(p)!;
          expect(x >= 0 && x <= ctx.width && y - 26 * px >= 0 && y <= ctx.height - EDGE_BOTTOM * px, `topic ${topic!.id} ${step.id} px ${px} ${projection} marker ${JSON.stringify(p)} with its label`).toBe(true);
        }
        expectReadable(bracketModel(o, ctx, fmt), ctx, markers, `topic ${topic!.id} ${step.id} px ${px} ${projection}`);
      }
    }
  });

  test('generated difference and distance questions', () => {
    for (const type of ['difference', 'distance']) {
      const mod = MODULES.find((m) => m.type === type)!;
      for (const d of ['easy', 'medium', 'hard'] as const) for (let s = 0; s < 400; s++) {
        const q = mod.generate(createRng(`brackets:${type}:${d}:${s}`), d, mod.topics[0]!);
        const all = [...(q.scene.overlays ?? []), ...q.solution];
        const markers = all.filter((o) => o.kind === 'marker').map((o) => (o as { p: LatLon }).p);
        expect(q.scene.flatProjection, 'fitted views are worked out for the grid map').toBe('grid');
        for (const px of PXS) {
          const ctx = flatCtx(q.scene, px, 'equal-earth');
          // Every marker is on the map, above the row of longitude numbers.
          for (const p of markers) {
            const [x, y] = ctx.project(p)!;
            expect(x >= 0 && x <= ctx.width && y >= 0 && y <= ctx.height - EDGE_BOTTOM * px, `${type} ${d} seed ${s} marker ${JSON.stringify(p)}`).toBe(true);
          }
          for (const o of all.filter(isBracket)) expectReadable(bracketModel(o, ctx, fmt), ctx, markers, `${type} ${d} seed ${s} px ${px}`);
        }
      }
    }
  });
});

describe('A and B on a phone', () => {
  test('marker centres are at least 24 CSS px apart when the zoom allows it, and labels keep the north–south order', () => {
    const px = 2.56;
    for (const type of ['difference', 'distance']) {
      const mod = MODULES.find((m) => m.type === type)!;
      for (const d of ['easy', 'medium', 'hard'] as const) for (let s = 0; s < 1000; s++) {
        const q = mod.generate(createRng(`phone-ab:${type}:${d}:${s}`), d, mod.topics[0]!);
        if (q.scene.views[0] === 'globe') continue;
        const markers = [...(q.scene.overlays ?? []), ...q.solution].filter((o) => o.kind === 'marker') as { p: LatLon; label?: string }[];
        expect(markers).toHaveLength(2);
        const ctx = flatCtx(q.scene, px, 'grid');
        const [a, b] = markers.map((m) => ctx.project(m.p)!);
        const gap = Math.hypot(a![0] - b![0], a![1] - b![1]);
        const best = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, MAX_FIT_ZOOM, px); // distances between projected points do not depend on the centre
        const [a12, b12] = markers.map((m) => best.project(m.p)!);
        const possible = Math.hypot(a12![0] - b12![0], a12![1] - b12![1]);
        expect(gap, `${type} ${d} seed ${s} ${JSON.stringify(markers.map((m) => m.p))}`).toBeGreaterThanOrEqual(Math.min(24 * px, possible) - 1e-6);
        const spots = markers.map((m, i) => ({ x: [a, b][i]![0], y: [a, b][i]![1], width: labelWidth(m.label!, 15, px) }));
        const places = labelPlaces(spots, 15, px, ctx.width);
        const boxes = spots.map((sp, i) => labelBox(sp, places[i]!, 15, px));
        const [north, south] = spots[0]!.y <= spots[1]!.y ? [0, 1] : [1, 0];
        if (spots[0]!.y !== spots[1]!.y && boxes[0]!.left < boxes[1]!.right && boxes[1]!.left < boxes[0]!.right) {
          expect(boxes[north]!.top, `${type} ${d} seed ${s} label order`).toBeLessThan(boxes[south]!.top);
        }
      }
    }
  });
});
