import type { Axis, LatLon, Precision } from '../geo/types';
import type { Text } from '../i18n/text';
import type { Overlay, SceneSpec } from '../map/types';
import type { TopicId } from '../app/ids';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type { TopicId } from '../app/ids';   // TopicId is defined in src/app/ids.ts (Task 6)
export type QuestionTypeId = 'name-line' | 'further' | 'relative-line' | 'read-coords' | 'place-point' | 'which-place' | 'difference' | 'distance' | 'time';
export type Answer =
  | { kind: 'choice'; index: number }
  | { kind: 'coords'; value: LatLon }
  | { kind: 'number'; value: number }
  | { kind: 'clock'; minutes: number };
export type InputSpec =
  | { kind: 'choice'; options: Text[] }
  | { kind: 'coords'; precision: Precision; fields: Axis | 'both'; mapPick: boolean }
  | { kind: 'number'; unit: 'deg' | 'km' | 'h' | 'min' }
  | { kind: 'clock' };
export interface Question {
  id: string;                  // `${type}-${seedIndex}`
  type: QuestionTypeId;
  topic: TopicId;
  difficulty: Difficulty;
  prompt: Text;
  input: InputSpec;
  answer: Answer;
  explanation: Text;
  scene: SceneSpec;            // shown while answering
  solution: Overlay[];         // added to the scene after answering
  meta?: Record<string, string | number>; // generator-private data used by check()
}
export interface CheckResult { correct: boolean; mistake?: Text; note?: Text }
export interface Rng { next(): number; int(min: number, max: number): number; pick<T>(items: readonly T[]): T; shuffle<T>(items: readonly T[]): T[] }
export interface QuestionModule {
  type: QuestionTypeId;
  topics: TopicId[];
  generate(rng: Rng, difficulty: Difficulty, topic: TopicId): Question;
  check(q: Question, response: Answer): CheckResult;
  describeAnswer(q: Question): Text;   // the correct answer as text, for feedback
}
