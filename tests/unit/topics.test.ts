import { expect, test } from 'vitest';
import en from '../../src/i18n/en.json';
import pl from '../../src/i18n/pl.json';
import uk from '../../src/i18n/uk.json';
import { HOME } from '../../src/map/places';
import { TOPIC_IDS } from '../../src/app/ids';
import { modulesForTopic } from '../../src/quiz/registry';
import { TOPICS } from '../../src/topics';

test('every step has title and body in every language and a valid scene', () => {
  for (const topic of Object.values(TOPICS)) {
    const ids = new Set<string>();
    expect(topic!.steps.length).toBeGreaterThanOrEqual(4);
    for (const step of topic!.steps) {
      expect(ids.has(step.id)).toBe(false); ids.add(step.id);
      for (const file of [en, pl, uk] as Record<string, string>[]) {
        expect(file).toHaveProperty(`topic.${topic!.id}.step.${step.id}.title`);
        expect(file).toHaveProperty(`topic.${topic!.id}.step.${step.id}.body`);
      }
      expect(step.scene.views.length).toBeGreaterThan(0);
      if (step.scene.point) { expect(Math.abs(step.scene.point.lat)).toBeLessThanOrEqual(90); }
    }
    expect(topic!.steps.at(-1)!.id).toBe('play');
  }
});

test('free-play steps start at Katowice unless their text is about Warsaw', () => {
  for (const topic of Object.values(TOPICS)) {
    // Topic 9 reads decimals to 4 places, so its free play starts at Katowice's exact decimal coordinates (checked below).
    if (topic!.id === 9) continue;
    const play = topic!.steps.find((s) => s.id === 'play')!;
    const body = (en as Record<string, string>)[`topic.${topic!.id}.step.play.body`]!;
    if (/Warsaw/.test(body)) continue;
    expect(play.scene.point, `topic ${topic!.id}`).toEqual(HOME);
  }
});

test('topic 9 is Explore only: no question types or modules, so rehearsal and class quiz leave it out', () => {
  expect(TOPICS[9]!.questionTypes).toEqual([]);
  expect(modulesForTopic(9)).toEqual([]);
  // The filter Rehearsal.svelte and ClassQuiz.svelte use for their topic lists.
  expect(TOPIC_IDS.filter((id) => modulesForTopic(id).length > 0)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  for (const id of TOPIC_IDS) if (id !== 9) expect(TOPICS[id]!.questionTypes.length, `topic ${id}`).toBeGreaterThan(0);
});

test('topic 9 texts: the numbers in the steps match the formatting helpers and the scenes', async () => {
  const { formatDecimal, formatDMS } = await import('../../src/geo/format');
  const e = en as Record<string, string>;
  const steps = Object.fromEntries(TOPICS[9]!.steps.map((s) => [s.id, s]));
  expect(e['topic.9.step.decimal.body']).toContain(formatDecimal(steps.decimal!.scene.point!));
  expect(e['topic.9.step.dms.body']).toContain(`50.2649° = ${formatDMS(50.2649, 'lat', 'en')}`);
  expect((uk as Record<string, string>)['topic.9.step.dms.body']).toContain(formatDMS(50.2649, 'lat', 'uk'));
  const markers = steps.swap!.scene.overlays!.filter((o) => o.kind === 'marker');
  expect(markers.map((m) => m.kind === 'marker' && m.label)).toEqual([formatDecimal({ lat: 50.2649, lon: 19.0238 }), '19.0238, 50.2649']);
  expect(steps.play!.scene.point).toEqual({ lat: 50.2649, lon: 19.0238 });
  // Every language: the same copyable decimal examples (ASCII minus, dot) and the language's DMS notation.
  const katowice = formatDecimal({ lat: 50.2649, lon: 19.0238 });
  for (const [lang, file] of Object.entries({ en, pl, uk }) as ['en' | 'pl' | 'uk', Record<string, string>][]) {
    expect(file['topic.9.step.decimal.body'], lang).toContain(katowice);
    expect(file['topic.9.step.signs.body'], lang).toContain(formatDecimal(steps.signs!.scene.point!));
    expect(file['topic.9.step.signs.body'], lang).toContain(formatDecimal({ lat: 40.7128, lon: -74.006 }));
    expect(file['topic.9.step.dms.body'], lang).toContain(`50.2649° = ${formatDMS(50.2649, 'lat', lang)}`);
    expect(file['topic.9.step.swap.body'], lang).toContain('19.0238, 50.2649');
    expect(file['topic.9.step.mercator.body'], lang).toMatch(/14/);
    expect(file['topic.9.step.signs.body'], lang).not.toContain('−');
  }
});

test("free-play steps with an adaptive grid use precision 'auto'; other steps don't", () => {
  for (const topic of Object.values(TOPICS)) {
    for (const step of topic!.steps) {
      const auto = step.id === 'play' && step.scene.pointEditable === true && step.scene.layers?.graticuleStep === 'auto' && step.scene.readout === undefined;
      if (auto) expect(step.scene.precision, `topic ${topic!.id} ${step.id}`).toBe('auto');
      else expect(step.scene.precision, `topic ${topic!.id} ${step.id}`).not.toBe('auto');
    }
  }
});
