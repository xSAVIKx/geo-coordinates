import type { TopicId } from '../app/ids';
import type { Text } from '../i18n/text';
import { difference } from './generators/difference';
import { distance } from './generators/distance';
import { further } from './generators/further';
import { nameLine } from './generators/nameLine';
import { placePoint } from './generators/placePoint';
import { readCoords } from './generators/readCoords';
import { relativeLine } from './generators/relativeLine';
import { whichPlace } from './generators/whichPlace';
import { createRng } from './rng';
import type { Answer, CheckResult, Difficulty, Question, QuestionModule, QuestionTypeId } from './types';

export const MODULES: QuestionModule[] = [nameLine, further, relativeLine, readCoords, placePoint, whichPlace, difference, distance];

export function getModule(type: QuestionTypeId): QuestionModule {
  const m = MODULES.find((x) => x.type === type);
  if (!m) throw new Error(`No question module for ${type}`);
  return m;
}

export function modulesForTopic(topic: TopicId): QuestionModule[] {
  return MODULES.filter((m) => m.topics.includes(topic));
}

export function checkAnswer(q: Question, r: Answer): CheckResult {
  return getModule(q.type).check(q, r);
}

export function describeAnswer(q: Question): Text {
  return getModule(q.type).describeAnswer(q);
}

export function generateSet(seed: string, topics: readonly TopicId[], difficulty: Difficulty, count: number): Question[] {
  const out: Question[] = [];
  const seen = new Set<string>();
  const perTopic = new Map<TopicId, number>(); // earlier questions of the same topic, so each topic rotates through its own modules
  for (let i = 0; i < count; i++) {
    const topic = topics[i % topics.length]!;
    const mods = modulesForTopic(topic);
    if (mods.length === 0) throw new Error(`Topic ${topic} has no question modules`);
    const occurrence = perTopic.get(topic) ?? 0;
    perTopic.set(topic, occurrence + 1);
    for (let attempt = 0; attempt < 10; attempt++) {
      const mod = mods[(occurrence + attempt) % mods.length]!;
      const q = mod.generate(createRng(`${seed}:${i}:${attempt}`), difficulty, topic);
      const signature = JSON.stringify([q.type, q.prompt, q.answer, q.scene.overlays]);
      if (seen.has(signature) && attempt < 9) continue;
      seen.add(signature);
      out.push({ ...q, id: `${q.type}-${i}` });
      break;
    }
  }
  return out;
}
