// The words drawn on overlays, in the page's language — shared by Overlays.svelte (which draws them)
// and the layers that keep clear of them (SpecialLines.svelte, Places.svelte).
import { formatLat } from '../geo/format';
import { i18n, t } from '../i18n/i18n.svelte';
import { formatNumber } from '../i18n/text';
import type { BracketUnit } from './brackets';
import { edgeTicks } from './edgeTicks';
import type { ViewCtx } from './geometry';
import { gridUsesMinutes, resolveGridStep } from './gridStep';
import { lineLabelSpecs, namedLines } from './lineLabels';
import { localizeLabel } from './markerLabel';
import { labelWidth } from './brackets';
import { textBox, type LabelBox } from './labelLayout';
import { bracketBoxes, hemisphereLabels, latEdgeBoxes, markerLayout, placeLineLabels, type PlacedLineLabel } from './overlayLayout';
import type { LayerFlags, Overlay } from './types';

/** A marker's label text: a translated `labelKey`, or `label` in the language's notation. */
export const markerText = (o: { label?: string; labelKey?: string }): string => (o.labelKey ? t(o.labelKey) : o.label ? localizeLabel(o.label, i18n.lang) : '');
export const bracketFmt = (value: number, unit: BracketUnit): string => (unit === 'km' ? t('unit.km', { n: formatNumber(value, i18n.lang) }) : `${formatNumber(value, i18n.lang)}°`);
export const noonText = (): string => `${t('lab.noon')} 12:00`;

/** The flat map's latitude numbers as boxes (empty on the globe), as EdgeLabels.svelte writes them. */
export function sceneLatEdgeBoxes(ctx: ViewCtx, layers: Pick<LayerFlags, 'graticuleStep'>) {
  if (ctx.kind !== 'flat') return [];
  const step = resolveGridStep(layers.graticuleStep, ctx);
  const precision = gridUsesMinutes(step) ? 'minute' : 'degree';
  return latEdgeBoxes(ctx, edgeTicks(ctx, ctx.center, ctx.zoom, step).lats.map((l) => ({ y: l.y, text: formatLat(l.value, i18n.lang, precision) })));
}

/**
 * The special-line names of a scene, placed once for every layer that needs them (SpecialLines.svelte draws
 * them; Overlays.svelte and Places.svelte keep clear of them): clear of brackets, marker labels, hemisphere
 * names and the latitude numbers, and never left out for a line the scene is about. `extra`: more boxes to keep
 * clear of — the Maple Bear count badges and the chosen school's name and square, which are drawn over line names
 * (Layers.svelte hands the same list to every layer, so they all agree).
 */
export function sceneLineLabels(ctx: ViewCtx, layers: LayerFlags, overlays: readonly Overlay[], extra: readonly LabelBox[] = []): PlacedLineLabel[] {
  const m = markerLayout(overlays, ctx, markerText);
  const hemis = hemisphereLabels(ctx, layers.hemispheres, (r) => t(`hemi.${r}`), sceneLatEdgeBoxes(ctx, layers)).map((h) => h.box);
  const avoid = [...bracketBoxes(overlays, ctx, bracketFmt, m.room), ...m.labels, ...hemis, ...extra];
  return placeLineLabels(lineLabelSpecs(layers), { kind: ctx.kind, width: ctx.width, height: ctx.height, px: ctx.px, project: (p) => ctx.project(p), rotateLambda: ctx.projection.rotate()[0] },
    (spec) => t(spec.labelKey), avoid, { keep: namedLines(layers, overlays), edge: sceneLatEdgeBoxes(ctx, layers) });
}
