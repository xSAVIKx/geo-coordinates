import type { TopicDef } from './types';

const warsaw = { lat: 52, lon: 21 }, cairo = { lat: 30, lon: 31 }, capetown = { lat: -34, lon: 18 }, kyiv = { lat: 50, lon: 31 }, newyork = { lat: 41, lon: -74 }, tokyo = { lat: 36, lon: 140 }, honolulu = { lat: 21, lon: -158 };
// The over-180 step shows only the globe: the flat map cannot draw the short way across 180° in one piece, and on phones
// a two-view scene would open on the map tab.
export const topic6: TopicDef = {
  id: 6,
  questionTypes: ['difference'],
  steps: [
    { id: 'same-lat', scene: { views: ['flat'], point: null, flatView: { center: { lat: 40, lon: 5 }, zoom: 3 }, layers: { specialLines: true, places: false }, overlays: [{ kind: 'marker', p: warsaw, tone: 'a', label: '52°N' }, { kind: 'marker', p: cairo, tone: 'b', label: '30°N' }, { kind: 'lat-diff', a: warsaw, b: cairo }] } },
    { id: 'opposite-lat', scene: { views: ['flat'], point: null, flatView: { center: { lat: -2, lon: 0 }, zoom: 1.5 }, layers: { specialLines: true, places: false }, overlays: [{ kind: 'marker', p: cairo, tone: 'a', label: '30°N' }, { kind: 'marker', p: capetown, tone: 'b', label: '34°S' }, { kind: 'lat-diff', a: cairo, b: capetown }] } },
    { id: 'same-lon', scene: { views: ['flat'], point: null, flatPreset: 'europe', layers: { specialLines: true, places: false }, overlays: [{ kind: 'marker', p: kyiv, tone: 'a', label: '31°E' }, { kind: 'marker', p: warsaw, tone: 'b', label: '21°E' }, { kind: 'lon-diff', a: kyiv, b: warsaw }] } },
    { id: 'opposite-lon', scene: { views: ['flat'], point: null, flatView: { center: { lat: 40, lon: -25 }, zoom: 2 }, layers: { specialLines: true, places: false }, overlays: [{ kind: 'marker', p: newyork, tone: 'a', label: '74°W' }, { kind: 'marker', p: warsaw, tone: 'b', label: '21°E' }, { kind: 'lon-diff', a: newyork, b: warsaw }] } },
    { id: 'over-180', scene: { views: ['globe'], point: null, rotate: [-171, -30], layers: { specialLines: true, places: false }, overlays: [{ kind: 'marker', p: tokyo, tone: 'a', label: '140°E' }, { kind: 'marker', p: honolulu, tone: 'b', label: '158°W' }, { kind: 'lon-diff', a: tokyo, b: honolulu }] } },
    { id: 'play', scene: { views: ['globe', 'flat'], point: { lat: 0, lon: 0 }, pointEditable: true, layers: { graticuleStep: 'auto', specialLines: true }, overlays: [{ kind: 'marker', p: warsaw, tone: 'b', label: '52°N, 21°E' }] } },
  ],
};
