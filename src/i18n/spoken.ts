import type { LangCode, Precision } from '../geo/types';
import { normalizeLon, toDegMin } from '../geo/format';
import { t, tn } from './i18n.svelte';

function amount(value: number, precision: Precision, lang: LangCode): string {
  if (precision === 'degree') return tn('unit.degree', Math.round(Math.abs(value)), undefined, lang);
  const { deg, min } = toDegMin(value);
  const d = tn('unit.degree', deg, undefined, lang);
  return min === 0 ? d : `${d} ${tn('unit.minute', min, undefined, lang)}`;
}

function spoken(value: number, lang: LangCode, precision: Precision, key: string, pos: string, neg: string, isZero: boolean): string {
  const a = amount(value, precision, lang);
  if (isZero) return t('spoken.zero', { amount: a }, lang);
  return t(key, { amount: a, dir: t(value > 0 ? pos : neg, undefined, lang) }, lang);
}

export function spokenLat(lat: number, lang: LangCode, precision: Precision = 'degree'): string {
  const zero = precision === 'degree' ? Math.round(lat) === 0 : Math.round(lat * 60) === 0;
  return spoken(lat, lang, precision, 'spoken.lat', 'dir.north', 'dir.south', zero);
}

export function spokenLon(lon: number, lang: LangCode, precision: Precision = 'degree'): string {
  const n = normalizeLon(lon);
  const r = precision === 'degree' ? Math.round(Math.abs(n)) : Math.round(Math.abs(n) * 60) / 60;
  return spoken(n, lang, precision, 'spoken.lon', 'dir.east', 'dir.west', r === 0 || r === 180);
}
