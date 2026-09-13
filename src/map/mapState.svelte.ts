import { readString, writeString } from '../app/storage';
import { clampLat, normalizeLon, roundTo } from '../geo/format';
import type { LatLon, Precision } from '../geo/types';
import type { FlatPreset, FlatProjection, LabControl, LayerFlags, Overlay, SceneSpec, ViewId } from './types';

const PROJECTION_KEY = 'geo-coords:projection';
function initialProjectionPreference(): FlatProjection {
  return readString(PROJECTION_KEY) === 'equal-earth' ? 'equal-earth' : 'grid';
}

export type ChangeSource = 'map' | 'slider' | 'program';

export const DEFAULT_LAYERS: LayerFlags = {
  graticuleStep: 10, specialLines: true, tropics: false, hemispheres: 'none',
  places: true, borders: true, daylight: false, pointGuides: true,
};

export const FLAT_PRESETS: Record<FlatPreset, { center: LatLon; zoom: number }> = {
  world: { center: { lat: 0, lon: 0 }, zoom: 1 },
  europe: { center: { lat: 52, lon: 15 }, zoom: 3.5 },
  poland: { center: { lat: 52, lon: 19 }, zoom: 9 },
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 12;
export const GLOBE_MIN_ZOOM = 1;
export const GLOBE_MAX_ZOOM = 8;

export class MapState {
  views = $state<ViewId[]>(['globe', 'flat']);
  layers = $state<LayerFlags>({ ...DEFAULT_LAYERS });
  point = $state<LatLon | null>({ lat: 52, lon: 21 });
  pointEditable = $state(true);
  precision = $state<Precision>('degree');
  showReadout = $state(true);
  rotate = $state<[number, number]>([-21, -30]);
  globeZoom = $state(1);
  flat = $state<{ center: LatLon; zoom: number }>({ center: { lat: 0, lon: 0 }, zoom: 1 });
  overlays = $state<Overlay[]>([]);
  sun = $state<{ utcMinutes: number; dayOfYear: number; year: number } | null>(null);
  labControls = $state<LabControl[]>([]);
  phoneView = $state<ViewId>('flat');
  lastChange = $state<ChangeSource>('program');
  projectionPreference = $state<FlatProjection>(initialProjectionPreference());
  projectionOverride = $state<FlatProjection | null>(null);

  get flatProjection(): FlatProjection {
    return this.projectionOverride ?? this.projectionPreference;
  }

  setProjectionPreference(p: FlatProjection): void {
    this.projectionPreference = p;
    writeString(PROJECTION_KEY, p);
  }

  applyScene(scene: SceneSpec): void {
    this.views = [...scene.views];
    this.layers = { ...DEFAULT_LAYERS, ...scene.layers };
    this.projectionOverride = scene.flatProjection ?? null;
    this.precision = scene.precision ?? 'degree';
    this.pointEditable = scene.pointEditable ?? false;
    this.showReadout = scene.showReadout ?? true;
    this.point = null;
    if (scene.point) this.setPoint(scene.point, 'program');
    const p = this.point as LatLon | null;
    this.rotate = scene.rotate ? [...scene.rotate] : p ? [-p.lon, -Math.max(-60, Math.min(60, p.lat))] : [0, -20];
    this.globeZoom = Math.max(GLOBE_MIN_ZOOM, Math.min(GLOBE_MAX_ZOOM, scene.globeZoom ?? 1));
    const view = scene.flatView ?? FLAT_PRESETS[scene.flatPreset ?? 'world'];
    const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, view.zoom));
    this.flat = { zoom, center: this.clampCenter(view.center, zoom) };
    this.overlays = [...(scene.overlays ?? [])];
    this.sun = scene.sun ? { ...scene.sun, year: new Date().getUTCFullYear() } : null;
    this.labControls = [...(scene.labControls ?? [])];
    this.phoneView = scene.views.includes('flat') ? 'flat' : (scene.views[0] ?? 'flat');
    this.lastChange = 'program';
  }

  setPoint(p: LatLon, source: ChangeSource = 'program'): void {
    this.point = { lat: clampLat(roundTo(p.lat, this.precision)), lon: normalizeLon(roundTo(p.lon, this.precision)) };
    this.lastChange = source;
  }

  userSetPoint(p: LatLon, source: 'map' | 'slider'): boolean {
    if (!this.pointEditable) return false;
    this.setPoint(p, source);
    return true;
  }

  stepSize(big: boolean): number {
    if (this.precision === 'minute') return big ? 1 : 1 / 60;
    return big ? 10 : 1;
  }

  nudge(dLat: number, dLon: number, source: 'map' | 'slider'): boolean {
    const cur = this.point ?? { lat: 0, lon: 0 };
    return this.userSetPoint({ lat: cur.lat + dLat, lon: cur.lon + dLon }, source);
  }

  addOverlays(o: Overlay[]): void {
    this.overlays = [...this.overlays, ...o];
  }

  centerGlobeOn(p: LatLon): void {
    this.rotate = [-p.lon, -Math.max(-60, Math.min(60, p.lat))];
  }

  zoomGlobe(factor: number): void {
    this.globeZoom = Math.max(GLOBE_MIN_ZOOM, Math.min(GLOBE_MAX_ZOOM, this.globeZoom * factor));
  }

  setFlatPreset(preset: FlatPreset): void {
    const v = FLAT_PRESETS[preset];
    const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.zoom));
    this.flat = { zoom, center: this.clampCenter(v.center, zoom) };
  }

  zoomFlat(factor: number): void {
    const zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.flat.zoom * factor));
    this.flat = { zoom, center: this.clampCenter(this.flat.center, zoom) };
  }

  panFlat(dLat: number, dLon: number): void {
    const c = this.flat.center;
    this.flat = { zoom: this.flat.zoom, center: this.clampCenter({ lat: c.lat + dLat, lon: c.lon + dLon }, this.flat.zoom) };
  }

  private clampCenter(c: LatLon, zoom: number): LatLon {
    const halfLat = 90 / zoom;
    const halfLon = 180 / zoom;
    return {
      lat: Math.max(-90 + halfLat, Math.min(90 - halfLat, c.lat)),
      lon: Math.max(-180 + halfLon, Math.min(180 - halfLon, c.lon)),
    };
  }
}

export const mapState = new MapState();
