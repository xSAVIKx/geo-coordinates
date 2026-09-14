import { describe, expect, test } from 'vitest';
import { formatLat } from '../../src/geo/format';
import type { LangCode } from '../../src/geo/types';
import { edgeTicks } from '../../src/map/edgeTicks';
import { clampFlatCenter, makeFlatCtx } from '../../src/map/geometry';
import { latEdgeBoxes } from '../../src/map/overlayLayout';
import { EASY_MAX_LON, MEDIUM_MAX_LON } from '../../src/quiz/generators/coordValues';
import { MODULES } from '../../src/quiz/registry';
import { createRng } from '../../src/quiz/rng';

const SEEDS = 1000;
const LANGS: LangCode[] = ['en', 'pl', 'uk'];
const POINT_RING_PX = 9 + 2; // PointMarker's ring and its halo

describe('easy and medium read-coords points stay clear of the latitude numbers down the map side', () => {
  const mod = MODULES.find((m) => m.type === 'read-coords')!;
  for (const d of ['easy', 'medium'] as const) {
    test(`${d}: ${SEEDS} seeds, on a 350 px phone map and an 800 px desktop map, in EN/PL/UK`, () => {
      const bad: string[] = [];
      for (let s = 0; s < SEEDS; s++) {
        const q = mod.generate(createRng(`edge:${d}:${s}`), d, 3);
        const p = q.scene.point!;
        expect(p.lon, `seed ${s}`).toBeLessThanOrEqual(d === 'easy' ? EASY_MAX_LON.east : MEDIUM_MAX_LON);
        expect(p.lon, `seed ${s}`).toBeGreaterThanOrEqual(d === 'easy' ? -EASY_MAX_LON.west : -MEDIUM_MAX_LON);
        const v = q.scene.flatView ?? { center: { lat: 0, lon: 0 }, zoom: 1 };
        for (const width of [350, 800]) {
          const px = 960 / width;
          const center = clampFlatCenter(v.center, v.zoom, 'grid');
          const ctx = makeFlatCtx(960, 480, center, v.zoom, px, 'grid');
          const ticks = edgeTicks(ctx, center, v.zoom, q.scene.layers?.graticuleStep as number);
          const [x, y] = ctx.project(p)!;
          const r = POINT_RING_PX * px;
          for (const lang of LANGS) {
            const boxes = latEdgeBoxes(ctx, ticks.lats.map((l) => ({ y: l.y, text: formatLat(l.value, lang, 'degree') })));
            if (boxes.some((b) => x + r > b.left && x - r < b.right && y + r > b.top && y - r < b.bottom)) bad.push(`seed ${s} ${width}px ${lang}: ${p.lat}, ${p.lon}`);
          }
        }
      }
      expect(bad).toEqual([]);
    });
  }
});
