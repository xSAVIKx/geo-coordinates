// Shared metadata for the equator/prime-meridian/tropic label positions, used both by
// SpecialLines.svelte (to draw them) and Places.svelte (to treat them as fixed obstacles for the
// place-label collision pass in labelLayout.ts) so the two layers can never disagree about where
// a special-line label actually sits.
import type { LatLon } from '../geo/types';
import { POLAR, TROPIC } from './geometry';
import type { LayerFlags, Overlay } from './types';

export interface LineLabelSpec { id: string; cls: string; labelKey: string; labelAt: LatLon; vertical: boolean }

const SPECIAL: readonly LineLabelSpec[] = [
  { id: 'eq', cls: 'equator', labelKey: 'line.equator', labelAt: { lat: 0, lon: -150 }, vertical: false },
  { id: 'pm', cls: 'prime', labelKey: 'line.prime', labelAt: { lat: -50, lon: 0 }, vertical: true },
  { id: 'am', cls: 'antimeridian', labelKey: 'line.antimeridian', labelAt: { lat: -50, lon: 180 }, vertical: true },
];
const TROPICS: readonly LineLabelSpec[] = [
  { id: 'tc', cls: 'tropic', labelKey: 'line.tropicCancer', labelAt: { lat: TROPIC, lon: -150 }, vertical: false },
  { id: 'tk', cls: 'tropic', labelKey: 'line.tropicCapricorn', labelAt: { lat: -TROPIC, lon: -150 }, vertical: false },
  { id: 'ac', cls: 'polar', labelKey: 'line.arcticCircle', labelAt: { lat: POLAR, lon: -150 }, vertical: false },
  { id: 'aa', cls: 'polar', labelKey: 'line.antarcticCircle', labelAt: { lat: -POLAR, lon: -150 }, vertical: false },
];

/** The special-line labels currently shown, in the same order SpecialLines.svelte renders them. */
export function lineLabelSpecs(layers: Pick<LayerFlags, 'specialLines' | 'tropics'>): LineLabelSpec[] {
  return [...(layers.specialLines ? SPECIAL : []), ...(layers.tropics ? TROPICS : [])];
}

/** Where a label actually renders: on the globe a non-vertical label follows the visible centre. */
export function lineLabelPoint(spec: LineLabelSpec, kind: 'flat' | 'globe', rotateLambda: number): LatLon {
  if (kind === 'globe' && !spec.vertical) return { lat: spec.labelAt.lat, lon: -rotateLambda - 35 };
  return spec.labelAt;
}

/**
 * The special lines a scene is about, whose names must stay on the map: the equator when the scene shades
 * the northern and southern hemispheres or highlights the parallel 0°, the prime meridian when it shades
 * the eastern and western hemispheres or highlights the meridian 0°, the 180° meridian when it highlights it.
 */
export function namedLines(layers: Pick<LayerFlags, 'hemispheres'>, overlays: readonly Overlay[]): Set<string> {
  const out = new Set<string>();
  if (layers.hemispheres === 'ns') out.add('eq');
  if (layers.hemispheres === 'ew') out.add('pm');
  for (const o of overlays) {
    if (o.kind !== 'highlight-line') continue;
    if (o.axis === 'lat' && o.value === 0) out.add('eq');
    if (o.axis === 'lon' && o.value === 0) out.add('pm');
    if (o.axis === 'lon' && Math.abs(o.value) === 180) out.add('am');
  }
  return out;
}
