import { untrack } from 'svelte';
import { motionReduced } from '../app/settings.svelte';
import { readString, writeString } from '../app/storage';
import { clampLat, normalizeLon, roundTo } from '../geo/format';
import { dateFromDayAndMinutes, dayOfYear, daysInYear } from '../geo/sun';
import type { LatLon, Precision } from '../geo/types';
import { clampFlatCenter, flatMinZoom, panFlatCenter } from './geometry';
import type { FlatPreset, FlatProjection, LabControl, LayerFlags, Overlay, SceneSpec, ViewId } from './types';

const PROJECTION_KEY = 'geo-coords:projection';
function initialProjectionPreference(): FlatProjection {
  const stored = readString(PROJECTION_KEY);
  return stored === 'equal-earth' || stored === 'mercator' ? stored : 'grid';
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
  /** Whether the projection switch shows while a scene sets `flatProjection` (the scene's `projectionSwitch`). */
  projectionSwitch = $state(false);
  /** Bumped by every `applyScene`, so layers can drop per-scene memory (e.g. label hysteresis). */
  sceneVersion = $state(0);

  get flatProjection(): FlatProjection {
    return this.projectionOverride ?? this.projectionPreference;
  }

  setProjectionPreference(p: FlatProjection): void {
    const before = this.flatProjection;
    this.projectionPreference = p;
    writeString(PROJECTION_KEY, p);
    this.refitFlat(before);
  }

  /**
   * The projection switch: changes the remembered preference, or — in a scene that sets its own
   * projection but keeps the switch (`projectionSwitch`) — only this scene's projection.
   */
  chooseProjection(p: FlatProjection): void {
    if (this.projectionOverride === null) { this.setProjectionPreference(p); return; }
    const before = this.flatProjection;
    this.projectionOverride = p;
    this.refitFlat(before);
  }

  /** The smallest zoom of the current flat projection (whole world in view). */
  get flatMinZoom(): number {
    return flatMinZoom(this.flatProjection);
  }

  /** Whether the flat map is bigger than its view, so dragging/arrow keys pan it. */
  get canPanFlat(): boolean {
    return this.flat.zoom > this.flatMinZoom + 1e-9;
  }

  /** Keeps the flat view valid after a projection change; a whole-world view stays a whole-world view. */
  private refitFlat(before: FlatProjection): void {
    if (before === this.flatProjection) return;
    const wasWorld = this.flat.zoom <= flatMinZoom(before) + 1e-9;
    const zoom = wasWorld ? this.flatMinZoom : this.clampZoom(this.flat.zoom);
    this.flat = { zoom, center: this.clampCenter(this.flat.center, zoom) };
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
    this.projectionSwitch = scene.projectionSwitch ?? false;
    this.precision = scene.precision ?? 'degree';
    this.pointEditable = scene.pointEditable ?? false;
    this.showReadout = scene.showReadout ?? true;
    this.point = null;
    if (scene.point) this.setPoint(scene.point, 'program');
    const p = this.point as LatLon | null;
    this.rotate = scene.rotate ? [...scene.rotate] : p ? [-p.lon, -Math.max(-60, Math.min(60, p.lat))] : [0, -20];
    this.globeZoom = Math.max(GLOBE_MIN_ZOOM, Math.min(GLOBE_MAX_ZOOM, scene.globeZoom ?? 1));
    if (scene.flatView) {
      const zoom = this.clampZoom(scene.flatView.zoom);
      this.flat = { zoom, center: this.clampCenter(scene.flatView.center, zoom) };
    } else {
      this.setFlatPreset(scene.flatPreset ?? 'world');
    }
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

  /** The "world" preset is the whole world in every projection (Mercator zooms out further for it). */
  setFlatPreset(preset: FlatPreset): void {
    const v = FLAT_PRESETS[preset];
    const zoom = preset === 'world' ? this.flatMinZoom : this.clampZoom(v.zoom);
    this.flat = { zoom, center: this.clampCenter(v.center, zoom) };
  }

  zoomFlat(factor: number): void {
    const zoom = this.clampZoom(this.flat.zoom * factor);
    this.flat = { zoom, center: this.clampCenter(this.flat.center, zoom) };
  }

  panFlat(dLat: number, dLon: number): void {
    const c = this.flat.center;
    this.flat = { zoom: this.flat.zoom, center: this.clampCenter({ lat: c.lat + dLat, lon: c.lon + dLon }, this.flat.zoom) };
  }

  /** Pans by (dx, dy) units of the 960-wide flat view, dy > 0 towards the north (see `panFlatCenter`). */
  panFlatBy(dx: number, dy: number): void {
    this.flat = { zoom: this.flat.zoom, center: panFlatCenter(this.flat.center, this.flat.zoom, this.flatProjection, dx, dy) };
  }

  private clampZoom(zoom: number): number {
    return Math.max(this.flatMinZoom, Math.min(MAX_ZOOM, zoom));
  }

  private clampCenter(c: LatLon, zoom: number): LatLon {
    return clampFlatCenter(c, zoom, this.flatProjection);
  }
}

export const mapState = new MapState();
