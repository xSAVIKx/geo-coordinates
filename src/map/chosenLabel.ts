// Where the name of the school chosen from a list goes (Task 23b): always fully inside the view and
// never under a count badge. Pure geometry, shared by the map (layers/Layers.svelte) and the tests.
import type { LatLon } from '../geo/types';
import type { ViewCtx } from './geometry';
import { overlaps, pointBox, type LabelBox } from './labelLayout';
import { chosenSchoolMark, clearOfChosen, clusterSchools, SCHOOL_BADGE_H, schoolBadgeWidth, type School, type SchoolCluster } from './schools';

export const CHOSEN_FONT = 12.5;
/** Line height of a wrapped chosen name, in CSS px. */
export const CHOSEN_LINE = 15;
// Wider than the other labels' estimate: the chosen name is heavy (800), and the box must hold the real text.
const CHOSEN_CHAR_EM = 0.66;
/** Room kept between the name and the view's edges, in CSS px. */
const EDGE_GAP = 4;
/** Room above and below the text inside its box, in CSS px: the drawn glyphs' box is a little taller than the model's lines. */
const PAD = 1.5;
/** The flat map's band of longitude numbers along its bottom edge, in CSS px (EdgeLabels.svelte). */
const FLAT_BOTTOM_BAND = 18;

export function chosenTextWidth(text: string, px: number): number {
  return (text.length * CHOSEN_CHAR_EM + 0.4) * CHOSEN_FONT * px;
}

export interface ChosenLabel {
  id: string;
  lines: string[];
  /** Anchor point of the first line's baseline; later lines follow CHOSEN_LINE px apart. */
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  box: LabelBox;
}

/** A name broken at spaces into `n` lines of about equal length (or fewer when it has fewer words). */
export function wrapName(name: string, n: number): string[] {
  const words = name.split(' ');
  if (n <= 1 || words.length === 1) return [name];
  const target = Math.ceil(name.length / n);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && next.length > target && lines.length < n - 1) { lines.push(line); line = w; } else line = next;
  }
  lines.push(line);
  return lines;
}

type Position = 'above' | 'below' | 'ne' | 'nw' | 'se' | 'sw' | 'right' | 'left';
const POSITIONS: readonly Position[] = ['above', 'below', 'ne', 'nw', 'se', 'sw', 'right', 'left'];

/** The block of `lines` at a position round (x, y): its box, and where its text is anchored. */
function block(x: number, y: number, lines: string[], position: Position, px: number): Omit<ChosenLabel, 'id' | 'lines'> {
  const w = Math.max(...lines.map((l) => chosenTextWidth(l, px)));
  const h = blockHeight(lines.length, px);
  // Offsets clear the chosen square's ring (12 px) and the point's ring (13 px).
  let left: number, top: number;
  switch (position) {
    case 'above': left = x - w / 2; top = y - 16 * px - h; break;
    case 'below': left = x - w / 2; top = y + 16 * px; break;
    case 'ne': left = x + 10 * px; top = y - 14 * px - h; break;
    case 'nw': left = x - 10 * px - w; top = y - 14 * px - h; break;
    case 'se': left = x + 10 * px; top = y + 14 * px; break;
    case 'sw': left = x - 10 * px - w; top = y + 14 * px; break;
    case 'right': left = x + 16 * px; top = y - h / 2; break;
    case 'left': left = x - 16 * px - w; top = y - h / 2; break;
  }
  return blockAt(left, top, w, lines.length, px);
}

const blockHeight = (count: number, px: number) => (count * CHOSEN_LINE + 2 * PAD) * px;

function blockAt(left: number, top: number, w: number, count: number, px: number): Omit<ChosenLabel, 'id' | 'lines'> {
  // A drawn line's box runs from 0.95 em above its baseline to 0.25 em below it (1.2 em = one CHOSEN_LINE).
  const box = { left, right: left + w, top, bottom: top + blockHeight(count, px) };
  return { x: left + w / 2, y: top + (PAD + CHOSEN_FONT * 0.95) * px, anchor: 'middle', box };
}

const inside = (b: LabelBox, bounds: LabelBox) => b.left >= bounds.left && b.right <= bounds.right && b.top >= bounds.top && b.bottom <= bounds.bottom;

export interface ChosenLabelInput {
  x: number;
  y: number;
  name: string;
  px: number;
  /** The name stays inside this box. */
  bounds: LabelBox;
  /** Never covered where it can be helped at all: the rings of the chosen square and of the point. */
  hard: readonly LabelBox[];
  /** Kept clear when possible, most important first: dropped from the end when nothing fits. */
  soft: readonly (readonly LabelBox[])[];
}

/**
 * Tries, from all obstacles down to the hard ones only: the whole name on one line, then wrapped on
 * two lines, at each position round the school, and takes the first block that lies inside `bounds`
 * and is clear; then the same with three and four lines. When none is, the narrowest block goes above (or below) the school,
 * slid inside `bounds`.
 */
export function layoutChosenLabel(input: ChosenLabelInput): Omit<ChosenLabel, 'id'> {
  const { x, y, name, px, bounds, hard, soft } = input;
  const maxW = bounds.right - bounds.left;
  const layouts = [1, 2, 3, 4].map((n) => wrapName(name, n)).filter((l, i, all) => i === 0 || l.length !== all[i - 1]!.length);
  const fitting = layouts.filter((l) => Math.max(...l.map((s) => chosenTextWidth(s, px))) <= maxW);
  // Short blocks (one or two lines) at every level of obstacles first; taller ones only after that.
  for (const tall of [false, true]) for (let k = soft.length; k >= 0; k--) {
    const obstacles = [...hard, ...soft.slice(0, k).flat()];
    for (const lines of fitting.filter((l) => (l.length > 2) === tall)) {
      for (const position of POSITIONS) {
        const b = block(x, y, lines, position, px);
        if (inside(b.box, bounds) && !obstacles.some((o) => overlaps(b.box, o))) return { lines, ...b };
      }
    }
  }
  const lines = layouts.reduce((best, l) => (Math.max(...l.map((s) => chosenTextWidth(s, px))) < Math.max(...best.map((s) => chosenTextWidth(s, px))) ? l : best));
  const w = Math.min(maxW, Math.max(...lines.map((s) => chosenTextWidth(s, px))));
  const h = blockHeight(lines.length, px);
  const left = Math.max(bounds.left, Math.min(bounds.right - w, x - w / 2));
  const above = y - 16 * px - h;
  const top = above >= bounds.top ? above : Math.max(bounds.top, Math.min(bounds.bottom - h, y + 16 * px));
  return { lines, ...blockAt(left, top, w, lines.length, px) };
}

/** A count badge's box (with a pixel of room), in view units. */
export function badgeBox(c: { x: number; y: number; members: readonly unknown[] }, px: number): LabelBox {
  const halfW = (schoolBadgeWidth(c.members.length) / 2 + 1) * px, halfH = (SCHOOL_BADGE_H / 2 + 1) * px;
  return { left: c.x - halfW, right: c.x + halfW, top: c.y - halfH, bottom: c.y + halfH };
}

/**
 * Badges still under the chosen name move just above or below it (the nearer side first), or else
 * beside it — wherever they stay off the chosen school's square too. Squares stay where they are.
 */
export function clearOfLabel(clusters: SchoolCluster[], box: LabelBox, square: LabelBox, px: number): SchoolCluster[] {
  const gap = 2 * px;
  return clusters.map((c) => {
    const own = badgeBox(c, px);
    if (c.members.length < 2 || !overlaps(own, box)) return c;
    const halfW = (own.right - own.left) / 2, halfH = (own.bottom - own.top) / 2;
    const up = c.y <= (box.top + box.bottom) / 2;
    const spots = [
      { x: c.x, y: up ? box.top - halfH - gap : box.bottom + halfH + gap },
      { x: c.x, y: up ? box.bottom + halfH + gap : box.top - halfH - gap },
      { x: box.left - halfW - gap, y: c.y },
      { x: box.right + halfW + gap, y: c.y },
    ];
    const spot = spots.find((p) => !overlaps(badgeBox({ ...c, ...p }, px), square)) ?? spots[0]!;
    return { ...c, ...spot };
  });
}

export interface SchoolLayout {
  clusters: SchoolCluster[];
  chosen: { x: number; y: number; school: School } | null;
  label: ChosenLabel | null;
}

/**
 * Everything the schools layer draws in one view: the groups (clear of the chosen school and its
 * name), the chosen school and its name. `point`/`guides`: the movable point and whether its dashed
 * guide lines are drawn (the name keeps off them when it can).
 */
export function layoutSchools(ctx: ViewCtx, chosenId: string | null, point: LatLon | null, guides: boolean): SchoolLayout {
  const chosen = chosenSchoolMark(ctx, chosenId);
  let clusters = clearOfChosen(clusterSchools(ctx, chosenId), chosen, ctx.px);
  const px = ctx.px;
  if (!chosen || chosen.x < 0 || chosen.x > ctx.width || chosen.y < 0 || chosen.y > ctx.height) return { clusters, chosen, label: null };
  const pxy = point ? ctx.project(point) : null;
  const hard: LabelBox[] = [{ left: chosen.x - 12 * px, right: chosen.x + 12 * px, top: chosen.y - 12 * px, bottom: chosen.y + 12 * px }];
  if (pxy) hard.push(pointBox(pxy[0], pxy[1], px));
  const far = 1e7;
  const guideBoxes: LabelBox[] = guides && pxy
    ? [{ left: pxy[0] - 3 * px, right: pxy[0] + 3 * px, top: -far, bottom: far }, { left: -far, right: far, top: pxy[1] - 3 * px, bottom: pxy[1] + 3 * px }]
    : [];
  const gap = EDGE_GAP * px;
  const bounds: LabelBox = { left: gap, top: gap, right: ctx.width - gap, bottom: ctx.height - (ctx.kind === 'flat' ? FLAT_BOTTOM_BAND * px : gap) };
  const badges = clusters.filter((c) => c.members.length > 1).map((c) => badgeBox(c, px));
  const label = { id: chosen.school.id, ...layoutChosenLabel({ x: chosen.x, y: chosen.y, name: chosen.school.name, px, bounds, hard, soft: [badges, guideBoxes] }) };
  clusters = clearOfLabel(clusters, label.box, hard[0]!, px);
  return { clusters, chosen, label };
}
