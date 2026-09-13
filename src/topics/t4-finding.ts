import type { TopicDef } from './types';

export const topic4: TopicDef = {
  id: 4,
  questionTypes: ['place-point', 'which-place'],
  steps: [
    { id: 'plan', scene: { views: ['flat'], flatPreset: 'europe', point: null, layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lat', value: 50 }] } },
    { id: 'meridian', scene: { views: ['flat'], flatPreset: 'europe', point: null, layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lat', value: 50 }, { kind: 'highlight-line', axis: 'lon', value: 30 }] } },
    { id: 'cross', scene: { views: ['flat'], flatPreset: 'europe', point: null, layers: { specialLines: true, places: true }, overlays: [{ kind: 'highlight-line', axis: 'lat', value: 50 }, { kind: 'highlight-line', axis: 'lon', value: 30 }, { kind: 'marker', p: { lat: 50, lon: 30 }, tone: 'answer' }] } },
    { id: 'letters', scene: { views: ['globe', 'flat'], point: null, rotate: [150, 0], layers: { specialLines: true, places: true }, overlays: [{ kind: 'marker', p: { lat: -34, lon: 151 }, tone: 'a', label: '34°S, 151°E' }, { kind: 'marker', p: { lat: 34, lon: -151 }, tone: 'b', label: '34°N, 151°W' }] } },
    { id: 'play', scene: { views: ['globe', 'flat'], point: { lat: 0, lon: 0 }, pointEditable: true, layers: { specialLines: true } }, showPlaces: true },
  ],
};
