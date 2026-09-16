import { expect, test } from 'vitest';
import { paperScene } from '../../src/quiz/paper';
import { generateSet } from '../../src/quiz/registry';

test('worksheet maps are always Atlas, whatever style the pupil chose', () => {
  const qs = generateSet('sheet:style', [1, 2, 3, 4, 5, 6, 7, 8], 'hard', 40);
  for (const q of qs) expect(paperScene(q).mapStyle, q.id).toBe('atlas');
});
