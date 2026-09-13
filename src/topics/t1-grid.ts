import type { TopicDef } from './types';

export const topic1: TopicDef = {
  id: 1,
  questionTypes: ['name-line'],
  steps: [
    { id: 'ball', scene: { views: ['globe'], point: null, rotate: [-20, -25], layers: { specialLines: false, places: false, graticuleStep: 30 } } },
    { id: 'equator', scene: { views: ['globe', 'flat'], point: null, rotate: [-20, -15], layers: { specialLines: true, hemispheres: 'ns', places: false }, overlays: [{ kind: 'highlight-line', axis: 'lat', value: 0 }] } },
    { id: 'parallels', scene: { views: ['globe', 'flat'], point: null, rotate: [-20, -35], layers: { specialLines: true, graticuleStep: 15, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lat', value: 30 }, { kind: 'highlight-line', axis: 'lat', value: 60 }] } },
    { id: 'angle', scene: { views: ['cross-section', 'globe'], point: { lat: 52, lon: 21 }, pointEditable: true, layers: { specialLines: true, places: false } } },
    { id: 'meridians', scene: { views: ['globe', 'flat'], point: null, rotate: [-30, -20], layers: { specialLines: true, graticuleStep: 15, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lon', value: 30 }, { kind: 'highlight-line', axis: 'lon', value: -60 }] } },
    { id: 'prime', scene: { views: ['globe', 'flat'], point: null, rotate: [0, -20], layers: { specialLines: true, hemispheres: 'ew', places: false } } },
    { id: 'projections', scene: { views: ['flat'], point: null, flatProjection: 'equal-earth', layers: { specialLines: true, hemispheres: 'none', places: true } } },
    { id: 'tropics', scene: { views: ['flat', 'cross-section'], point: { lat: 23, lon: 0 }, layers: { specialLines: true, tropics: true, places: false, pointGuides: false } } },
    { id: 'play', scene: { views: ['globe', 'flat'], point: { lat: 52, lon: 21 }, pointEditable: true, layers: { specialLines: true, tropics: true } } },
  ],
};
