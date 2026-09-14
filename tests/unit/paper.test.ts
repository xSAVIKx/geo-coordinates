import { describe, expect, test } from 'vitest';
import { renderText } from '../../src/i18n/text';
import { needsMap, paperPrompt, paperScene } from '../../src/quiz/paper';
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
    for (const q of qs.filter((x) => ['read-coords', 'place-point', 'which-place', 'further', 'relative-line', 'name-line'].includes(x.type))) expect(needsMap(q), q.type).toBe(true);
    const distance = MODULES.find((m) => m.type === 'distance')!;
    const reverse = DIFFS.flatMap((d) => Array.from({ length: 40 }, (_, s) => distance.generate(createRng(`rev:${d}:${s}`), d, 7))).filter((q) => q.meta?.mode === 'reverse');
    expect(reverse.length).toBeGreaterThan(0);
    for (const q of reverse) expect(needsMap(q)).toBe(false);
  });
});
