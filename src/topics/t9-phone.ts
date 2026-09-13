import type { TopicDef } from './types';
import type { SceneSpec } from '../map/types';

// Explore only: no question types, so Practise, the rehearsal and the class quiz leave this topic out.
const KATOWICE = { lat: 50.2649, lon: 19.0238 };
const SYDNEY = { lat: -33.8688, lon: 151.2093 };
const NEW_YORK = { lat: 40.7128, lon: -74.006 };
/** Katowice with the numbers swapped: a spot in the desert of Saudi Arabia (checked against Natural Earth borders). */
const SWAPPED = { lat: KATOWICE.lon, lon: KATOWICE.lat };

// Flat maps start as the map app's Mercator, but pupils can still switch to compare (projectionSwitch).
const MAP_APP: Pick<SceneSpec, 'flatProjection' | 'projectionSwitch'> = { flatProjection: 'mercator', projectionSwitch: true };

export const topic9: TopicDef = {
  id: 9,
  questionTypes: [],
  steps: [
    { id: 'gps', scene: { views: ['globe', 'flat'], ...MAP_APP, flatPreset: 'europe', point: KATOWICE, precision: 'minute', layers: { graticuleStep: 'auto', specialLines: true } } },
    { id: 'decimal', scene: { views: ['flat'], ...MAP_APP, flatPreset: 'poland', point: KATOWICE, precision: 'minute', readout: 'decimal', layers: { graticuleStep: 'auto', specialLines: true } } },
    {
      id: 'signs',
      scene: {
        // Zoom 1: the world as wide as the view (±66°), so Sydney and New York are not tiny on a phone.
        views: ['flat'], ...MAP_APP, flatView: { center: { lat: 0, lon: 0 }, zoom: 1 }, point: SYDNEY, pointEditable: true, readout: 'decimal',
        layers: { graticuleStep: 'auto', specialLines: true }, overlays: [{ kind: 'marker', p: NEW_YORK, tone: 'b', label: '40.7128, -74.0060' }],
      },
    },
    { id: 'dms', scene: { views: ['flat'], ...MAP_APP, flatView: { center: KATOWICE, zoom: 40 }, point: KATOWICE, pointEditable: true, precision: 'minute', readout: 'both', layers: { graticuleStep: 'auto', specialLines: true } } },
    { id: 'find', illustration: 'map-pin', scene: { views: ['flat'], ...MAP_APP, flatView: { center: KATOWICE, zoom: 12 }, point: KATOWICE, precision: 'minute', readout: 'decimal', layers: { graticuleStep: 'auto' } } },
    // Zoom 0.84 centred at 53°N fits all of Greenland (to 83.6°N) and Africa's southern tip (34.8°S), with a little room at both edges.
    {
      id: 'mercator',
      scene: {
        views: ['globe', 'flat'], phoneView: 'flat', ...MAP_APP, flatView: { center: { lat: 53, lon: 0 }, zoom: 0.84 }, rotate: [15, -30], point: null,
        layers: { graticuleStep: 'auto', specialLines: true, borders: false }, overlays: [{ kind: 'marker', p: { lat: 74, lon: -41 }, tone: 'c', labelKey: 'label.greenland' }],
      },
    },
    {
      id: 'swap',
      scene: {
        views: ['flat'], ...MAP_APP, flatView: { center: { lat: 36, lon: 34 }, zoom: 3 }, point: null, layers: { graticuleStep: 'auto', specialLines: true },
        overlays: [{ kind: 'marker', p: KATOWICE, tone: 'a', label: '50.2649, 19.0238' }, { kind: 'marker', p: SWAPPED, tone: 'wrong', label: '19.0238, 50.2649' }],
      },
    },
    // The text asks pupils to turn on the Maple Bear schools layer: the step offers the switch (the layer starts off).
    { id: 'play', showPlaces: true, scene: { views: ['globe', 'flat'], ...MAP_APP, flatPreset: 'europe', point: KATOWICE, pointEditable: true, precision: 'minute', readout: 'both', layers: { graticuleStep: 'auto', specialLines: true, tropics: true }, schoolsToggle: true } },
  ],
};
