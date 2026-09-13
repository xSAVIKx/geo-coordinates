import { expect, test } from 'vitest';
import en from '../../src/i18n/en.json';
import pl from '../../src/i18n/pl.json';
import uk from '../../src/i18n/uk.json';
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
