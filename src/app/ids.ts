export type TopicId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export const TOPIC_IDS: readonly TopicId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/** The chosen topics in lesson order, whatever order they were ticked in (so a quiz code always gives the same set). */
export function inTopicOrder(chosen: readonly TopicId[]): TopicId[] {
  return TOPIC_IDS.filter((id) => chosen.includes(id));
}
