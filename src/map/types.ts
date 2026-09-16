import type { Axis, LatLon, Precision } from '../geo/types';
import type { MapStyle } from './mapStyle';

export type ViewId = 'globe' | 'flat' | 'cross-section';
export type FlatPreset = 'world' | 'europe' | 'poland';
export type FlatProjection = 'grid' | 'equal-earth' | 'mercator';
export interface LayerFlags {
  graticuleStep: 1 | 5 | 10 | 15 | 30 | 'auto'; // 'auto': adapts to the zoom (see gridStep.ts)
  specialLines: boolean;      // equator, prime meridian, 180°
  tropics: boolean;           // tropics + polar circles
  hemispheres: 'none' | 'ns' | 'ew';
  places: boolean;
  borders: boolean;
  daylight: boolean;
  pointGuides: boolean;       // dashed parallel + meridian through the point
  schools: boolean;           // Maple Bear schools (offered only where the scene sets `schoolsToggle`)
}
export type MarkerTone = 'a' | 'b' | 'c' | 'd' | 'answer' | 'wrong';
export type OverlayKind =
  | { kind: 'marker'; p: LatLon; tone: MarkerTone; label?: string; labelKey?: string } // labelKey: an i18n key, used instead of `label`
  | { kind: 'highlight-line'; axis: Axis; value: number }
  | { kind: 'highlight-region'; region: 'N' | 'S' | 'E' | 'W' }
  | { kind: 'lat-diff'; a: LatLon; b: LatLon }
  | { kind: 'lon-diff'; a: LatLon; b: LatLon }
  | { kind: 'distance'; a: LatLon; b: LatLon }
  | { kind: 'noon-meridian' };
// `animate` is set only by `MapState.addOverlays(o, { animate: true })` (never by scene authors) to
// mark overlays that should draw/scale/fade in — see Overlays.svelte.
export type Overlay = OverlayKind & { animate?: boolean };
/**
 * How the readout writes the point: `letters` 52°14′N, 21°E; `decimal` like a map app (50.2649, 19.0238)
 * with the letters below; `both` the decimal pair with degrees, minutes and seconds below.
 */
export type Readout = 'letters' | 'decimal' | 'both';
export type LabControl = 'sun-time' | 'sun-date' | 'clocks' | 'now' | 'real-sun';
export interface SceneSpec {
  views: ViewId[];                       // views shown, in order
  phoneView?: ViewId;                    // the view a phone opens with (must be in `views`); default: flat if shown, else the first
  layers?: Partial<LayerFlags>;
  point?: LatLon | null;                 // null hides the movable point
  pointEditable?: boolean;
  precision?: Precision | 'auto';        // 'auto' (free play): minutes once zoomed in to 12 (see MapState.precision)
  showReadout?: boolean;                 // default true; false hides readout + sliders
  readout?: Readout;                     // default 'letters'; 'decimal'/'both' also keep the point to 4 decimals
  rotate?: [number, number];             // globe rotation [lambda, phi] in degrees
  globeZoom?: number;                    // globe zoom factor; default 1
  flatPreset?: FlatPreset;
  flatView?: { center: LatLon; zoom: number }; // overrides flatPreset
  flatProjection?: FlatProjection;       // forces this projection for the scene; absent = viewer preference applies
  projectionSwitch?: boolean;            // with flatProjection: keep the projection switch; a choice then applies to this scene only
  mapStyle?: MapStyle;                   // forces this map style for the scene (worksheets: 'atlas'); a pick with the switch then lasts for the scene only
  overlays?: Overlay[];
  sun?: { utcMinutes: number; dayOfYear: number } | null;
  labControls?: LabControl[];
  schoolsToggle?: boolean;               // offers the "Maple Bear schools" layer switch (the layer itself starts off)
}
