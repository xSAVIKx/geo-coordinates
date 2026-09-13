import { describe, expect, test } from 'vitest';
import { extremeIndex, spansAntimeridian } from '../../src/geo/compare';
import { renderText } from '../../src/i18n/text';
import { coordMistake } from '../../src/quiz/check';
import { MODULES, generateSet } from '../../src/quiz/registry';
import { createRng } from '../../src/quiz/rng';
import type { Difficulty, Question } from '../../src/quiz/types';
import { missingKeys } from './textKeys';

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
const SEEDS = 1000;
const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' } as const;

function texts(q: Question, mod = MODULES.find((m) => m.type === q.type)!) {
  const list = [q.prompt, q.explanation, mod.describeAnswer(q)];
  if (q.input.kind === 'choice') list.push(...q.input.options);
  return list;
}

for (const mod of MODULES) {
  for (const topic of mod.topics) {
    describe(`${mod.type} (topic ${topic})`, () => {
      for (const d of DIFFS) {
        test(`${d}: ${SEEDS} seeds produce valid, answerable questions`, () => {
          const missing = new Set<string>();
          for (let s = 0; s < SEEDS; s++) {
            const q = mod.generate(createRng(`${mod.type}:${topic}:${d}:${s}`), d, topic);
            expect(q.type).toBe(mod.type);
            expect(mod.check(q, q.answer).correct, `seed ${s}`).toBe(true);
            missingKeys(texts(q, mod)).forEach((k) => missing.add(k));
            if (q.input.kind === 'choice' && q.answer.kind === 'choice') {
              expect(q.answer.index).toBeGreaterThanOrEqual(0);
              expect(q.answer.index).toBeLessThan(q.input.options.length);
              expect(new Set(q.input.options.map((o) => JSON.stringify(o))).size).toBe(q.input.options.length);
              q.input.options.forEach((_, j) => { if (j !== (q.answer as { index: number }).index) expect(mod.check(q, { kind: 'choice', index: j }).correct).toBe(false); });
            }
            if (q.answer.kind === 'coords') {
              const v = q.answer.value;
              expect(Math.abs(v.lat)).toBeLessThanOrEqual(90);
              expect(Math.abs(v.lon)).toBeLessThanOrEqual(180);
              const precision = q.input.kind === 'coords' ? q.input.precision : 'degree';
              const off = precision === 'minute' ? 2 / 60 : 1;
              expect(mod.check(q, { kind: 'coords', value: { lat: v.lat + (v.lat > 80 ? -off : off), lon: v.lon } }).correct).toBe(false);
              if (precision === 'minute') expect(mod.check(q, { kind: 'coords', value: { lat: v.lat + 1 / 60, lon: v.lon } }).correct).toBe(true);
            }
            for (const o of q.scene.overlays ?? []) if (o.kind === 'marker') { expect(Math.abs(o.p.lat)).toBeLessThanOrEqual(90); expect(Math.abs(o.p.lon)).toBeLessThanOrEqual(180); }
            if (q.type === 'further') {
              const markers = (q.scene.overlays ?? []).filter((o) => o.kind === 'marker') as { p: { lat: number; lon: number } }[];
              const dir = q.meta?.dir;
              const vals = markers.map((m) => (dir === 'N' || dir === 'S' ? m.p.lat : m.p.lon));
              expect(new Set(vals).size).toBe(vals.length);
              if (dir === 'E' || dir === 'W') expect(spansAntimeridian(vals)).toBe(false);
            }
            if (q.type === 'which-place') {
              const markers = (q.scene.overlays ?? []).filter((o) => o.kind === 'marker') as { p: { lat: number; lon: number } }[];
              expect(new Set(markers.map((m) => `${m.p.lat},${m.p.lon}`)).size).toBe(4);
              // A hint may only name a mistake that really turns the asked coordinates into the chosen marker.
              const asked = markers[(q.answer as { index: number }).index]!.p;
              markers.forEach((m, j) => {
                const hint = mod.check(q, { kind: 'choice', index: j }).mistake;
                if (hint) expect(hint.key, `seed ${s} marker ${j}`).toBe(coordMistake(asked, m.p, 'both', 'degree')?.key);
              });
            }
            if (q.type === 'further') {
              const markers = (q.scene.overlays ?? []).filter((o) => o.kind === 'marker') as { p: { lat: number; lon: number } }[];
              const opposite = extremeIndex(markers.map((m) => m.p), OPPOSITE[q.meta?.dir as 'N']);
              markers.forEach((_, j) => {
                const hint = mod.check(q, { kind: 'choice', index: j }).mistake;
                expect(hint !== undefined, `seed ${s} marker ${j}`).toBe(j === opposite && j !== (q.answer as { index: number }).index);
              });
            }
            if (q.type === 'relative-line' && d === 'easy') {
              const line = (q.scene.overlays ?? []).find((o) => o.kind === 'highlight-line') as { axis: 'lat' | 'lon'; value: number };
              const marker = (q.scene.overlays ?? []).find((o) => o.kind === 'marker') as { p: { lat: number; lon: number } };
              // Easy: one hemisphere, no boundary crossings (spec 5.2).
              expect(Math.sign(marker.p[line.axis]), `seed ${s}`).toBe(Math.sign(line.value));
            }
            if (q.type === 'further' && d === 'easy') {
              const markers = (q.scene.overlays ?? []).filter((o) => o.kind === 'marker') as { p: { lat: number; lon: number } }[];
              const axis = q.meta?.dir === 'N' || q.meta?.dir === 'S' ? 'lat' : 'lon';
              expect(new Set(markers.map((m) => Math.sign(m.p[axis]))).size, `seed ${s}`).toBe(1);
            }
            if (q.type === 'name-line' && q.input.kind === 'choice') {
              // Named parallels are parallels and 0°/180° are meridians: the generic option must not appear as a second true answer.
              const keys = q.input.options.map((o) => o.key);
              const answerKey = keys[(q.answer as { index: number }).index]!;
              const namedParallels = ['equator', 'tropicCancer', 'tropicCapricorn', 'arcticCircle', 'antarcticCircle'].map((k) => `q.opt.${k}`);
              const namedMeridians = ['prime', 'antimeridian'].map((k) => `q.opt.${k}`);
              if (namedParallels.includes(answerKey)) expect(keys).not.toContain('q.opt.parallel');
              if (namedMeridians.includes(answerKey)) expect(keys).not.toContain('q.opt.meridian');
            }
          }
          expect([...missing]).toEqual([]);
        });
      }
    });
  }
}

describe('rendered texts', () => {
  test('no doubled full stops or unfilled params in any language', () => {
    // UK coordinates end in "ш." / "д.", so a sentence must not end with a full stop right after a coordinate param ("ш.?" is fine).
    const bad: string[] = [];
    for (const mod of MODULES) for (const topic of mod.topics) for (const d of DIFFS) for (let s = 0; s < 100; s++) {
      const q = mod.generate(createRng(`render:${mod.type}:${topic}:${d}:${s}`), d, topic);
      const list = texts(q, mod);
      if (q.input.kind === 'choice') q.input.options.forEach((_, j) => { const m = mod.check(q, { kind: 'choice', index: j }).mistake; if (m) list.push(m); });
      for (const lang of ['en', 'pl', 'uk'] as const) for (const t of list) {
        const out = renderText(t, lang);
        if (/\.\.|\{\w+\}/.test(out)) bad.push(`${lang}: ${out}`);
      }
    }
    expect([...new Set(bad)].slice(0, 10)).toEqual([]);
  });
});

describe('generateSet', () => {
  test('deterministic, right size, unique ids, alternates types', () => {
    const a = generateSet('abc', [2], 'medium', 10);
    const b = generateSet('abc', [2], 'medium', 10);
    expect(a).toEqual(b);
    expect(a).toHaveLength(10);
    expect(new Set(a.map((q) => q.id)).size).toBe(10);
    expect(new Set(a.map((q) => q.type))).toEqual(new Set(['further', 'relative-line']));
  });
  test('mixed topics cycle through the given topic list', () => {
    const set = generateSet('mix', [1, 2, 3, 4], 'easy', 8);
    expect(set.map((q) => q.topic)).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
  });
});
