import type { Axis, LangCode, LatLon, Precision } from '../geo/types';
import { formatLat, formatLatLon, formatLon } from '../geo/format';
import { i18n, t, tn } from './i18n.svelte';

export type TextParam = string | number | { coord: LatLon; axis?: Axis | 'both'; precision?: Precision } | { place: string } | { text: Text };
export interface Text { key: string; params?: Record<string, TextParam>; count?: number }

const numberFormats = new Map<LangCode, Intl.NumberFormat>();

export function formatNumber(n: number, lang: LangCode = i18n.lang): string {
  let f = numberFormats.get(lang);
  if (!f) { f = new Intl.NumberFormat(lang, { maximumFractionDigits: 2, useGrouping: false }); numberFormats.set(lang, f); }
  return f.format(n);
}

/**
 * A coordinate in running text never breaks inside itself: the Ukrainian `52° пн. ш.` keeps its number and both
 * parts of its letters on one line (no-break spaces); a line may still break after the comma between two coordinates.
 */
export function keepTogether(coord: string): string {
  return coord.replace(/ (?=(?:пн|пд|сх|зх)\.)/g, '\u00a0').replace(/(пн|пд|сх|зх)\. (?=[шд]\.)/g, '$1.\u00a0');
}

export function renderText(text: Text, lang: LangCode = i18n.lang): string {
  const resolved: Record<string, string | number> = {};
  for (const [name, p] of Object.entries(text.params ?? {})) {
    if (typeof p === 'string') resolved[name] = p;
    else if (typeof p === 'number') resolved[name] = formatNumber(p, lang);
    else if ('coord' in p) {
      const axis = p.axis ?? 'both';
      resolved[name] = keepTogether(axis === 'lat' ? formatLat(p.coord.lat, lang, p.precision) : axis === 'lon' ? formatLon(p.coord.lon, lang, p.precision) : formatLatLon(p.coord, lang, p.precision));
    } else if ('place' in p) resolved[name] = t(`place.${p.place}`, undefined, lang);
    else resolved[name] = renderText(p.text, lang);
  }
  return text.count === undefined ? t(text.key, resolved, lang) : tn(text.key, text.count, resolved, lang);
}
