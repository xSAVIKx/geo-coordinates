import { untrack } from 'svelte';
import { motionReduced } from '../app/settings.svelte';
import { readString, writeString } from '../app/storage';
import { clampLat, normalizeLon, roundTo } from '../geo/format';
import { dateFromDayAndMinutes, dayOfYear, daysInYear } from '../geo/sun';
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
/** Deep enough to see a town's streets-scale grid of minutes (the view spans 4.5° × 2.25°). */
export const FLAT_MAX_ZOOM = 80;
const MAX_ZOOM = FLAT_MAX_ZOOM;
export const GLOBE_MIN_ZOOM = 1;
export const GLOBE_MAX_ZOOM = 60;

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
  /** Bumped by every `applyScene`, so layers can drop per-scene memory (e.g. label hysteresis). */
  sceneVersion = $state(0);

  get flatProjection(): FlatProjection {
    return this.projectionOverride ?? this.projectionPreference;
  }

  setProjectionPreference(p: FlatProjection): void {
    this.projectionPreference = p;
    writeString(PROJECTION_KEY, p);
  }

  /**
   * Replaces the whole scene. Callers run this from an `$effect` keyed on the current question/step,
   * so it must not read any `$state` of its own: a read here (e.g. `this.point` right after writing
   * it, or `this.precision` inside `setPoint`) would subscribe the calling effect to state this very
   * method rewrites — `point` is a fresh object on every call — and the effect would re-run itself
   * forever (`effect_update_depth_exceeded`). `untrack` keeps it a pure write.
   */
  applyScene(scene: SceneSpec): void {
    untrack(() => this.replaceScene(scene));
  }

  private replaceScene(scene: SceneSpec): void {
    this.sceneVersion += 1;
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
    this.phoneView = scene.phoneView && scene.views.includes(scene.phoneView) ? scene.phoneView : scene.views.includes('flat') ? 'flat' : (scene.views[0] ?? 'flat');
    this.lastChange = 'program';
  }

  setSunNow(now: Date = new Date()): void {
    const year = now.getUTCFullYear();
    this.sun = { utcMinutes: now.getUTCHours() * 60 + now.getUTCMinutes(), dayOfYear: Math.min(daysInYear(year), dayOfYear(now)), year };
  }

  sunDate(): Date | null {
    return this.sun ? dateFromDayAndMinutes(this.sun.year, this.sun.dayOfYear, this.sun.utcMinutes) : null;
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

  /**
   * `{ animate: true }` marks the added overlays to draw/scale/fade in (see Overlays.svelte) — used
   * for a class-quiz reveal or a Practice solution, so the answer doesn't just snap onto the map.
   * Silently skipped when reduced motion is on, so callers never need their own check.
   */
  addOverlays(o: Overlay[], opts?: { animate?: boolean }): void {
    const items = opts?.animate && !motionReduced() ? o.map((ov) => ({ ...ov, animate: true })) : o;
    this.overlays = [...this.overlays, ...items];
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
