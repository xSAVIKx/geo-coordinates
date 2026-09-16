import type { SceneSpec } from '../map/types';
import { HOME, placeById } from '../map/places';
import type { TopicDef } from './types';

// Explore only (spec §6.2): no question types, so Practise, the rehearsal, the class quiz and the worksheet leave it out.
// Days of the year are for a common year: 21 June = 172, 23 September = 266, 21 December = 355 (a day earlier in a leap year).
const JUNE = { utcMinutes: 720, dayOfYear: 172 };
const SEPTEMBER = { utcMinutes: 720, dayOfYear: 266 };
const DECEMBER = { utcMinutes: 720, dayOfYear: 355 };
const SYDNEY = placeById('sydney');
const LIGHT = { specialLines: true, tropics: true, daylight: true, places: false } satisfies SceneSpec['layers'];

export const topic10: TopicDef = {
  id: 10,
  questionTypes: [],
  steps: [
    { id: 'orbit', scene: { views: ['orbit', 'globe'], phoneView: 'orbit', point: null, rotate: [0, -20], sun: JUNE, layers: LIGHT } },
    { id: 'tilt', scene: { views: ['orbit', 'globe'], phoneView: 'orbit', point: null, rotate: [-20, -35], sun: DECEMBER, layers: LIGHT } },
    { id: 'june', scene: { views: ['globe', 'flat'], phoneView: 'globe', point: null, rotate: [-20, -45], sun: JUNE, layers: LIGHT, labControls: ['sun-time'] } },
    { id: 'december', scene: { views: ['globe', 'flat'], phoneView: 'globe', point: null, rotate: [-20, -45], sun: DECEMBER, layers: LIGHT, labControls: ['sun-time'] } },
    { id: 'equinox', scene: { views: ['globe', 'flat'], phoneView: 'globe', point: null, rotate: [-20, -15], sun: SEPTEMBER, layers: LIGHT, labControls: ['sun-time'] } },
    {
      id: 'katowice',
      scene: {
        views: ['orbit', 'flat'], phoneView: 'orbit', point: HOME, sun: JUNE, layers: { specialLines: true, tropics: true, daylight: true },
        overlays: [{ kind: 'marker', p: { lat: SYDNEY.lat, lon: SYDNEY.lon }, tone: 'b', labelKey: 'place.sydney' }], labControls: ['seasons'],
      },
    },
    {
      id: 'play', showPlaces: true,
      scene: { views: ['orbit', 'globe', 'flat'], phoneView: 'orbit', point: HOME, pointEditable: true, precision: 'auto', sun: SEPTEMBER, layers: { graticuleStep: 'auto', specialLines: true, tropics: true, daylight: true }, labControls: ['seasons', 'sun-time'] },
    },
  ],
};
