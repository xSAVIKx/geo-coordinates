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
