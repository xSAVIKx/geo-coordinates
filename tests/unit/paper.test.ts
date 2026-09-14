import { describe, expect, test } from 'vitest';
import { renderText } from '../../src/i18n/text';
import { makeFlatCtx } from '../../src/map/geometry';
import { MapState } from '../../src/map/mapState.svelte';
import { PAPER_INSET, PAPER_PX, markersCrowded, needsMap, paperPrompt, paperScene, paperView } from '../../src/quiz/paper';
import { MODULES, generateSet } from '../../src/quiz/registry';
import { createRng } from '../../src/quiz/rng';
import type { Difficulty } from '../../src/quiz/types';
import { missingKeys } from './textKeys';

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];

describe('questions on paper', () => {
  test('the same code, topics, level and count make the same worksheet', () => {
    const a = generateSet('sheet:ab12', [1, 3, 6, 8], 'medium', 10).map((q) => renderText(paperPrompt(q), 'en'));
    const b = generateSet('sheet:ab12', [1, 3, 6, 8], 'medium', 10).map((q) => renderText(paperPrompt(q), 'en'));
    const c = generateSet('sheet:ab13', [1, 3, 6, 8], 'medium', 10).map((q) => renderText(paperPrompt(q), 'en'));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  for (const mod of MODULES) {
    test(`${mod.type}: a still flat grid scene with nothing to reveal the answer`, () => {
      const missing = new Set<string>();
      for (const topic of mod.topics) for (const d of DIFFS) for (let s = 0; s < 60; s++) {
        const q = mod.generate(createRng(`paper:${mod.type}:${topic}:${d}:${s}`), d, topic);
        const scene = paperScene(q);
        expect(scene.views).toEqual(['flat']);
        expect(scene.flatProjection).toBe('grid');
        expect(scene.pointEditable).toBe(false);
        expect(scene.sun).toBeNull();
        expect(scene.layers?.daylight).toBe(false);
        expect(scene.overlays?.some((o) => o.kind === 'noon-meridian')).toBe(false);
        // The solution is never on the printed map.
        expect(scene.overlays?.some((o) => o.kind === 'marker' && o.tone === 'answer')).toBe(false);
        if (q.type === 'place-point') {
          expect(scene.point).toBeNull();
          expect(needsMap(q)).toBe(true);
          expect(paperPrompt(q).key).toBe('worksheet.markPoint');
        }
        if (q.type === 'read-coords') expect(scene.point).toEqual(q.scene.point);
        for (const k of missingKeys([paperPrompt(q)])) missing.add(k);
      }
      expect([...missing]).toEqual([]);
    });
  }

  test('a map only where the question needs one', () => {
    const qs = MODULES.flatMap((m) => m.topics.flatMap((topic) => DIFFS.map((d) => m.generate(createRng(`needs:${m.type}:${topic}:${d}`), d, topic))));
    for (const q of qs.filter((x) => ['read-coords', 'place-point', 'which-place', 'further', 'relative-line', 'name-line'].includes(x.type) && !markersCrowded(paperScene(x)))) expect(needsMap(q), q.type).toBe(true);
    const distance = MODULES.find((m) => m.type === 'distance')!;
    const reverse = DIFFS.flatMap((d) => Array.from({ length: 40 }, (_, s) => distance.generate(createRng(`rev:${d}:${s}`), d, 7))).filter((q) => q.meta?.mode === 'reverse');
    expect(reverse.length).toBeGreaterThan(0);
    for (const q of reverse) expect(needsMap(q)).toBe(false);
  });

  test('a highlighted 180° meridian prints strictly inside the frame, clear of its edge', () => {
    const nameLine = MODULES.find((m) => m.type === 'name-line')!;
    const qs = Array.from({ length: 400 }, (_, s) => nameLine.generate(createRng(`am:${s}`), 'hard', 1))
      .filter((q) => q.scene.overlays?.some((o) => o.kind === 'highlight-line' && o.axis === 'lon' && Math.abs(o.value) === 180));
    expect(qs.length).toBeGreaterThan(0);
    // The highlight is 5 CSS px wide with a 9 px casing: half of that must fit between the line and the frame.
    const halfCasing = 4.5 * PAPER_PX;
    for (const q of qs) {
      expect(needsMap(q)).toBe(true);
      const state = new MapState();
      state.applyScene(paperScene(q));
      const ctx = makeFlatCtx(960, 480, state.flat.center, state.flat.zoom, PAPER_PX, 'grid');
      // The same view as the paper helpers compute without MapState.
      expect(paperView(paperScene(q)).center).toEqual(ctx.center);
      for (const lat of [-80, 0, 80]) {
        const [x, y] = ctx.project({ lat, lon: 180 })!;
        expect(x).toBeGreaterThan(-PAPER_INSET + halfCasing);
        expect(x).toBeLessThan(960 + PAPER_INSET - halfCasing);
        expect(y).toBeGreaterThan(-PAPER_INSET);
        expect(y).toBeLessThan(480 + PAPER_INSET);
      }
    }
  });

  test('markers that would print on top of each other leave a text-answerable question without its map', () => {
    const further = MODULES.find((m) => m.type === 'further')!;
    const qs = DIFFS.flatMap((d) => ([2, 5] as const).flatMap((topic) => Array.from({ length: 80 }, (_, s) => further.generate(createRng(`crowd:${d}:${topic}:${s}`), d, topic))));
    const crowded = qs.filter((q) => markersCrowded(paperScene(q)));
    expect(crowded.length).toBeGreaterThan(0);
    for (const q of crowded) expect(needsMap(q)).toBe(false);
    for (const q of qs.filter((x) => !markersCrowded(paperScene(x)))) expect(needsMap(q)).toBe(true);
    // Measured on the paper projection: every printed map keeps its markers at least 12 CSS px apart.
    const all = MODULES.flatMap((m) => m.topics.flatMap((topic) => DIFFS.flatMap((d) => Array.from({ length: 30 }, (_, s) => m.generate(createRng(`gap:${m.type}:${topic}:${d}:${s}`), d, topic)))));
    for (const q of all.filter((x) => needsMap(x) && x.type !== 'which-place' && x.type !== 'name-line')) {
      expect(markersCrowded(paperScene(q)), `${q.type}`).toBe(false);
    }
  });
});
