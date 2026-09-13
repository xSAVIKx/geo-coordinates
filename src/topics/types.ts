import type { TopicId } from '../app/ids';
import type { SceneSpec } from '../map/types';
import type { QuestionTypeId } from '../quiz/types';

export interface ExploreStep {
  id: string;
  scene: SceneSpec;
  showPlaces?: boolean;
}

export interface TopicDef {
  id: TopicId;
  steps: ExploreStep[];
  questionTypes: QuestionTypeId[];
}
