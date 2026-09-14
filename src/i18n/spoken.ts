import type { LangCode, Precision } from '../geo/types';
import { clampLat, normalizeLon, toDegMin, toDegMinSec } from '../geo/format';
import type { Axis } from '../geo/types';
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

/** Degrees, minutes and seconds in words (`50 degrees 15 minutes 54 seconds north`), like `formatDMS` writes them. */
export function spokenDMS(value: number, axis: Axis, lang: LangCode): string {
  const v = axis === 'lat' ? clampLat(value) : normalizeLon(value);
  const { deg, min, sec } = toDegMinSec(v);
  const parts = [tn('unit.degree', deg, undefined, lang)];
  if (min || sec) parts.push(tn('unit.minute', min, undefined, lang));
  if (sec) parts.push(tn('unit.second', sec, undefined, lang));
  const a = parts.join(' ');
  const total = deg * 3600 + min * 60 + sec;
  if (total === 0 || (axis === 'lon' && total === 180 * 3600)) return t('spoken.zero', { amount: a }, lang);
  const [key, pos, neg] = axis === 'lat' ? ['spoken.lat', 'dir.north', 'dir.south'] : ['spoken.lon', 'dir.east', 'dir.west'];
  return t(key, { amount: a, dir: t(v > 0 ? pos : neg, undefined, lang) }, lang);
}

/**
 * What a coordinate slider and the point's announcements say for one axis, matching the readout on screen:
 * with letters, the letters' precision (`50 degrees north`); with decimal degrees, the decimal value first and
 * then the same point in degrees and minutes (`50.2649, 50 degrees 16 minutes north`), or, when the readout also
 * shows seconds, in degrees, minutes and seconds.
 */
export function spokenAxis(value: number, axis: Axis, lang: LangCode, precision: Precision, readout: 'letters' | 'decimal' | 'both'): string {
  if (readout === 'letters') return axis === 'lat' ? spokenLat(value, lang, precision) : spokenLon(value, lang, precision);
  const v = axis === 'lat' ? clampLat(value) : normalizeLon(value);
  let dec = (Math.round(v * 1e4) / 1e4 + 0).toFixed(4);
  if (dec === '-180.0000') dec = '180.0000';
  const words = readout === 'both' ? spokenDMS(v, axis, lang) : axis === 'lat' ? spokenLat(v, lang, 'minute') : spokenLon(v, lang, 'minute');
  return `${dec}, ${words}`;
}
