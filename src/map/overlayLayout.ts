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
 * Where "Noon 12:00" goes beside the noon meridian at longitude `lon`: tried at latitudes from the middle of a
 * world map outwards (35°, 15°, 55°, 25°, 45°, 5°, −20°, −10°, −30°, −40°, 65°, and 0° last, where it would sit
 * on the equator), right of the line and then left of it; the first spot inside the view and clear of
 * `obstacles` (marker symbols and labels, brackets, line labels) wins; when none is free, the first spot
 * inside the view.
 */
export function noonLabel(ctx: Ctx, lon: number, width: number, obstacles: readonly LabelBox[]): NoonLabel | null {
  const px = ctx.px;
  const top = 24 * px, bottom = ctx.height - (ctx.kind === 'flat' ? EDGE_BOTTOM + 4 : 12) * px;
  let fallback: NoonLabel | null = null;
  for (const lat of [35, 15, 55, 25, 45, 5, -20, -10, -30, -40, 65, 0]) {
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

const grow = (b: LabelBox, d: number): LabelBox => ({ left: b.left - d, right: b.right + d, top: b.top - d, bottom: b.bottom + d });

export const LINE_LABEL = 12;
/** Smallest size (CSS px) a vertical line name shrinks to before it gives up its preferred spot. */
export const LINE_LABEL_MIN = 10;
/** A named line's short name on the smallest maps (a 320 px phone), rather than its whole name cut by the map's edge. */
export const LINE_LABEL_TINY = 9;
export interface PlacedLineLabel {
  spec: LineLabelSpec; x: number; y: number; vertical: boolean; box: LabelBox;
  /** The text, in one or two lines (a vertical name may split before " (…)" or drop it). */
  lines: string[];
  /** Font size in CSS px. */
  size: number;
  /** Distance between the lines' baselines, in view units. */
  lineStep: number;
}
export interface LineLabelOptions {
  /** Names the scene is about (see `namedLines`): never left out; as a last resort drawn where they would be cut. */
  keep?: ReadonlySet<string>;
  /** The flat map's latitude numbers down the left edge: a vertical name slides, shrinks or steps aside from them. */
  edge?: readonly LabelBox[];
}

/** One or two lines to try for a name, longest first: whole, split before " (", then without the parenthesis. */
export function lineLabelVariants(text: string): string[][] {
  const cut = text.indexOf(' (');
  if (cut <= 0) return [[text]];
  return [[text], [text.slice(0, cut), text.slice(cut + 1)], [text.slice(0, cut)]];
}

/**
 * Special-line labels (equator, tropics, prime meridian…), clear of what is in `avoid` (brackets and
 * marker labels) where they can be.
 *
 * A flat map's horizontal label stays inside the view, right of the latitude numbers (a view that does not
 * reach its usual longitude would cut it), and slides east past anything in its way; one that would touch
 * an earlier horizontal name is left out unless the scene is about it (`keep`).
 *
 * A vertical label runs up beside its meridian — the prime meridian's on its right, the 180° one's on its
 * left, or the other side when that one is taken. On a flat map it must fit between the top edge and the
 * longitude numbers and keep clear of the latitude numbers (`edge`) too: it tries, in order, the whole name,
 * two lines split before " (" and the name without the parenthesis (for a name the scene is not about, the
 * one-line short form before the two lines), then the same at smaller sizes (down to
 * `LINE_LABEL_MIN`), each on either side and slid along the line from its usual place. When nothing fits
 * it is left out — unless the scene is about that line, when it takes the spot (of all forms short enough
 * for the map) that covers the least of the obstacles, or failing that the whole name where it used to be,
 * even if the map cuts it.
 */
export function placeLineLabels(specs: readonly LineLabelSpec[], ctx: Ctx & { rotateLambda: number }, textOf: (spec: LineLabelSpec) => string, avoid: readonly LabelBox[] = [], opts: LineLabelOptions = {}): PlacedLineLabel[] {
  const px = ctx.px;
  const keep = opts.keep ?? new Set<string>();
  const out: PlacedLineLabel[] = [];
  const widthOf = (lines: readonly string[], size: number) => Math.max(...lines.map((l) => labelWidth(l, size, px)));
  // Parallels' names first: a meridian's name has more room to move (along its line, either side, smaller), so it steps aside for them.
  for (const spec of [...specs.filter((x) => !x.vertical), ...specs.filter((x) => x.vertical)]) {
    const xy = ctx.project(lineLabelPoint(spec, ctx.kind, ctx.rotateLambda));
    if (!xy) continue;
    const text = textOf(spec);
    const y = xy[1] - 5 * px;
    // Names already placed are obstacles too, with a little room, so two line names never touch.
    const placedBoxes = out.map((l) => grow(l.box, 2 * px));
    if (!spec.vertical) {
      const size = LINE_LABEL * px;
      const w = labelWidth(text, LINE_LABEL, px);
      const blockers = [...avoid, ...placedBoxes.filter((_, i) => out[i]!.vertical)];
      const hits = (x: number, ly: number) => blockers.filter((a) => overlaps(textBox(x, ly, w, size, 'start'), a));
      let x = xy[0] + 4 * px;
      let ly = y;
      if (ctx.kind === 'flat') {
        const minX = EDGE_LEFT * px, maxX = ctx.width - w - 4 * px;
        if (minX <= maxX) {
          x = Math.max(minX, Math.min(maxX, x));
          for (let tries = 0; tries < 4; tries++) {
            const hit = hits(x, y);
            if (!hit.length) break;
            const next = Math.max(...hit.map((a) => a.right)) + 6 * px;
            if (next > maxX) break;
            x = next;
          }
          // Still covered (e.g. by a run of school badges): the clear spot nearest the usual one, anywhere along the line.
          if (hits(x, y).length) {
            const from = Math.max(minX, Math.min(maxX, xy[0] + 4 * px));
            const spots: number[] = [];
            for (let d = 8 * px; from - d >= minX || from + d <= maxX; d += 8 * px) {
              if (from + d <= maxX) spots.push(from + d);
              if (from - d >= minX) spots.push(from - d);
            }
            // No clear spot at all: the one that covers the least of what is in the way (nearest first on a tie).
            const cover = (sx: number) => { const b = textBox(sx, y, w, size, 'start'); return blockers.reduce((sum, a) => sum + Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)), 0); };
            let best = x, bestCover = cover(x);
            for (const sx of spots) {
              const c = cover(sx);
              if (c < bestCover - 1e-9) { best = sx; bestCover = c; }
              if (c === 0) break;
            }
            x = best;
          }
        }
      } else if (hits(x, y).length) {
        // On the globe the name follows the visible middle: try a little further along the parallel instead.
        const at = lineLabelPoint(spec, ctx.kind, ctx.rotateLambda);
        for (const d of [-20, 20, -40, 40, -55]) {
          const q = ctx.project({ lat: at.lat, lon: at.lon + d });
          if (!q) continue;
          const qx = q[0] + 4 * px, qy = q[1] - 5 * px;
          const b = textBox(qx, qy, w, size, 'start');
          if (b.left < 0 || b.right > ctx.width || b.top < 0 || b.bottom > ctx.height) continue;
          if (!hits(qx, qy).length) { x = qx; ly = qy; break; }
        }
      }
      const box = textBox(x, ly, w, size, 'start');
      // On a small map the tropics' and polar circles' names would pile onto the equator's: a later one that touches an earlier name is left out.
      if (!keep.has(spec.id) && out.some((l) => !l.vertical && overlaps(box, l.box))) continue;
      out.push({ spec, x, y: ly, vertical: false, box, lines: [text], size: LINE_LABEL, lineStep: 0 });
      continue;
    }
    const obstacles = [...avoid, ...(opts.edge ?? []), ...placedBoxes];
    // The block of lines rotated −90° around (x, vy): glyph tops point left, later lines step right.
    const block = (lines: readonly string[], size: number, side: 'near' | 'far', vy: number) => {
      const s = size * px, step = size * 1.15 * px, depth = (lines.length - 1) * step, w = widthOf(lines, size);
      const right = (spec.cls === 'prime') === (side === 'near');
      const x = right ? xy[0] + 5.4 * px + 0.8 * s : xy[0] - 2 * px - 0.25 * s - depth;
      const box = rotateBoxAround({ left: x, right: x + w, top: vy - 0.8 * s, bottom: vy + 0.25 * s + depth }, x, vy, -90);
      return { spec, x, y: vy, vertical: true, box, lines: [...lines], size, lineStep: step };
    };
    // A name the scene is about keeps its parenthesis on a second line before losing it; any other name
    // takes the narrower one-line form first, leaving more room beside the line for other labels.
    const variants = lineLabelVariants(text);
    const ordered = keep.has(spec.id) ? variants : [variants[0]!, ...variants.slice(1).reverse()];
    const sizes = [LINE_LABEL, 10.5, LINE_LABEL_MIN];
    // A name the scene is about tries every size with its parenthesis before any size without it, and its short form down to LINE_LABEL_TINY.
    const forms = keep.has(spec.id) && variants.length > 2
      ? [...sizes.flatMap((size) => variants.slice(0, 2).map((lines) => ({ lines, size }))), ...[...sizes, LINE_LABEL_TINY].map((size) => ({ lines: variants[2]!, size }))]
      : sizes.flatMap((size) => ordered.map((lines) => ({ lines, size })));
    if (ctx.kind !== 'flat') {
      // On the globe: beside the meridian at its usual latitude, then a little further along it (on the visible
      // side), in the same forms and sizes as on a flat map; inside the view.
      const along = [0, 15, -15, 30, -30, 45, 60].flatMap((d) => {
        if (d === 0) return [xy];
        const q = ctx.project({ lat: spec.labelAt.lat + d, lon: spec.labelAt.lon });
        return q ? [q] : [];
      });
      const at = (lines: readonly string[], size: number, side: 'near' | 'far', q: [number, number]) => {
        const b = block(lines, size, side, q[1] - 5 * px);
        const dx = q[0] - xy[0];
        return { ...b, x: b.x + dx, box: { ...b.box, left: b.box.left + dx, right: b.box.right + dx } };
      };
      const inView = (o: PlacedLineLabel) => o.box.top >= 0 && o.box.bottom <= ctx.height && o.box.left >= 0 && o.box.right <= ctx.width;
      let pick: PlacedLineLabel | undefined;
      for (const { lines, size } of forms) {
        for (const q of along) {
          pick = (['near', 'far'] as const).map((side) => at(lines, size, side, q)).find((o) => inView(o) && !obstacles.some((a) => overlaps(o.box, a)));
          if (pick) break;
        }
        if (pick) break;
      }
      if (!pick && (keep.has(spec.id) || !obstacles.length)) pick = block([text], LINE_LABEL, 'near', y);
      if (pick) out.push(pick);
      continue;
    }
    const low = ctx.height - (EDGE_BOTTOM + 2) * px, top = 4 * px;
    let placed: PlacedLineLabel | undefined;
    // For a name the scene is about, when no spot is free: the spot that covers the least of the obstacles.
    let leastCovering: { label: PlacedLineLabel; covered: number } | undefined;
    const covered = (b: LabelBox) => obstacles.reduce((sum, a) => sum + Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)), 0);
    for (const { lines, size } of forms) {
      const w = widthOf(lines, size);
      if (w > low - top) continue;
      const preferred = Math.max(top + w, Math.min(low, y));
      // Along the line from the usual place outwards, in 6 px steps.
      const spots = [preferred];
      for (let d = 6 * px; preferred - d >= top + w || preferred + d <= low; d += 6 * px) {
        if (preferred + d <= low) spots.push(preferred + d);
        if (preferred - d >= top + w) spots.push(preferred - d);
      }
      for (const vy of spots) {
        for (const side of ['near', 'far'] as const) {
          const b = block(lines, size, side, vy);
          if (b.box.left < 0 || b.box.right > ctx.width) continue;
          const c = obstacles.length ? covered(b.box) : 0;
          if (c === 0 && !obstacles.some((a) => overlaps(b.box, a))) { placed = b; break; }
          if (keep.has(spec.id) && (!leastCovering || c < leastCovering.covered)) leastCovering = { label: b, covered: c };
        }
        if (placed) break;
      }
      if (placed) break;
    }
    if (!placed && keep.has(spec.id)) placed = leastCovering?.label ?? block([text], LINE_LABEL, 'near', y);
    if (placed) out.push(placed);
  }
  return out.sort((a, b) => specs.indexOf(a.spec) - specs.indexOf(b.spec));
}

/** The flat map's latitude numbers down its left edge (drawn by EdgeLabels.svelte), as boxes. */
export function latEdgeBoxes(ctx: ViewCtx, lats: readonly { y: number; text: string }[]): LabelBox[] {
  return lats.map((l) => textBox(4 * ctx.px, l.y + 4 * ctx.px, labelWidth(l.text, 11, ctx.px), 11 * ctx.px, 'start'));
}

/** Everything outside a view `width` × `height`: a name that touches one of these would be cut. */
export function viewEdgeBoxes(width: number, height: number): LabelBox[] {
  const far = 1e7;
  return [
    { left: -far, right: 0, top: -far, bottom: far }, { left: width, right: far, top: -far, bottom: far },
    { left: -far, right: far, top: -far, bottom: 0 }, { left: -far, right: far, top: height, bottom: far },
  ];
}

/** Continent names are spaced capitals: wider than `labelWidth`'s estimate for ordinary text. */
export const CONTINENT_WIDTH = 1.3;

export interface MapNameSpot { id: string; xy: [number, number]; box: LabelBox }

/**
 * Which continent and ocean names are drawn: only those wholly inside the view — on the globe, also inside
 * its disc (no name overhanging the rim) — and clear of `obstacles` (overlay texts, the point's ring,
 * special-line names). Boxes are centred on `xy` (`text-anchor: middle`).
 */
export function fitMapNames<T extends MapNameSpot>(names: readonly T[], ctx: Pick<ViewCtx, 'kind' | 'width' | 'height'> & { radius?: number }, obstacles: readonly LabelBox[]): T[] {
  return names.filter(({ box }) => {
    if (box.left < 0 || box.right > ctx.width || box.top < 0 || box.bottom > ctx.height) return false;
    if (ctx.kind === 'globe' && ctx.radius !== undefined) {
      const cx = ctx.width / 2, cy = ctx.height / 2;
      const corners: [number, number][] = [[box.left, box.top], [box.right, box.top], [box.left, box.bottom], [box.right, box.bottom]];
      if (corners.some(([x, y]) => Math.hypot(x - cx, y - cy) > ctx.radius!)) return false;
    }
    return !obstacles.some((o) => overlaps(box, o));
  });
}

/** Where the hemisphere names go (Hemispheres.svelte): the flat map's fixed spots; on the globe, 35° from the equator on the visible side. */
const HEMI_AT = { N: { lat: 45, lon: -120 }, S: { lat: -45, lon: -120 }, E: { lat: 60, lon: 90 }, W: { lat: 60, lon: -90 } } as const;
export const HEMI_LABEL = 15;
export function hemisphereLabelSpots(ctx: Pick<ViewCtx, 'kind' | 'projection' | 'project'>, hemispheres: 'none' | 'ns' | 'ew'): { r: 'N' | 'S' | 'E' | 'W'; xy: [number, number] }[] {
  const regions = hemispheres === 'ns' ? (['N', 'S'] as const) : hemispheres === 'ew' ? (['E', 'W'] as const) : [];
  return regions.flatMap((r) => {
    const at = ctx.kind === 'globe' ? { lat: HEMI_AT[r].lat > 0 ? 35 : -35, lon: r === 'E' || r === 'W' ? (r === 'E' ? 90 : -90) : -ctx.projection.rotate()[0] } : HEMI_AT[r];
    const xy = ctx.project(at);
    return xy ? [{ r, xy }] : [];
  });
}

/** Smallest size (CSS px) a hemisphere name shrinks to on a small flat map. */
export const HEMI_LABEL_MIN = 10.5;
/** Room (CSS px) a flat map's eastern and western hemisphere names leave beside the prime meridian, for its name. */
export const HEMI_GUTTER = 22;
export interface HemisphereLabel { r: 'N' | 'S' | 'E' | 'W'; x: number; y: number; size: number; box: LabelBox }

/**
 * The hemisphere names as drawn (Hemispheres.svelte) and kept clear of (the special-line names). On the globe
 * they sit at `hemisphereLabelSpots` at 15 px. On a flat map the eastern and western names each stay inside
 * their own half, leaving `HEMI_GUTTER` px beside the prime meridian so its name fits between them, and shrink
 * (down to `HEMI_LABEL_MIN`) where the half is too narrow — a 320 px phone — instead of running into each other.
 */
export function hemisphereLabels(ctx: Pick<ViewCtx, 'kind' | 'projection' | 'project' | 'width' | 'px'>, hemispheres: 'none' | 'ns' | 'ew', textOf: (r: 'N' | 'S' | 'E' | 'W') => string): HemisphereLabel[] {
  const px = ctx.px;
  const spots = hemisphereLabelSpots(ctx, hemispheres);
  const prime = ctx.project({ lat: 0, lon: 0 });
  // Where each eastern/western name may go on a flat map, and the size that fits it there.
  const span = (r: 'N' | 'S' | 'E' | 'W'): [number, number] | null => {
    if (ctx.kind !== 'flat' || (r !== 'E' && r !== 'W')) return null;
    const edge = 4 * px, gutter = HEMI_GUTTER * px;
    const [from, to] = prime ? (r === 'W' ? [edge, prime[0] - gutter] : [prime[0] + gutter, ctx.width - edge]) : [edge, ctx.width - edge];
    return to > from ? [from, to] : null;
  };
  const fits = spots.map(({ r }) => { const sp = span(r); return sp ? Math.max(HEMI_LABEL_MIN, Math.min(HEMI_LABEL, (sp[1] - sp[0]) / labelWidth(textOf(r), 1, px))) : HEMI_LABEL; });
  // Both names at one size: the smaller of the two, so the pair reads as a pair.
  const size = Math.min(HEMI_LABEL, ...fits);
  return spots.map(({ r, xy }) => {
    const text = textOf(r);
    const sp = span(r);
    const w = labelWidth(text, sp ? size : HEMI_LABEL, px);
    const x = sp ? Math.max(sp[0] + w / 2, Math.min(sp[1] - w / 2, xy[0])) : xy[0];
    const s = sp ? size : HEMI_LABEL;
    return { r, x, y: xy[1], size: s, box: textBox(x, xy[1], w, s * px, 'middle') };
  });
}
