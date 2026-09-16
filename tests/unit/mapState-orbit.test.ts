import { expect, test } from 'vitest';
import { MapState } from '../../src/map/mapState.svelte';

test('the lab\'s Seasons mode adds the orbit view first and takes it away again', () => {
  const s = new MapState();
  s.applyScene({ views: ['globe', 'flat'], labControls: ['sun-date', 'seasons'], sun: { utcMinutes: 720, dayOfYear: 80 } });
  expect(s.orbitToggle).toBe(true);
  s.toggleOrbit();
  expect(s.views).toEqual(['orbit', 'globe', 'flat']);
  s.phoneView = 'orbit';
  s.toggleOrbit();
  expect(s.views).toEqual(['globe', 'flat']);
  expect(s.phoneView).toBe('flat');
});

test('a scene that shows the orbit itself offers no toggle; other scenes neither', () => {
  const s = new MapState();
  s.applyScene({ views: ['orbit', 'globe'], labControls: ['seasons'] });
  expect(s.orbitToggle).toBe(false);
  s.applyScene({ views: ['globe', 'flat'], labControls: ['sun-date'] });
  expect(s.orbitToggle).toBe(false);
});
