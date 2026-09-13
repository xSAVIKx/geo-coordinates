import { describe, expect, test } from 'vitest';
import { extremeIndex, lonDifference, spansAntimeridian } from '../../src/geo/compare';
import { normalizeLon } from '../../src/geo/format';
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
              if (dir === 'E' || dir === 'W') {
                expect(spansAntimeridian(vals)).toBe(false);
                // Raw spread, independent of spansAntimeridian: a set 180° or wider has no clear "further east/west".
                const lons = vals.map(normalizeLon);
                expect(Math.max(...lons) - Math.min(...lons), `seed ${s}`).toBeLessThan(180);
              }
              // Explanation: the letter rule when signs are mixed, plus the bigger-number rule when the winner has a same-sign rival.
              const win = vals[(q.answer as { index: number }).index]!;
              const mixedSigns = new Set(vals.map(Math.sign)).size > 1;
              const rival = vals.some((v, j) => j !== (q.answer as { index: number }).index && Math.sign(v) === Math.sign(win));
              const letter = dir === 'N' || dir === 'S' ? (win > 0 ? 'N' : 'S') : win > 0 ? 'E' : 'W';
              const params = q.explanation.params as Record<string, { text: { key: string } }>;
              const axisName = dir === 'N' || dir === 'S' ? 'lat' : 'lon';
              if (!mixedSigns) { expect(q.explanation.key).toBe('q.further.explain'); expect(params.rule!.text.key).toBe(`q.rule.bigger.${letter}`); }
              else if (rival) { expect(q.explanation.key, `seed ${s}`).toBe('q.further.explain2'); expect(params.rule!.text.key).toBe(`q.rule.mixed.${axisName}`); expect(params.rule2!.text.key).toBe(`q.rule.bigger.${letter}`); }
              else { expect(q.explanation.key).toBe('q.further.explain'); expect(params.rule!.text.key).toBe(`q.rule.mixed.${axisName}`); }
            }
            if (q.type === 'which-place') {
              const markers = (q.scene.overlays ?? []).filter((o) => o.kind === 'marker') as { p: { lat: number; lon: number } }[];
              expect(new Set(markers.map((m) => `${m.p.lat},${m.p.lon}`)).size).toBe(4);
              // Every pair of markers is at least 8° apart in latitude or in longitude.
              markers.forEach((a, i) => markers.forEach((b, j) => {
                if (i < j) expect(Math.abs(a.p.lat - b.p.lat) >= 8 || lonDifference(a.p.lon, b.p.lon) >= 8, `seed ${s} markers ${i},${j}`).toBe(true);
              }));
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
            if (q.type === 'relative-line') {
              const line = (q.scene.overlays ?? []).find((o) => o.kind === 'highlight-line') as { axis: 'lat' | 'lon'; value: number };
              const marker = (q.scene.overlays ?? []).find((o) => o.kind === 'marker') as { p: { lat: number; lon: number } };
              const v = marker.p[line.axis];
              const ruleKey = (q.explanation.params as Record<string, { text: { key: string } }>).rule!.text.key;
              if (v === 0 || line.value === 0) expect(ruleKey, `seed ${s}`).toBe(`q.rule.zero.${line.axis}`);
              else if (Math.sign(v) !== Math.sign(line.value)) expect(ruleKey, `seed ${s}`).toBe(`q.rule.mixed.${line.axis}`);
              else expect(ruleKey, `seed ${s}`).toMatch(/^q\.rule\.bigger\./);
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
  test('each topic mixes its own modules even when topic and module counts share a factor', () => {
    const set = generateSet('mixing', [1, 2, 3, 4], 'medium', 16);
    const typesFor = (topic: number) => new Set(set.filter((q) => q.topic === topic).map((q) => q.type));
    expect(typesFor(2)).toEqual(new Set(['further', 'relative-line']));
    expect(typesFor(4)).toEqual(new Set(['place-point', 'which-place']));
  });
  test('mixed topics cycle through the given topic list', () => {
    const set = generateSet('mix', [1, 2, 3, 4], 'easy', 8);
    expect(set.map((q) => q.topic)).toEqual([1, 2, 3, 4, 1, 2, 3, 4]);
  });
});

describe('difference and distance', () => {
  type Marker = { kind: 'marker'; p: { lat: number; lon: number }; label?: string };
  const markersOf = (overlays: Question['scene']['overlays']) => (overlays ?? []).filter((o) => o.kind === 'marker') as Marker[];
  const num = (value: number) => ({ kind: 'number' as const, value });

  for (const d of DIFFS) {
    test(`difference ${d}: the answer, rule, explanation and hints all follow the two values`, () => {
      const mod = MODULES.find((m) => m.type === 'difference')!;
      let over180 = 0, opposite = 0, same = 0, zero = 0;
      for (let s = 0; s < SEEDS; s++) {
        const q = mod.generate(createRng(`diff-prop:${d}:${s}`), d, 6);
        const axis = q.meta!.axis as 'lat' | 'lon';
        const [A, B] = markersOf(q.scene.overlays).map((m) => m.p);
        const va = A![axis], vb = B![axis];
        const x = Math.abs(va), y = Math.abs(vb);
        const expected = axis === 'lat' ? Math.abs(va - vb) : lonDifference(va, vb);
        expect(q.answer, `seed ${s}`).toEqual(num(expected));
        expect(expected).toBeGreaterThan(0);
        // Markers are clearly apart on the map.
        expect(Math.abs(A!.lat - B!.lat) >= 8 || lonDifference(A!.lon, B!.lon) >= 8, `seed ${s}`).toBe(true);
        const sign = (v: number) => Math.sign(v);
        const p = q.explanation.params as Record<string, number>;
        const onLine = va === 0 || vb === 0;
        const crosses180 = axis === 'lon' && !onLine && sign(va) !== sign(vb) && x + y > 180;
        if (onLine) { zero++; expect(q.explanation.key).toBe(`q.diff.explain.zero.${axis}`); expect(p.result).toBe(expected); }
        else if (sign(va) === sign(vb)) { same++; expect(q.explanation.key).toBe(`q.diff.explain.same.${axis}`); expect(p.big! - p.small!).toBe(expected); }
        else if (crosses180) { over180++; expect(q.explanation.key).toBe('q.diff.explain.over180'); expect(p.x! + p.y!).toBe(p.sum); expect(360 - p.sum!).toBe(expected); }
        else { opposite++; expect(q.explanation.key).toBe(`q.diff.explain.opposite.${axis}`); expect(p.x! + p.y!).toBe(expected); }
        // The rendered explanation shows the numbers it works with.
        const en = renderText(q.explanation, 'en');
        expect(en).toContain(`${expected}°`);
        if (crosses180) expect(en).toContain(`360 − ${x + y} = ${expected}°`);
        // Difficulty (spec 5.2).
        if (d === 'easy') { expect(sign(va)).toBe(sign(vb)); expect(Math.abs(va) % 10).toBe(0); expect(Math.abs(vb) % 10).toBe(0); expect(onLine).toBe(false); }
        if (d !== 'hard' && axis === 'lon') expect(spansAntimeridian([va, vb]) || (sign(va) !== sign(vb) && x + y >= 180), `seed ${s}`).toBe(false);
        // Every hint fires exactly in its situation, and no wrong candidate is accepted.
        const candidates = new Set([x + y, Math.abs(x - y), 360 - (x + y), expected + 1, expected - 1, 180 - expected].filter((c) => c >= 0 && c !== expected));
        for (const c of candidates) {
          const res = mod.check(q, num(c));
          expect(res.correct, `seed ${s} candidate ${c}`).toBe(false);
          let want: string | undefined;
          if (!onLine && sign(va) !== sign(vb) && c === Math.abs(x - y)) want = crosses180 ? 'q.diff.mistake.subtractedOver180' : `q.diff.mistake.subtracted.${axis}`;
          else if (!onLine && sign(va) === sign(vb) && c === x + y) want = `q.diff.mistake.added.${axis}`;
          else if (crosses180 && c === x + y) want = 'q.diff.mistake.over180';
          expect(res.mistake?.key, `seed ${s} candidate ${c}`).toBe(want);
        }
        // The solution bracket matches the asked axis and joins the two markers.
        expect(q.solution).toEqual([{ kind: axis === 'lat' ? 'lat-diff' : 'lon-diff', a: A, b: B }]);
        // A 180° crossing needs the globe; everything else fits a flat view.
        if (crosses180) { expect(q.scene.views[0]).toBe('globe'); expect(q.scene.phoneView).toBe('globe'); }
        else expect(q.scene.flatView).toBeDefined();
      }
      if (d === 'hard') expect(over180).toBeGreaterThan(SEEDS / 5);
      else expect(over180).toBe(0);
      if (d === 'medium') { expect(opposite).toBeGreaterThan(SEEDS / 4); expect(same).toBeGreaterThan(SEEDS / 10); expect(zero).toBeGreaterThan(0); }
    });

    test(`distance ${d}: kilometres, reverse questions, 111 note and hints`, () => {
      const mod = MODULES.find((m) => m.type === 'distance')!;
      let reverse = 0;
      for (let s = 0; s < SEEDS; s++) {
        const q = mod.generate(createRng(`dist-prop:${d}:${s}`), d, 7);
        const bracket = q.solution.find((o) => o.kind === 'distance') as { a: { lat: number; lon: number }; b: { lat: number; lon: number } };
        const { a, b } = bracket;
        expect(a.lon).toBe(b.lon);
        expect(Math.abs(a.lat)).toBeLessThanOrEqual(70);
        expect(Math.abs(b.lat)).toBeLessThanOrEqual(70);
        const deg = Math.abs(a.lat - b.lat);
        const km = Math.round(deg * 111.2 * 10) / 10;
        if (d === 'easy') { expect(Math.sign(a.lat)).toBe(Math.sign(b.lat)); expect(Math.abs(a.lat) % 10).toBe(0); expect(Math.abs(b.lat) % 10).toBe(0); expect(a.lat).not.toBe(0); }
        if (q.meta!.mode === 'reverse') {
          reverse++;
          expect(d).toBe('hard');
          expect(q.answer).toEqual(num(deg));
          expect(q.input).toEqual({ kind: 'number', unit: 'deg' });
          expect(markersOf(q.scene.overlays)).toEqual([]); // the places are not shown before answering
          expect(markersOf(q.solution)).toHaveLength(2);
          expect(renderText(q.prompt, 'en')).toContain(`${km} km`);
          expect(renderText(q.explanation, 'en')).toContain(`${km} ÷ 111.2 = ${deg}°`);
          expect(mod.check(q, num(km / 111)).correct).toBe(true);
          expect(mod.check(q, num(deg + 0.5)).correct).toBe(false);
          expect(mod.check(q, num(deg + 0.5)).mistake).toBeUndefined();
          expect(mod.check(q, num(Math.round(km * 111.2))).mistake?.key).toBe('q.dist.mistake.multiplied');
          expect(mod.check(q, num(km)).correct).toBe(false);
          continue;
        }
        expect(q.answer).toEqual(num(km));
        expect(q.input).toEqual({ kind: 'number', unit: 'km' });
        expect(markersOf(q.scene.overlays).map((m) => m.p)).toEqual([a, b]);
        const en = renderText(q.explanation, 'en');
        expect(en, `seed ${s}`).toContain(`${deg} × 111.2 = ${km} km`);
        const x = Math.abs(a.lat), y = Math.abs(b.lat);
        const onLine = a.lat === 0 || b.lat === 0;
        const sameSide = !onLine && Math.sign(a.lat) === Math.sign(b.lat);
        if (onLine) expect(en).toContain('on the equator');
        else if (sameSide) expect(en).toContain(`${Math.max(x, y)} − ${Math.min(x, y)} = ${deg}°`);
        else expect(en).toContain(`${x} + ${y} = ${deg}°`);
        // 111.2 and 111 both accepted; 111 gets the note only when the two really differ.
        expect(mod.check(q, num(Math.round(km))).correct).toBe(true);
        const with111 = mod.check(q, num(deg * 111));
        expect(with111.correct).toBe(true);
        if (Math.abs(deg * 111 - km) > 1) expect(with111.note?.key).toBe('q.dist.note111');
        expect(mod.check(q, num(km)).note).toBeUndefined();
        // Wrong answers and their hints.
        const degrees = mod.check(q, num(deg));
        expect(degrees).toEqual({ correct: false, mistake: { key: 'q.dist.mistake.degrees' } });
        const wrongDeg = sameSide ? x + y : Math.abs(x - y);
        for (const factor of [111.2, 111]) {
          const wrong = Math.round(wrongDeg * factor);
          const res = mod.check(q, num(wrong));
          if (wrong === deg) { expect(res.mistake?.key).toBe('q.dist.mistake.degrees'); continue; } // e.g. 55°N/56°S: 1° × 111 = 111 is also the degrees
          if (onLine) { expect(res.mistake, `seed ${s}`).toBeUndefined(); continue; }
          expect(res.correct, `seed ${s}`).toBe(false);
          expect(res.mistake?.key, `seed ${s}`).toBe(sameSide ? 'q.diff.mistake.added.lat' : 'q.diff.mistake.subtracted.lat');
        }
        const off = mod.check(q, num(km + 150));
        expect(off).toEqual({ correct: false });
      }
      if (d === 'hard') { expect(reverse).toBeGreaterThan(SEEDS / 3); expect(reverse).toBeLessThan((2 * SEEDS) / 3); }
    });
  }
});

describe('distance tolerances', () => {
  const mod = MODULES.find((m) => m.type === 'distance')!;
  const q29 = (mode: 'forward' | 'reverse'): Question => ({
    id: 'distance-0', type: 'distance', topic: 7, difficulty: 'hard', prompt: { key: 'q.dist.prompt' },
    input: { kind: 'number', unit: mode === 'forward' ? 'km' : 'deg' },
    answer: { kind: 'number', value: mode === 'forward' ? 3224.8 : 29 },
    explanation: { key: 'q.dist.explain' }, scene: { views: ['flat'] }, solution: [],
    meta: mode === 'forward' ? { mode, deg: 29, km: 3224.8, method: 'same-subtract', x: 40, y: 11 } : { mode, deg: 29, km: 3224.8 },
  });
  const check = (mode: 'forward' | 'reverse', value: number) => mod.check(q29(mode), { kind: 'number', value });

  test('degrees from kilometres: ±0.1° exactly at the edges, the 111 note only when 111.2 does not already give the answer', () => {
    expect(check('reverse', 28.9)).toEqual({ correct: true });
    expect(check('reverse', 29.1)).toEqual({ correct: true });
    expect(check('reverse', 29)).toEqual({ correct: true });
    // 3224.8 ÷ 111 = 29.05…: 29.15 is 0.15 from 29 but within 0.1 of the 111 result.
    expect(check('reverse', 29.15)).toEqual({ correct: true, note: { key: 'q.dist.note111' } });
    expect(check('reverse', 28.85).correct).toBe(false);
    expect(check('reverse', 29.2).correct).toBe(false);
  });

  test('kilometres: ±1 km exactly at the edges, the 111 note only when the answer needs 111', () => {
    expect(check('forward', 3223.8)).toEqual({ correct: true });
    expect(check('forward', 3225.8)).toEqual({ correct: true });
    expect(check('forward', 3225.9).correct).toBe(false);
    expect(check('forward', 3219)).toEqual({ correct: true, note: { key: 'q.dist.note111' } }); // 29 × 111
    expect(check('forward', 3218)).toEqual({ correct: true, note: { key: 'q.dist.note111' } });
    expect(check('forward', 3220)).toEqual({ correct: true, note: { key: 'q.dist.note111' } });
    expect(check('forward', 3222.7).correct).toBe(false);
  });
});

describe('which-place never singles out a Ukrainian city as the answer', () => {
  test('1000 seeds × difficulty never pick kyiv, lviv, odesa or kharkiv', () => {
    const mod = MODULES.find((m) => m.type === 'which-place')!;
    const excluded = new Set(['kyiv', 'lviv', 'odesa', 'kharkiv']);
    for (const d of DIFFS) {
      for (let s = 0; s < SEEDS; s++) {
        const q = mod.generate(createRng(`which-excl:${d}:${s}`), d, 4);
        expect(excluded.has(q.meta?.placeId as string), `seed ${s} ${d}`).toBe(false);
      }
    }
  });
});
