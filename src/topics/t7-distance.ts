import type { TopicDef } from './types';
import { HOME } from '../map/places';

// Flat steps use the grid map: its meridians are straight, so the distance bracket runs alongside the meridian.
export const topic7: TopicDef = {
  id: 7,
  questionTypes: ['distance'],
  steps: [
    { id: 'degree-length', scene: { views: ['globe', 'cross-section'], point: { lat: 1, lon: 21 }, rotate: [-21, -20], layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lon', value: 21 }] } },
    { id: 'example', scene: { views: ['flat'], point: null, flatProjection: 'grid', flatPreset: 'europe', layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lon', value: 20 }, { kind: 'marker', p: { lat: 50, lon: 20 }, tone: 'a', label: '50°N' }, { kind: 'marker', p: { lat: 40, lon: 20 }, tone: 'b', label: '40°N' }, { kind: 'distance', a: { lat: 50, lon: 20 }, b: { lat: 40, lon: 20 } }] } },
    { id: 'across-equator', scene: { views: ['flat'], point: null, flatProjection: 'grid', flatView: { center: { lat: -5, lon: 5 }, zoom: 3 }, layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lon', value: 20 }, { kind: 'marker', p: { lat: 10, lon: 20 }, tone: 'a', label: '10°N' }, { kind: 'marker', p: { lat: -20, lon: 20 }, tone: 'b', label: '20°S' }, { kind: 'distance', a: { lat: 10, lon: 20 }, b: { lat: -20, lon: 20 } }] } },
    { id: 'reverse', scene: { views: ['flat'], point: null, flatProjection: 'grid', flatPreset: 'europe', layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lon', value: 20 }, { kind: 'marker', p: { lat: 55, lon: 20 }, tone: 'a' }, { kind: 'marker', p: { lat: 50, lon: 20 }, tone: 'b' }, { kind: 'distance', a: { lat: 55, lon: 20 }, b: { lat: 50, lon: 20 } }] } },
    { id: 'only-meridians', scene: { views: ['globe'], point: null, rotate: [-20, -40], layers: { specialLines: true, places: false }, overlays: [{ kind: 'highlight-line', axis: 'lat', value: 60 }, { kind: 'highlight-line', axis: 'lat', value: 0 }] } },
    { id: 'play', scene: { views: ['flat', 'cross-section'], point: HOME, pointEditable: true, layers: { specialLines: true } } },
  ],
};
