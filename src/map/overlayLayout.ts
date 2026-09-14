// Where overlay and line texts sit, shared by the layers that draw them (Overlays.svelte,
// SpecialLines.svelte) and the ones that must keep clear of them (Places.svelte), so they never
// disagree: marker labels, the bracket columns, the "Noon 12:00" label and the special-line labels.
import { bracketModel, EDGE_BOTTOM, EDGE_LEFT, labelWidth, type Formatter } from './brackets';
import type { ViewCtx } from './geometry';
import { overlaps, rotateBoxAround, textBox, type LabelBox } from './labelLayout';
import { lineLabelPoint, type LineLabelSpec } from './lineLabels';
import { labelBox, labelPlaces, type LabelPlace } from './markerLabel';
import type { Overlay } from './types';

type Ctx = Pick<ViewCtx, 'kind' | 'width' | 'height' | 'px' | 'project'>;

/** Marker label font size (CSS px): smaller on a phone-sized map, so two nearby markers' labels still fit. */
export function markerLabelSize(ctx: Pick<ViewCtx, 'width' | 'px'>): number {
  return ctx.width / ctx.px < 480 ? 13 : 15;
}

export interface MarkerLayout {
  size: number;
  /** Per overlay index: where its label goes (meaningful only for labelled markers). */
  places: LabelPlace[];
  /** Label boxes of the labelled markers in view. */
  labels: LabelBox[];
  /** The marker symbols in view. */
  symbols: LabelBox[];
  /** Width (CSS px, at least 16) of the widest marker label: room a bracket right of the markers leaves for them. */
  room: number;
}

/** Marker labels placed clear of each other and of the marker symbols (see `labelPlaces`). */
export function markerLayout(overlays: readonly Overlay[], ctx: Ctx, text: (o: Overlay & { kind: 'marker' }) => string): MarkerLayout {
  const size = markerLabelSize(ctx);
  const spots = overlays.map((o) => {
    if (o.kind !== 'marker') return null;
    const xy = ctx.project(o.p);
    return xy ? { x: xy[0], y: xy[1], width: text(o) ? labelWidth(text(o), size, ctx.px) : 0, labelled: !!text(o) } : null;
  });
  const places = labelPlaces(spots.map((s) => (s && s.labelled ? s : null)), size, ctx.px, ctx.kind === 'flat' ? ctx.width : Infinity);
  const r = 9 * ctx.px;
  const labels: LabelBox[] = [];
  const symbols: LabelBox[] = [];
  spots.forEach((s, i) => {
    if (!s) return;
    symbols.push({ left: s.x - r, right: s.x + r, top: s.y - r, bottom: s.y + r });
    if (s.labelled) labels.push(labelBox(s, places[i]!, size, ctx.px));
  });
  const room = Math.max(16, ...overlays.map((o) => (o.kind === 'marker' && text(o) ? labelWidth(text(o), size, 1) : 0)));
  return { size, places, labels, symbols, room };
}

/** The areas the bracket overlays cover: one box per stroke of a bracket and per number beside it. */
export function bracketBoxes(overlays: readonly Overlay[], ctx: ViewCtx, fmt: Formatter, labelRoomPx: number): LabelBox[] {
  const out: LabelBox[] = [];
  for (const o of overlays) {
    if (o.kind !== 'lat-diff' && o.kind !== 'lon-diff' && o.kind !== 'distance') continue;
    const m = bracketModel(o, ctx, fmt, labelRoomPx);
    if (!m) continue;
    out.push(...m.paths.flatMap((d) => pathBox(d)), ...m.labels.map((l) => textBox(l.x, l.y, labelWidth(l.text, l.size, ctx.px), l.size * ctx.px, l.anchor)));
  }
  return out;
}

/** Bounding box of an SVG path made of M/L/H/V/h/v commands (absolute or relative), padded by 3 units. */
export function pathBox(d: string): LabelBox[] {
  let x = 0, y = 0;
  const xs: number[] = [], ys: number[] = [];
  for (const [, cmd, args] of d.matchAll(/([MLHVZmlhvz])([^MLHVZmlhvz]*)/g)) {
    const n = (args!.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
    switch (cmd) {
      case 'M': case 'L': for (let i = 0; i + 1 < n.length; i += 2) { x = n[i]!; y = n[i + 1]!; xs.push(x); ys.push(y); } break;
      case 'm': case 'l': for (let i = 0; i + 1 < n.length; i += 2) { x += n[i]!; y += n[i + 1]!; xs.push(x); ys.push(y); } break;
      case 'H': for (const v of n) { x = v; xs.push(x); ys.push(y); } break;
      case 'h': for (const v of n) { x += v; xs.push(x); ys.push(y); } break;
      case 'V': for (const v of n) { y = v; xs.push(x); ys.push(y); } break;
      case 'v': for (const v of n) { y += v; xs.push(x); ys.push(y); } break;
    }
  }
  if (!xs.length) return [];
  return [{ left: Math.min(...xs) - 3, right: Math.max(...xs) + 3, top: Math.min(...ys) - 3, bottom: Math.max(...ys) + 3 }];
}

export const NOON_LABEL = 15;
export interface NoonLabel { x: number; y: number; anchor: 'start' | 'end'; box: LabelBox }

/**
 * Where "Noon 12:00" goes beside the noon meridian at longitude `lon`: tried at a few latitudes (35°,
 * 15°, 55°, −20°, −40°, 70° and last 0°, where it would sit on the equator), right of the line and then left of it, the first spot inside the view
 * and clear of `obstacles` (marker symbols and labels, brackets, line labels) wins; when none is free,
 * the first spot inside the view.
 */
export function noonLabel(ctx: Ctx, lon: number, width: number, obstacles: readonly LabelBox[]): NoonLabel | null {
  const px = ctx.px;
  const top = 24 * px, bottom = ctx.height - (ctx.kind === 'flat' ? EDGE_BOTTOM + 4 : 12) * px;
  let fallback: NoonLabel | null = null;
  for (const lat of [35, 15, 55, -20, -40, 70, 0]) {
    const xy = ctx.project({ lat, lon });
    if (!xy || xy[1] <= top || xy[1] >= bottom) continue;
    const preferLeft = xy[0] > ctx.width - 110 * px;
    for (const left of preferLeft ? [true, false] : [false, true]) {
      const x = xy[0] + (left ? -8 : 8) * px;
      const anchor = left ? 'end' : 'start';
      const box = textBox(x, xy[1], width, NOON_LABEL * px, anchor);
      const inside = box.left >= (ctx.kind === 'flat' ? EDGE_LEFT * px : 0) && box.right <= ctx.width - 2 * px;
      const spot = { x, y: xy[1], anchor, box } as const;
      if (!fallback && (inside || left === preferLeft)) fallback = spot;
      if (inside && !obstacles.some((o) => overlaps(box, o))) return spot;
    }
  }
  return fallback;
}

export const LINE_LABEL = 12;
export interface PlacedLineLabel { spec: LineLabelSpec; x: number; y: number; vertical: boolean; box: LabelBox }

/**
 * Special-line labels (equator, tropics, prime meridian…), clear of what is in `avoid` (brackets and
 * marker labels) where they can be. A flat map's horizontal label stays inside the view, right of the
 * latitude numbers (a view that does not reach its usual longitude would cut it), and slides east past
 * anything in its way; one that would touch an earlier horizontal name is left out. A vertical label runs up beside its meridian — the prime meridian's on its right,
 * the 180° one's on its left — moves to the other side when that side is taken, and is left out when both
 * are (the line keeps its colour, dash pattern and edge number).
 */
export function placeLineLabels(specs: readonly LineLabelSpec[], ctx: Ctx & { rotateLambda: number }, widthOf: (spec: LineLabelSpec) => number, avoid: readonly LabelBox[] = []): PlacedLineLabel[] {
  const px = ctx.px, size = LINE_LABEL * px;
  const out: PlacedLineLabel[] = [];
  for (const spec of specs) {
    const xy = ctx.project(lineLabelPoint(spec, ctx.kind, ctx.rotateLambda));
    if (!xy) continue;
    const w = widthOf(spec);
    const y = xy[1] - 5 * px;
    if (!spec.vertical) {
      let x = xy[0] + 4 * px;
      if (ctx.kind === 'flat') {
        const minX = EDGE_LEFT * px, maxX = ctx.width - w - 4 * px;
        if (minX <= maxX) {
          x = Math.max(minX, Math.min(maxX, x));
          for (let tries = 0; tries < 4; tries++) {
            const hit = avoid.filter((a) => overlaps(textBox(x, y, w, size, 'start'), a));
            if (!hit.length) break;
            const next = Math.max(...hit.map((a) => a.right)) + 6 * px;
            if (next > maxX) break;
            x = next;
          }
        }
      }
      const box = textBox(x, y, w, size, 'start');
      // On a small map the tropics' and polar circles' names would pile onto the equator's: a later one that touches an earlier name is left out.
      if (out.some((l) => !l.vertical && overlaps(box, l.box))) continue;
      out.push({ spec, x, y, vertical: false, box });
      continue;
    }
    // On a flat map the name runs up from its latitude, kept above the longitude numbers and below the
    // top edge (a Mercator view may not reach −50°); a name longer than the map is left out.
    let vy = y;
    if (ctx.kind === 'flat') {
      const low = ctx.height - (EDGE_BOTTOM + 2) * px, high = w + 4 * px;
      if (high > low) continue;
      vy = Math.max(high, Math.min(low, y));
    }
    const sides = spec.cls === 'prime' ? [15, -5] : [-5, 15];
    const options = sides.map((dx) => {
      const x = xy[0] + dx * px;
      return { x, box: rotateBoxAround(textBox(x, vy, w, size, 'start'), x, vy, -90) };
    });
    const pick = avoid.length ? options.find((o) => !avoid.some((a) => overlaps(o.box, a))) : options[0];
    if (pick) out.push({ spec, x: pick.x, y: vy, vertical: true, box: pick.box });
  }
  return out;
}
