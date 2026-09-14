import { describe, expect, test } from 'vitest';
import type { LatLon } from '../../src/geo/types';
import { clampFlatCenter, makeFlatCtx, type ViewCtx } from '../../src/map/geometry';
import { PAPER_PX, needsMap, paperScene, paperView } from '../../src/quiz/paper';
import { MODULES } from '../../src/quiz/registry';
import { createRng } from '../../src/quiz/rng';
import type { Difficulty, Question } from '../../src/quiz/types';
import { MARKER_GAP_PX } from '../../src/quiz/values';

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
const SEEDS = 1000;
const PHONE_MAP_PX = 350;

const markers = (q: Question): LatLon[] => (q.scene.overlays ?? []).flatMap((o) => (o.kind === 'marker' ? [o.p] : []));

/** Smallest centre-to-centre distance (CSS px) of the points drawn in `ctx`, whose view units per CSS px are `px`; and whether all are in view. */
function measure(ctx: ViewCtx, px: number, points: LatLon[]): { gap: number; inView: boolean } {
  const xy = points.map((p) => ctx.project(p));
  const inView = xy.every((v) => v !== null && v[0] >= 0 && v[0] <= 960 && v[1] >= 0 && v[1] <= 480);
  let gap = Infinity;
  xy.forEach((a, i) => xy.forEach((b, j) => { if (a && b && j > i) gap = Math.min(gap, Math.hypot(a[0] - b[0], a[1] - b[1]) / px); }));
  return { gap, inView };
}

/** The flat view MapState.applyScene gives the scene on the grid map, drawn `widthPx` CSS px wide. */
function screenView(q: Question, widthPx: number): { ctx: ViewCtx; px: number } {
  const v = q.scene.flatView!;
  const px = 960 / widthPx;
  return { ctx: makeFlatCtx(960, 480, clampFlatCenter(v.center, v.zoom, 'grid'), v.zoom, px, 'grid'), px };
}

for (const type of ['which-place', 'further'] as const) {
  const mod = MODULES.find((m) => m.type === type)!;
  describe(`${type}: markers are drawn apart`, () => {
    for (const topic of mod.topics) for (const d of DIFFS) {
      test(`topic ${topic}, ${d}: ${SEEDS} seeds keep every two markers ≥ ${MARKER_GAP_PX} px apart on a ${PHONE_MAP_PX} px map and on paper`, () => {
        const bad: string[] = [];
        for (let s = 0; s < SEEDS; s++) {
          const q = mod.generate(createRng(`spacing:${type}:${topic}:${d}:${s}`), d, topic);
          // A fitted view worked out for the grid map, so the scene keeps to the grid map.
          expect(q.scene.flatView, `seed ${s}`).toBeDefined();
          expect(q.scene.flatProjection).toBe('grid');
          const points = markers(q);
          const screen = screenView(q, PHONE_MAP_PX);
          const onScreen = measure(screen.ctx, screen.px, points);
          if (onScreen.gap < MARKER_GAP_PX || !onScreen.inView) bad.push(`seed ${s} screen: ${onScreen.gap.toFixed(1)} px, in view ${onScreen.inView}`);
          // Paper draws the same view (paperView honours the scene's flatView) at PAPER_PX view units per CSS px.
          const paper = measure(paperView(paperScene(q)), PAPER_PX, points);
          if (paper.gap < MARKER_GAP_PX || !paper.inView) bad.push(`seed ${s} paper: ${paper.gap.toFixed(1)} px, in view ${paper.inView}`);
          expect(needsMap(q), `seed ${s}`).toBe(true);
        }
        expect(bad).toEqual([]);
      });
    }
  });
}
