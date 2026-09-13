import { untrack } from 'svelte';
import { motionReduced } from '../app/settings.svelte';
import { readString, writeString } from '../app/storage';
import { clampLat, normalizeLon, roundTo } from '../geo/format';
import { dateFromDayAndMinutes, dayOfYear, daysInYear } from '../geo/sun';
import type { LatLon, Precision } from '../geo/types';
import { clampFlatCenter, flatMinZoom, panFlatCenter } from './geometry';
import type { FlatPreset, FlatProjection, LabControl, LayerFlags, Overlay, Readout, SceneSpec, ViewId } from './types';

const PROJECTION_KEY = 'geo-coords:projection';
/**
 * The projections a pupil's choice is remembered for. Mercator is not one of them: zoomed out to the
 * whole world it is half as wide as the view, which would shrink every world map in topics 1–8 and
 * Practise — choosing it applies to the current scene only.
 */
export type SavedProjection = Exclude<FlatProjection, 'mercator'>;
function initialProjectionPreference(): SavedProjection {
  return readString(PROJECTION_KEY) === 'equal-earth' ? 'equal-earth' : 'grid';
}

export type ChangeSource = 'map' | 'slider' | 'program';

export const DEFAULT_LAYERS: LayerFlags = {
  graticuleStep: 10, specialLines: true, tropics: false, hemispheres: 'none',
  places: true, borders: true, daylight: false, pointGuides: true, schools: false,
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
/** With `precision: 'auto'`, the point snaps to minutes from this flat or globe zoom on, to degrees below. */
export const MINUTE_ZOOM = 12;

export class MapState {
  views = $state<ViewId[]>(['globe', 'flat']);
  layers = $state<LayerFlags>({ ...DEFAULT_LAYERS });
  point = $state<LatLon | null>({ lat: 52, lon: 21 });
  pointEditable = $state(true);
  /** The scene's precision setting; `precision` is what snapping and the readout actually use. */
  precisionMode = $state<Precision | 'auto'>('degree');
  showReadout = $state(true);
  readout = $state<Readout>('letters');
  rotate = $state<[number, number]>([-21, -30]);
  globeZoom = $state(1);
  flat = $state<{ center: LatLon; zoom: number }>({ center: { lat: 0, lon: 0 }, zoom: 1 });
  overlays = $state<Overlay[]>([]);
  sun = $state<{ utcMinutes: number; dayOfYear: number; year: number } | null>(null);
  labControls = $state<LabControl[]>([]);
  phoneView = $state<ViewId>('flat');
  lastChange = $state<ChangeSource>('program');
  projectionPreference = $state<SavedProjection>(initialProjectionPreference());
  /** The projection the scene sets (`SceneSpec.flatProjection`), if any. */
  projectionOverride = $state<FlatProjection | null>(null);
  /** A projection picked with the switch that lasts until the next `applyScene` (Mercator, or any pick in a scene with its own projection). */
  projectionChoice = $state<FlatProjection | null>(null);
  /** Whether the projection switch shows while a scene sets `flatProjection` (the scene's `projectionSwitch`). */
  projectionSwitch = $state(false);
  /** Whether the scene offers the Maple Bear schools switch (`SceneSpec.schoolsToggle`). */
  schoolsToggle = $state(false);
  /**
   * View units per CSS px as the flat map and the globe last drew them (plain, not reactive: set by
   * the views, read only when a school is chosen from the list to work out how close to zoom in).
   */
  viewPx: { flat: number; globe: number } = { flat: 1, globe: 1 };
  /** Bumped by every `applyScene`, so layers can drop per-scene memory (e.g. label hysteresis). */
  sceneVersion = $state(0);

  /**
   * Degrees or minutes. A free-play scene's `'auto'` follows the zoom: zoomed in to 12 or more on the
   * flat map or the globe, a pixel is far less than a degree, so the point snaps to minutes.
   * A plain getter (no stored copy), so nothing has to be kept in sync by an effect.
   */
  get precision(): Precision {
    if (this.precisionMode !== 'auto') return this.precisionMode;
    return this.flat.zoom >= MINUTE_ZOOM || this.globeZoom >= MINUTE_ZOOM ? 'minute' : 'degree';
  }

  set precision(p: Precision | 'auto') {
    this.precisionMode = p;
  }

  get flatProjection(): FlatProjection {
    return this.projectionChoice ?? this.projectionOverride ?? this.projectionPreference;
  }

  setProjectionPreference(p: SavedProjection): void {
    const before = this.flatProjection;
    this.projectionPreference = p;
    this.projectionChoice = null;
    writeString(PROJECTION_KEY, p);
    this.refitFlat(before);
  }

  /**
   * The projection switch. Grid map / Equal Earth become the remembered preference; Map app
   * (Mercator) — and any pick in a scene that sets its own projection but keeps the switch
   * (`projectionSwitch`) — applies to the current scene only: the next `applyScene` goes back.
   */
  chooseProjection(p: FlatProjection): void {
    if (this.projectionOverride === null && p !== 'mercator') { this.setProjectionPreference(p); return; }
    const before = this.flatProjection;
    this.projectionChoice = p;
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
    this.projectionChoice = null;
    this.projectionSwitch = scene.projectionSwitch ?? false;
    this.precision = scene.precision ?? 'degree';
    this.pointEditable = scene.pointEditable ?? false;
    this.showReadout = scene.showReadout ?? true;
    this.readout = scene.readout ?? 'letters';
    this.globeZoom = Math.max(GLOBE_MIN_ZOOM, Math.min(GLOBE_MAX_ZOOM, scene.globeZoom ?? 1));
    if (scene.flatView) {
      const zoom = this.clampZoom(scene.flatView.zoom);
      this.flat = { zoom, center: this.clampCenter(scene.flatView.center, zoom) };
    } else {
      this.setFlatPreset(scene.flatPreset ?? 'world');
    }
    // After the zooms: with `precision: 'auto'` the point snaps by this scene's zoom, not the last one's.
    this.point = null;
    if (scene.point) this.setPoint(scene.point, 'program');
    const p = this.point as LatLon | null;
    this.rotate = scene.rotate ? [...scene.rotate] : p ? [-p.lon, -Math.max(-60, Math.min(60, p.lat))] : [0, -20];
    this.overlays = [...(scene.overlays ?? [])];
    this.sun = scene.sun ? { ...scene.sun, year: new Date().getUTCFullYear() } : null;
    this.labControls = [...(scene.labControls ?? [])];
    this.schoolsToggle = scene.schoolsToggle ?? false;
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

  /** Rounds to the scene's precision — or, when the readout shows decimals, to 4 decimals like a map app. */
  setPoint(p: LatLon, source: ChangeSource = 'program'): void {
    if (this.readout === 'letters') {
      this.point = { lat: clampLat(roundTo(p.lat, this.precision)), lon: normalizeLon(roundTo(p.lon, this.precision)) };
    } else {
      // Normalized first: wrapping with % 360 after rounding would bring back float noise (19.0238 → 19.023799999999994).
      const round4 = (v: number) => Math.round(v * 1e4) / 1e4 + 0;
      const lon = round4(normalizeLon(p.lon));
      this.point = { lat: round4(clampLat(p.lat)), lon: lon <= -180 ? 180 : lon };
    }
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

  setGlobeZoom(zoom: number): void {
    this.globeZoom = Math.max(GLOBE_MIN_ZOOM, Math.min(GLOBE_MAX_ZOOM, zoom));
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

  /** Centres the flat map on `center` at `zoom` (both kept within the world). */
  setFlatView(center: LatLon, zoom: number): void {
    const z = this.clampZoom(zoom);
    this.flat = { zoom: z, center: this.clampCenter(center, z) };
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
