import { formatLat, formatLon } from '../geo/format';
import type { LangCode } from '../geo/types';

const PART = /^(\d{1,3})°(?:(\d{1,2})′)?([NSEW])?$/;

/**
 * Marker labels in scenes are written in Latin notation ("52°45′N", "34°S, 151°E"). Rewrites each
 * coordinate part in the language's own notation (UK: "52°45′ пн. ш."); any other label is returned unchanged.
 */
export function localizeLabel(label: string, lang: LangCode): string {
  const parts = label.split(/,\s*/);
  const matches = parts.map((p) => PART.exec(p.trim()));
  if (matches.some((m) => m === null)) return label;
  return matches.map((m, i) => {
    const [, d, min, letter] = m!;
    if (!letter) return parts[i]!.trim();
    const value = (Number(d) + Number(min ?? 0) / 60) * (letter === 'S' || letter === 'W' ? -1 : 1);
    const precision = min === undefined ? 'degree' : 'minute';
    return letter === 'N' || letter === 'S' ? formatLat(value, lang, precision) : formatLon(value, lang, precision);
  }).join(', ');
}

export interface LabelSpot { x: number; y: number; width: number }
export type LabelPlace = 'up-right' | 'down-right' | 'up-left' | 'down-left';
const PLACES: LabelPlace[] = ['up-right', 'down-right', 'up-left', 'down-left'];

/** Box of a marker label placed at `place` (viewBox units). Up: baseline 10 px above the marker; down: top 8 px below it. */
export function labelBox(s: LabelSpot, place: LabelPlace, size: number, px: number) {
  const right = place.endsWith('right');
  const left = right ? s.x + 12 * px : s.x - 12 * px - s.width;
  const top = place.startsWith('up') ? s.y - 10 * px - size * px * 0.8 : s.y + 8 * px;
  return { left, right: left + s.width, top, bottom: top + size * px };
}

/**
 * Where each marker label goes. Labels normally sit up-right of the marker; a label that would cover an
 * earlier label or any marker symbol, or would run off the side of a view `width` wide, tries below-right,
 * then up-left, then below-left (first free spot wins, up-right if none is free). `size` is the font size and
 * `px` the viewBox units per CSS px.
 */
export function labelPlaces(spots: readonly (LabelSpot | null)[], size: number, px: number, width = Infinity): LabelPlace[] {
  type Box = ReturnType<typeof labelBox>;
  const r = 9 * px;
  const symbols: Box[] = spots.flatMap((s) => (s ? [{ left: s.x - r, right: s.x + r, top: s.y - r, bottom: s.y + r }] : []));
  const labels: Box[] = [];
  const hits = (b: Box) => b.left < 0 || b.right > width || [...labels, ...symbols].some((o) => b.left < o.right && o.left < b.right && b.top < o.bottom && o.top < b.bottom);
  return spots.map((s) => {
    if (!s) return 'up-right';
    const place = PLACES.find((p) => !hits(labelBox(s, p, size, px))) ?? 'up-right';
    labels.push(labelBox(s, place, size, px));
    return place;
  });
}
