import { normalizeLon } from './format';

export const MINUTES_PER_DEGREE = 4;
export const MINUTES_PER_DAY = 1440;

export function wrapDayMinutes(m: number): number {
  return ((Math.round(m) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

export function solarOffsetMinutes(fromLon: number, toLon: number): number {
  return normalizeLon(toLon - fromLon) * MINUTES_PER_DEGREE;
}

export function localSolarMinutes(utcMinutes: number, lon: number): number {
  return wrapDayMinutes(utcMinutes + normalizeLon(lon) * MINUTES_PER_DEGREE);
}

export function formatClock(minutes: number): string {
  const m = wrapDayMinutes(minutes);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function lonDifferenceForMinutes(minutes: number): number {
  return minutes / MINUTES_PER_DEGREE;
}

/** Minutes after midnight for a typed time: `H:MM`, `HH:MM`, `HH.MM` (also a comma or space), or `HMM`/`HHMM` from a phone keypad. */
export function parseClock(text: string): number | null {
  const m = /^\s*(?:(\d{1,2})\s*[:.,\s]\s*(\d{2})|(\d{1,2})(\d{2}))\s*$/.exec(text);
  if (!m) return null;
  const h = Number(m[1] ?? m[3]), min = Number(m[2] ?? m[4]);
  return h <= 23 && min <= 59 ? h * 60 + min : null;
}
