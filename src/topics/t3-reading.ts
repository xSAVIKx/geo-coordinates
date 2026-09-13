import type { TopicDef } from './types';

export const topic3: TopicDef = {
  id: 3,
  questionTypes: ['read-coords'],
  steps: [
    { id: 'address', scene: { views: ['flat'], flatPreset: 'europe', point: { lat: 52, lon: 21 }, layers: { specialLines: true } } },
    { id: 'latitude', scene: { views: ['flat'], point: { lat: 30, lon: 30 }, showReadout: false, layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lat', value: 30 }] } },
    { id: 'longitude', scene: { views: ['flat'], point: { lat: 30, lon: 30 }, showReadout: false, layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lon', value: 30 }] } },
    { id: 'answer', scene: { views: ['flat'], point: { lat: 30, lon: 30 }, layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lat', value: 30 }, { kind: 'highlight-line', axis: 'lon', value: 30 }] } },
    { id: 'between', scene: { views: ['flat'], flatView: { center: { lat: 45, lon: 15 }, zoom: 4 }, point: { lat: 45, lon: 15 }, layers: { specialLines: true, graticuleStep: 10 }, overlays: [{ kind: 'highlight-line', axis: 'lat', value: 40 }, { kind: 'highlight-line', axis: 'lat', value: 50 }] } },
    { id: 'southwest', scene: { views: ['flat'], point: { lat: -30, lon: -60 }, showReadout: false, layers: { specialLines: true, places: false, hemispheres: 'none' } } },
    { id: 'globe', scene: { views: ['globe', 'flat'], point: { lat: -34, lon: 151 }, layers: { specialLines: true } } },
    { id: 'two-cities', scene: { views: ['flat'], point: null, layers: { specialLines: true, places: false }, overlays: [{ kind: 'marker', p: { lat: 41, lon: -74 }, tone: 'a', label: '41°N, 74°W' }, { kind: 'marker', p: { lat: 50, lon: 20 }, tone: 'b', label: '50°N, 20°E' }] } },
    { id: 'play', scene: { views: ['globe', 'flat'], point: { lat: 52, lon: 21 }, pointEditable: true, layers: { specialLines: true } } },
  ],
};
