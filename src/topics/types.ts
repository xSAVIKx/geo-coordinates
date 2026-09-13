import type { TopicId } from '../app/ids';
import type { SceneSpec } from '../map/types';
import type { QuestionTypeId } from '../quiz/types';

export interface ExploreStep {
  id: string;
  scene: SceneSpec;
  showPlaces?: boolean;
  /** A small decorative drawing beside the step text (the text says everything it shows). */
  illustration?: 'map-pin';
}

export interface TopicDef {
  id: TopicId;
  steps: ExploreStep[];
  questionTypes: QuestionTypeId[];
}
