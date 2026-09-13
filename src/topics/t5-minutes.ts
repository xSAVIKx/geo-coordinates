import type { TopicDef } from './types';
import { HOME } from '../map/places';

const warsaw = { lat: 52 + 14 / 60, lon: 21 + 1 / 60 };
export const topic5: TopicDef = {
  id: 5,
  questionTypes: ['read-coords', 'place-point', 'further'],
  steps: [
    { id: 'sixty', scene: { views: ['flat'], flatView: { center: { lat: 52.5, lon: 21 }, zoom: 12 }, point: { lat: 52.5, lon: 21 }, precision: 'minute', layers: { graticuleStep: 1, specialLines: true, places: false } } },
    { id: 'quarters', scene: { views: ['flat'], flatView: { center: { lat: 52.5, lon: 21.5 }, zoom: 12 }, point: { lat: 52.25, lon: 21.75 }, precision: 'minute', layers: { graticuleStep: 1, specialLines: true, places: false } } },
    { id: 'warsaw', scene: { views: ['flat'], flatView: { center: warsaw, zoom: 12 }, point: warsaw, precision: 'minute', layers: { graticuleStep: 1, specialLines: true, places: true } } },
    { id: 'compare', scene: { views: ['flat'], flatView: { center: { lat: 52.5, lon: 21 }, zoom: 12 }, point: null, precision: 'minute', layers: { graticuleStep: 1, places: false }, overlays: [{ kind: 'marker', p: { lat: 52.75, lon: 18 }, tone: 'a', label: '52°45′N' }, { kind: 'marker', p: { lat: 52.25, lon: 23 }, tone: 'b', label: '52°15′N' }] } },
    { id: 'play', scene: { views: ['flat'], flatView: { center: { lat: 52.5, lon: 21 }, zoom: 12 }, point: HOME, pointEditable: true, precision: 'minute', layers: { graticuleStep: 1, specialLines: true } } },
  ],
};
