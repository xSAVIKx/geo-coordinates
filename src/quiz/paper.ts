import type { LatLon } from '../geo/types';
import type { Text } from '../i18n/text';
import { CLIP_PAD, clampFlatCenter, makeFlatCtx, type ViewCtx } from '../map/geometry';
import { FLAT_MAX_ZOOM, FLAT_PRESETS } from '../map/mapState.svelte';
import type { SceneSpec } from '../map/types';
import type { Question } from './types';

/*
 * Questions on paper (the printable worksheet). Pure helpers, so the same question always prints the same way.
 */

/** Map text and marker size on paper: view units per CSS px, for a 960-unit map printed about 320 CSS px (85 mm) wide. */
export const PAPER_PX = 3;
/**
 * The paper map is drawn with this margin (view units) around the 960 × 480 view, inside its frame: a line on
 * the view's edge (the 180° meridian of a world map) and edge numbers at the top stay whole and readable.
 * It equals the projection's clip padding, so nothing is drawn past the frame.
 */
export const PAPER_INSET = CLIP_PAD;
/** Markers closer than this on paper (CSS px, centre to centre) would print on top of each other. */
export const PAPER_CROWDED_PX = 12;

/** The flat view a paper scene is drawn with — what MapState.applyScene picks for it on the grid map. */
export function paperView(scene: SceneSpec): ViewCtx {
  const v = scene.flatView ?? FLAT_PRESETS[scene.flatPreset ?? 'world'];
  const zoom = scene.flatView ? Math.max(1, Math.min(FLAT_MAX_ZOOM, v.zoom)) : scene.flatPreset && scene.flatPreset !== 'world' ? v.zoom : 1;
  return makeFlatCtx(960, 480, clampFlatCenter(v.center, zoom, 'grid'), zoom, PAPER_PX, 'grid');
}

/** Whether two of the scene's markers (or a marker and the point) would print on top of each other. */
export function markersCrowded(scene: SceneSpec): boolean {
  const ctx = paperView(scene);
  const spots: LatLon[] = (scene.overlays ?? []).flatMap((o) => (o.kind === 'marker' ? [o.p] : []));
  if (scene.point) spots.push(scene.point);
  const xy = spots.map((p) => ctx.project(p)).filter((v): v is [number, number] => v !== null);
  const min = PAPER_CROWDED_PX * PAPER_PX;
  return xy.some((a, i) => xy.some((b, j) => j > i && Math.hypot(a[0] - b[0], a[1] - b[1]) < min));
}

/** Question types whose text alone (prompt and options with coordinates) can be answered without the map. */
const TEXT_ANSWERABLE = new Set<Question['type']>(['further', 'relative-line', 'difference', 'distance', 'time']);

/**
 * Whether a question needs its map on paper: a point to read or to mark, or overlays that carry the
 * question (markers, highlighted regions). A lone highlighted meridian beside a number question (distance
 * in reverse, time from a duration) adds nothing the text does not already say, so those print without one.
 * Nor do markers that would print on top of each other, when the text alone can be answered.
 */
export function needsMap(q: Question): boolean {
  if (q.type === 'place-point' || q.scene.point) return true;
  // Markers printed on top of each other help nobody; where the text carries the question, print it without the map.
  if (TEXT_ANSWERABLE.has(q.type) && markersCrowded(paperScene(q))) return false;
  const overlays = (q.scene.overlays ?? []).filter((o) => o.kind !== 'noon-meridian');
  if (q.type === 'name-line') return overlays.length > 0;
  return overlays.some((o) => o.kind !== 'highlight-line');
}

/**
 * The question's scene as a still picture: the flat grid map only (a globe scene is drawn flat), no
 * day/night or schools, no noon line, nothing editable. A place-point question shows the grid without
 * the point — the pupil marks it.
 */
export function paperScene(q: Question): SceneSpec {
  const s = q.scene;
  return {
    views: ['flat'],
    flatProjection: 'grid',
    // Spec §5: worksheets and the cheat sheet are Atlas, whatever style is chosen for the screen.
    mapStyle: 'atlas',
    flatView: s.flatView,
    flatPreset: s.flatView ? undefined : s.flatPreset,
    layers: { ...s.layers, daylight: false, schools: false },
    point: q.type === 'place-point' ? null : (s.point ?? null),
    pointEditable: false,
    showReadout: false,
    precision: s.precision === 'auto' ? 'degree' : s.precision,
    overlays: (s.overlays ?? []).filter((o) => o.kind !== 'noon-meridian'),
    sun: null,
  };
}

/** The prompt as printed: "Move the point to …" becomes "Mark the point … on the map". */
export function paperPrompt(q: Question): Text {
  if (q.type === 'place-point' && q.answer.kind === 'coords') {
    const precision = q.input.kind === 'coords' ? q.input.precision : 'degree';
    return { key: 'worksheet.markPoint', params: { coords: { coord: q.answer.value, precision } } };
  }
  return q.prompt;
}
