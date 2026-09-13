import { latDifference, lonDifference } from '../geo/compare';
import { KM_PER_DEGREE } from '../geo/distance';
import { normalizeLon } from '../geo/format';
import type { LatLon } from '../geo/types';
import { meridianLine, type ViewCtx } from './geometry';

// Geometry for the difference / distance overlays ("brackets"), kept out of the Svelte file so the
// label placement can be unit-tested against real projections. Everything is in SVG viewBox units;
// `ctx.px` converts CSS px to viewBox units.

export type BracketOverlay = { kind: 'lat-diff' | 'lon-diff' | 'distance'; a: LatLon; b: LatLon };
export type BracketUnit = 'deg' | 'km';
export type Formatter = (value: number, unit: BracketUnit) => string;

export interface BracketLabel { x: number; y: number; anchor: 'start' | 'middle' | 'end'; size: number; text: string; role: 'total' | 'part' | 'sub' }
export interface BracketModel { paths: string[]; splits: [number, number][]; labels: BracketLabel[] }

export const TOTAL_SIZE = 17;
export const PART_SIZE = 13;
const CHAR_EM = 0.62;
// Room kept free for the flat map's edge labels: latitude numbers on the left, longitude numbers at the bottom.
export const EDGE_LEFT = 64;
export const EDGE_BOTTOM = 20;

/** Estimated rendered width of a label, in viewBox units. */
export function labelWidth(text: string, size: number, px: number): number {
  return (text.length * CHAR_EM + 0.3) * size * px;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Longitude stretches covered by the shorter way from a to b: one, or two when it crosses 180°. */
export function lonSegments(a: number, b: number): [number, number][] {
  const na = normalizeLon(a), nb = normalizeLon(b);
  const lo = Math.min(na, nb), hi = Math.max(na, nb);
  return hi - lo <= 180 ? [[lo, hi]] : [[hi, 180], [-180, lo]];
}

export function parallelSegment(lat: number, from: number, to: number): GeoJSON.LineString {
  const coordinates: [number, number][] = [];
  for (let lon = from; lon < to; lon += 1) coordinates.push([lon, lat]);
  coordinates.push([to, lat]);
  return { type: 'LineString', coordinates };
}

function horizontalFit(label: BracketLabel, ctx: ViewCtx, left: number): BracketLabel {
  const w = labelWidth(label.text, label.size, ctx.px);
  const minX = left + (label.anchor === 'start' ? 0 : label.anchor === 'middle' ? w / 2 : w);
  const maxX = ctx.width - 4 * ctx.px - (label.anchor === 'start' ? w : label.anchor === 'middle' ? w / 2 : 0);
  const y = Math.max(label.size * ctx.px + 2 * ctx.px, Math.min(ctx.height - (ctx.kind === 'flat' ? EDGE_BOTTOM : 4) * ctx.px, label.y));
  return { ...label, x: minX > maxX ? label.x : Math.max(minX, Math.min(maxX, label.x)), y };
}

function flatVertical(o: BracketOverlay, ctx: ViewCtx, fmt: Formatter, labelRoomPx: number): BracketModel | null {
  const px = ctx.px;
  const pa = ctx.project(o.a), pb = ctx.project(o.b);
  if (!pa || !pb) return null;
  const lo = Math.min(o.a.lat, o.b.lat), hi = Math.max(o.a.lat, o.b.lat);
  // Parallels are straight horizontal lines in every flat projection used here, so y depends on latitude only.
  const yOf = (lat: number) => ctx.project({ lat, lon: o.a.lon })![1];
  const yHi = yOf(hi), yLo = yOf(lo);
  const deg = latDifference(lo, hi);
  const opposite = lo < 0 && hi > 0;
  const total = o.kind === 'distance' ? fmt(round1(deg * KM_PER_DEGREE), 'km') : fmt(deg, 'deg');
  const sub = o.kind === 'distance' ? fmt(deg, 'deg') : null;
  const parts = opposite ? [fmt(hi, 'deg'), fmt(-lo, 'deg')] : [];
  const wTotal = Math.max(labelWidth(total, TOTAL_SIZE, px), sub ? labelWidth(sub, PART_SIZE, px) : 0);
  const wParts = Math.max(0, ...parts.map((p) => labelWidth(p, PART_SIZE, px)));
  const partsCol = parts.length ? wParts + 8 * px : 0;
  const minX = Math.min(pa[0], pb[0]), maxX = Math.max(pa[0], pb[0]);
  // Preferred: left of the markers (their labels sit up-right). Columns, left to right: total, parts, bracket.
  const xLeft = minX - 18 * px;
  const roomLeft = xLeft - 8 * px - partsCol - wTotal - EDGE_LEFT * px;
  // Fallback: right of the markers and their labels. Columns: bracket, parts, total.
  const xRight = maxX + (12 + labelRoomPx + 12) * px;
  const roomRight = ctx.width - 4 * px - (xRight + 8 * px + partsCol + wTotal);
  const left = roomLeft >= 0 || roomLeft >= roomRight;
  const x = left ? xLeft : xRight;
  const dir = left ? 1 : -1; // ticks point towards the markers
  const tick = 9 * px;
  const paths = [`M${x},${yHi}V${yLo}`, `M${x},${yHi}h${dir * tick}`, `M${x},${yLo}h${dir * tick}`];
  const splits: [number, number][] = [];
  const labels: BracketLabel[] = [];
  const out = left ? -1 : 1;
  const anchor = left ? 'end' : 'start';
  const edge = left ? EDGE_LEFT * px : 0;
  if (opposite) {
    const y0 = yOf(0);
    splits.push([x, y0]);
    // Each part sits beside the middle of its half; a half too short for a line of text gets its number just past its end
    // instead, away from the split (and from the equator's own label).
    const line = (PART_SIZE + 4) * px;
    const yUp = y0 - yHi >= line ? (yHi + y0) / 2 + 4.5 * px : yHi - 4 * px;
    const yDown = yLo - y0 >= line ? (y0 + yLo) / 2 + 4.5 * px : yLo + (PART_SIZE + 2) * px;
    labels.push({ x: x + out * 8 * px, y: yUp, anchor, size: PART_SIZE, text: parts[0]!, role: 'part' });
    labels.push({ x: x + out * 8 * px, y: yDown, anchor, size: PART_SIZE, text: parts[1]!, role: 'part' });
  }
  const tx = x + out * (8 * px + partsCol);
  // Total (and the degrees under a distance) move together, so clamping to the map never stacks them.
  const tyMin = (TOTAL_SIZE + 2) * px, tyMax = ctx.height - (EDGE_BOTTOM + (sub ? 16 : 0)) * px;
  const ty = Math.max(tyMin, Math.min(tyMax, (yHi + yLo) / 2 + (sub ? -1 : 6) * px));
  labels.push({ x: tx, y: ty, anchor, size: TOTAL_SIZE, text: total, role: 'total' });
  if (sub) labels.push({ x: tx, y: ty + 16 * px, anchor, size: PART_SIZE, text: sub, role: 'sub' });
  return { paths, splits, labels: labels.map((l) => horizontalFit(l, ctx, edge)) };
}

function flatHorizontal(o: BracketOverlay, ctx: ViewCtx, fmt: Formatter): BracketModel | null {
  const px = ctx.px;
  const pa = ctx.project(o.a), pb = ctx.project(o.b);
  if (!pa || !pb) return null;
  const segs = lonSegments(o.a.lon, o.b.lon);
  const crossesZero = segs.length === 1 && segs[0]![0] < 0 && segs[0]![1] > 0;
  const over180 = segs.length === 2;
  const total = fmt(lonDifference(o.a.lon, o.b.lon), 'deg');
  const parts = crossesZero ? [fmt(-segs[0]![0], 'deg'), fmt(segs[0]![1], 'deg')] : over180 ? [fmt(180 - segs[0]![0], 'deg'), fmt(180 + segs[1]![1], 'deg')] : [];
  const rows = (parts.length ? PART_SIZE + 5 : 0) + TOTAL_SIZE;
  // Preferred: above both markers, clear of their labels. Rows, top to bottom: total, parts, bracket.
  const yAbove = Math.min(pa[1], pb[1]) - 34 * px;
  const above = yAbove - (8 + rows) * px >= 2 * px;
  const y = above ? yAbove : Math.max(pa[1], pb[1]) + 18 * px;
  // x of a longitude on this row. Parallels are horizontal, so find the row's latitude once.
  const inv = ctx.projection.invert?.([ctx.width / 2, y]);
  const rowLat = inv && Number.isFinite(inv[1]) ? Math.max(-89, Math.min(89, inv[1])) : Math.max(o.a.lat, o.b.lat);
  const xOf = (lon: number) => ctx.projection([lon, rowLat])![0];
  const tick = 9 * px;
  const down = above ? 1 : -1; // ticks point towards the markers
  const paths: string[] = [];
  const spans = segs.map(([from, to]) => [xOf(from), xOf(to)] as [number, number]);
  for (const [x1, x2] of spans) paths.push(`M${x1},${y}H${x2}`);
  for (const lon of [o.a.lon, o.b.lon]) {
    const n = normalizeLon(lon);
    // A 180° end belongs to whichever segment reaches that side of the map.
    const x = n === 180 && over180 ? xOf(segs[0]![1]) : xOf(n);
    paths.push(`M${x},${y}v${down * tick}`);
  }
  const splits: [number, number][] = [];
  const labels: BracketLabel[] = [];
  const out = above ? -1 : 1;
  const partY = y + out * 8 * px + (above ? 0 : PART_SIZE * px);
  if (crossesZero) {
    const x0 = xOf(0);
    splits.push([x0, y]);
    const [xl, xr] = spans[0]!;
    const wl = labelWidth(parts[0]!, PART_SIZE, px), wr = labelWidth(parts[1]!, PART_SIZE, px);
    labels.push({ x: Math.min((xl + x0) / 2, x0 - wl / 2 - 4 * px), y: partY, anchor: 'middle', size: PART_SIZE, text: parts[0]!, role: 'part' });
    labels.push({ x: Math.max((x0 + xr) / 2, x0 + wr / 2 + 4 * px), y: partY, anchor: 'middle', size: PART_SIZE, text: parts[1]!, role: 'part' });
  } else if (over180) {
    spans.forEach(([x1, x2], i) => labels.push({ x: (x1 + x2) / 2, y: partY, anchor: 'middle', size: PART_SIZE, text: parts[i]!, role: 'part' }));
  }
  const longest = spans.reduce((best, s) => (Math.abs(s[1] - s[0]) > Math.abs(best[1] - best[0]) ? s : best));
  const totalY = parts.length ? partY + out * (PART_SIZE + 5) * px : y + out * 8 * px + (above ? 0 : TOTAL_SIZE * px);
  labels.push({ x: (longest[0] + longest[1]) / 2, y: totalY, anchor: 'middle', size: TOTAL_SIZE, text: total, role: 'total' });
  return { paths, splits, labels: labels.map((l) => horizontalFit(l, ctx, EDGE_LEFT * px)) };
}

function globeModel(o: BracketOverlay, ctx: ViewCtx, fmt: Formatter): BracketModel {
  const px = ctx.px;
  const paths: string[] = [];
  const splits: [number, number][] = [];
  const labels: BracketLabel[] = [];
  const push = (g: GeoJSON.LineString) => { const d = ctx.path(g); if (d) paths.push(d); };
  const at = (p: LatLon) => ctx.project(p);
  if (o.kind === 'lon-diff') {
    // Along a parallel well above both points, with the numbers above it: parts first, the total on top.
    const lat = Math.max(-80, Math.min(80, Math.max(o.a.lat, o.b.lat) + 14));
    const segs = lonSegments(o.a.lon, o.b.lon);
    for (const [from, to] of segs) push(parallelSegment(lat, from, to));
    for (const lon of [o.a.lon, o.b.lon]) push(meridianLine(lon, 1, lat - 3, lat));
    const crossesZero = segs.length === 1 && segs[0]![0] < 0 && segs[0]![1] > 0;
    const splitLon = crossesZero ? 0 : segs.length === 2 ? 180 : null;
    if (splitLon !== null) { const s = at({ lat, lon: splitLon }); if (s) splits.push(s); }
    const d = lonDifference(o.a.lon, o.b.lon);
    const mid = at({ lat, lon: normalizeLon(segs[0]![0] + d / 2) });
    const hasParts = splitLon !== null;
    if (mid) labels.push({ x: mid[0], y: mid[1] - (hasParts ? 28 : 10) * px, anchor: 'middle', size: TOTAL_SIZE, text: fmt(d, 'deg'), role: 'total' });
    if (hasParts) {
      const values = crossesZero ? [-segs[0]![0], segs[0]![1]] : [180 - segs[0]![0], 180 + segs[1]![1]];
      const ranges: [number, number][] = crossesZero ? [[segs[0]![0], 0], [0, segs[0]![1]]] : segs;
      ranges.forEach(([from, to], i) => {
        const p = at({ lat, lon: (from + to) / 2 });
        if (p) labels.push({ x: p[0], y: p[1] - 9 * px, anchor: 'middle', size: PART_SIZE, text: fmt(values[i]!, 'deg'), role: 'part' });
      });
    }
    return { paths, splits, labels };
  }
  const lo = Math.min(o.a.lat, o.b.lat), hi = Math.max(o.a.lat, o.b.lat);
  const lon = o.kind === 'distance' ? o.a.lon - 4 : Math.min(o.a.lon, o.b.lon) - 5;
  push(meridianLine(lon, 1, lo, hi));
  push(parallelSegment(lo, lon, lon + 2));
  push(parallelSegment(hi, lon, lon + 2));
  const deg = latDifference(lo, hi);
  const mid = at({ lat: (lo + hi) / 2, lon });
  if (mid) {
    labels.push({ x: mid[0] - 8 * px, y: mid[1] + (o.kind === 'distance' ? -1 : 6) * px, anchor: 'end', size: TOTAL_SIZE, text: o.kind === 'distance' ? fmt(round1(deg * KM_PER_DEGREE), 'km') : fmt(deg, 'deg'), role: 'total' });
    if (o.kind === 'distance') labels.push({ x: mid[0] - 8 * px, y: mid[1] + 15 * px, anchor: 'end', size: PART_SIZE, text: fmt(deg, 'deg'), role: 'sub' });
  }
  if (lo < 0 && hi > 0) {
    const s = at({ lat: 0, lon });
    if (s) splits.push(s);
    for (const [m, v] of [[hi / 2, hi], [lo / 2, -lo]] as const) {
      const p = at({ lat: m, lon });
      if (p) labels.push({ x: p[0] + 8 * px, y: p[1] + 4.5 * px, anchor: 'start', size: PART_SIZE, text: fmt(v, 'deg'), role: 'part' });
    }
  }
  return { paths, splits, labels };
}

/**
 * Bracket shapes and labels for a `lat-diff`, `lon-diff` or `distance` overlay.
 * `labelRoomPx` is the width (CSS px) of the widest marker label, so a bracket that has to sit on the
 * right of the markers clears their labels.
 */
export function bracketModel(o: BracketOverlay, ctx: ViewCtx, fmt: Formatter, labelRoomPx = 16): BracketModel | null {
  if (ctx.kind === 'globe') return globeModel(o, ctx, fmt);
  return o.kind === 'lon-diff' ? flatHorizontal(o, ctx, fmt) : flatVertical(o, ctx, fmt, labelRoomPx);
}
