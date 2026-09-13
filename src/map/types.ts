import type { Axis, LatLon, Precision } from '../geo/types';

export type ViewId = 'globe' | 'flat' | 'cross-section';
export type FlatPreset = 'world' | 'europe' | 'poland';
export type FlatProjection = 'grid' | 'equal-earth';
export interface LayerFlags {
  graticuleStep: 1 | 5 | 10 | 15 | 30;
  specialLines: boolean;      // equator, prime meridian, 180°
  tropics: boolean;           // tropics + polar circles
  hemispheres: 'none' | 'ns' | 'ew';
  places: boolean;
  borders: boolean;
  daylight: boolean;
  pointGuides: boolean;       // dashed parallel + meridian through the point
}
export type MarkerTone = 'a' | 'b' | 'c' | 'd' | 'answer' | 'wrong';
export type Overlay =
  | { kind: 'marker'; p: LatLon; tone: MarkerTone; label?: string }
  | { kind: 'highlight-line'; axis: Axis; value: number }
  | { kind: 'highlight-region'; region: 'N' | 'S' | 'E' | 'W' }
  | { kind: 'lat-diff'; a: LatLon; b: LatLon }
  | { kind: 'lon-diff'; a: LatLon; b: LatLon }
  | { kind: 'distance'; a: LatLon; b: LatLon }
  | { kind: 'noon-meridian' };
export type LabControl = 'sun-time' | 'sun-date' | 'clocks' | 'now';
export interface SceneSpec {
  views: ViewId[];                       // views shown, in order
  layers?: Partial<LayerFlags>;
  point?: LatLon | null;                 // null hides the movable point
  pointEditable?: boolean;
  precision?: Precision;
  showReadout?: boolean;                 // default true; false hides readout + sliders
  rotate?: [number, number];             // globe rotation [lambda, phi] in degrees
  flatPreset?: FlatPreset;
  flatView?: { center: LatLon; zoom: number }; // overrides flatPreset
  flatProjection?: FlatProjection;       // forces this projection for the scene; absent = viewer preference applies
  overlays?: Overlay[];
  sun?: { utcMinutes: number; dayOfYear: number } | null;
  labControls?: LabControl[];
}
