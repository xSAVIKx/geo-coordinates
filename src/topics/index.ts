import type { TopicId } from '../app/ids';
import { topic1 } from './t1-grid';
import { topic2 } from './t2-position';
import { topic3 } from './t3-reading';
import { topic4 } from './t4-finding';
import { topic5 } from './t5-minutes';
import { topic6 } from './t6-differences';
import { topic7 } from './t7-distance';
import { topic8 } from './t8-time';
import { topic9 } from './t9-phone';
import type { TopicDef } from './types';

export const TOPICS: Partial<Record<TopicId, TopicDef>> = { 1: topic1, 2: topic2, 3: topic3, 4: topic4, 5: topic5, 6: topic6, 7: topic7, 8: topic8, 9: topic9 };

export function getTopic(id: TopicId): TopicDef | undefined {
  return TOPICS[id];
}
