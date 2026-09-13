import type { TopicDef } from './types';
import { HOME } from '../map/places';

const equinoxNoon = { utcMinutes: 720, dayOfYear: 80 };
export const topic8: TopicDef = {
  id: 8,
  questionTypes: ['time'],
  steps: [
    { id: 'rotation', scene: { views: ['globe', 'flat'], point: null, rotate: [-45, -20], sun: equinoxNoon, layers: { specialLines: true, daylight: true, places: false }, labControls: ['sun-time'] } },
    { id: 'noon', scene: { views: ['globe', 'flat'], point: null, rotate: [-45, -20], sun: equinoxNoon, layers: { specialLines: true, daylight: true, places: false }, overlays: [{ kind: 'noon-meridian' }], labControls: ['sun-time'] } },
    { id: 'fifteen', scene: { views: ['flat'], point: null, sun: equinoxNoon, layers: { specialLines: true, daylight: true, graticuleStep: 15, places: false }, overlays: [{ kind: 'noon-meridian' }, { kind: 'highlight-line', axis: 'lon', value: 15 }], labControls: ['sun-time'] } },
    { id: 'east-later', scene: { views: ['flat'], point: null, flatPreset: 'europe', sun: equinoxNoon, layers: { specialLines: true, daylight: true }, overlays: [{ kind: 'noon-meridian' }], labControls: ['sun-time', 'clocks'] } },
    { id: 'calculate', scene: { views: ['flat'], point: null, flatPreset: 'europe', sun: { utcMinutes: 636, dayOfYear: 80 }, layers: { specialLines: true, daylight: false }, overlays: [{ kind: 'highlight-line', axis: 'lon', value: 21 }, { kind: 'highlight-line', axis: 'lon', value: 31 }, { kind: 'marker', p: { lat: 52, lon: 21 }, tone: 'a', label: '12:00' }, { kind: 'marker', p: { lat: 50, lon: 31 }, tone: 'b', label: '12:40' }], labControls: ['clocks'] } },
    { id: 'far-away', scene: { views: ['flat'], point: null, sun: { utcMinutes: 636, dayOfYear: 80 }, layers: { specialLines: true, daylight: false, places: false }, overlays: [{ kind: 'noon-meridian' }, { kind: 'marker', p: { lat: 52, lon: 21 }, tone: 'a', label: '12:00' }, { kind: 'marker', p: { lat: 29, lon: 77 }, tone: 'b', label: '15:44' }, { kind: 'marker', p: { lat: 41, lon: -74 }, tone: 'c', label: '05:40' }], labControls: ['clocks'] } },
    { id: 'seasons', scene: { views: ['globe', 'flat'], point: null, rotate: [-80, -50], sun: { utcMinutes: 720, dayOfYear: 172 }, layers: { specialLines: true, tropics: true, daylight: true, places: false }, labControls: ['sun-date', 'sun-time'] } },
    { id: 'zones', scene: { views: ['flat'], point: null, flatPreset: 'europe', sun: { utcMinutes: 636, dayOfYear: 20 }, layers: { specialLines: true, daylight: true }, overlays: [{ kind: 'noon-meridian' }], labControls: ['sun-time', 'clocks'] } },
    { id: 'play', scene: { views: ['globe', 'flat'], point: HOME, pointEditable: true, sun: equinoxNoon, layers: { specialLines: true, daylight: true }, overlays: [{ kind: 'noon-meridian' }], labControls: ['sun-time', 'sun-date', 'now', 'clocks'] } },
  ],
};
