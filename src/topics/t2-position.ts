import type { TopicDef } from './types';

export const topic2: TopicDef = {
  id: 2,
  questionTypes: ['further', 'relative-line'],
  steps: [
    { id: 'north-south', scene: { views: ['flat'], point: null, flatPreset: 'europe', layers: { specialLines: true }, overlays: [{ kind: 'highlight-line', axis: 'lat', value: 50 }, { kind: 'marker', p: { lat: 52.23, lon: 21.01 }, tone: 'a', label: '52°N' }, { kind: 'marker', p: { lat: 41.9, lon: 12.5 }, tone: 'b', label: '42°N' }] } },
    { id: 'southern', scene: { views: ['flat'], point: null, layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lat', value: -20 }, { kind: 'marker', p: { lat: -40, lon: 20 }, tone: 'a', label: '40°S' }, { kind: 'marker', p: { lat: -10, lon: 60 }, tone: 'b', label: '10°S' }] } },
    { id: 'east-west', scene: { views: ['flat'], point: null, flatPreset: 'europe', layers: { specialLines: true }, overlays: [{ kind: 'highlight-line', axis: 'lon', value: 20 }, { kind: 'marker', p: { lat: 50.45, lon: 30.52 }, tone: 'a', label: '31°E' }, { kind: 'marker', p: { lat: 51.51, lon: -0.13 }, tone: 'b', label: '0°' }] } },
    { id: 'western', scene: { views: ['flat'], point: null, layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lon', value: -60 }, { kind: 'marker', p: { lat: 40, lon: -100 }, tone: 'a', label: '100°W' }, { kind: 'marker', p: { lat: 10, lon: -30 }, tone: 'b', label: '30°W' }] } },
    { id: 'across-zero', scene: { views: ['globe', 'flat'], point: null, rotate: [0, -10], layers: { specialLines: true, hemispheres: 'ew', places: false } } },
    { id: 'play', scene: { views: ['globe', 'flat'], point: { lat: 10, lon: -10 }, pointEditable: true, layers: { specialLines: true } } },
  ],
};
