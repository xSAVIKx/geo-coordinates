import type { TopicId } from '../app/ids';
import { topic1 } from './t1-grid';
import { topic2 } from './t2-position';
import { topic3 } from './t3-reading';
import { topic4 } from './t4-finding';
import type { TopicDef } from './types';

export const TOPICS: Partial<Record<TopicId, TopicDef>> = { 1: topic1, 2: topic2, 3: topic3, 4: topic4 };

export function getTopic(id: TopicId): TopicDef | undefined {
  return TOPICS[id];
}
