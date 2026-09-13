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

export function renderText(text: Text, lang: LangCode = i18n.lang): string {
  const resolved: Record<string, string | number> = {};
  for (const [name, p] of Object.entries(text.params ?? {})) {
    if (typeof p === 'string') resolved[name] = p;
    else if (typeof p === 'number') resolved[name] = formatNumber(p, lang);
    else if ('coord' in p) {
      const axis = p.axis ?? 'both';
      resolved[name] = axis === 'lat' ? formatLat(p.coord.lat, lang, p.precision) : axis === 'lon' ? formatLon(p.coord.lon, lang, p.precision) : formatLatLon(p.coord, lang, p.precision);
    } else if ('place' in p) resolved[name] = t(`place.${p.place}`, undefined, lang);
    else resolved[name] = renderText(p.text, lang);
  }
  return text.count === undefined ? t(text.key, resolved, lang) : tn(text.key, text.count, resolved, lang);
}
