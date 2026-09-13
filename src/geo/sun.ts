import { normalizeLon } from './format';
import type { LatLon } from './types';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

function sunParams(date: Date): { declination: number; eqTimeMin: number } {
  const jd = date.getTime() / 86_400_000 + 2440587.5;
  const t = (jd - 2451545) / 36525;
  const L0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const M = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const C = Math.sin(M * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t))
    + Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * t)
    + Math.sin(3 * M * RAD) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * t;
  const appLong = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const meanObliq = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliq = meanObliq + 0.00256 * Math.cos(omega * RAD);
  const declination = Math.asin(Math.sin(obliq * RAD) * Math.sin(appLong * RAD)) * DEG;
  const y = Math.tan((obliq / 2) * RAD) ** 2;
  const eqTimeMin = 4 * DEG * (
    y * Math.sin(2 * L0 * RAD)
    - 2 * e * Math.sin(M * RAD)
    + 4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD)
    - 0.5 * y * y * Math.sin(4 * L0 * RAD)
    - 1.25 * e * e * Math.sin(2 * M * RAD)
  );
  return { declination, eqTimeMin };
}

export function subsolarPoint(date: Date): LatLon {
  const { declination, eqTimeMin } = sunParams(date);
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  return { lat: declination, lon: normalizeLon(-15 * (utcHours - 12 + eqTimeMin / 60)) };
}

export function antisolarPoint(date: Date): LatLon {
  const s = subsolarPoint(date);
  return { lat: -s.lat, lon: normalizeLon(s.lon + 180) };
}

export function solarElevationDeg(date: Date, p: LatLon): number {
  return elevationFrom(subsolarPoint(date), p);
}

/**
 * The Sun as the lesson's clocks see it: the real declination, but standing over the meridian where
 * local solar time (UTC + longitude × 4 min) is 12:00. It differs from the real subsolar point only by the
 * equation of time (at most about 4°), and keeps the night shading, the Sun symbol, the noon meridian and
 * the clocks telling one consistent story.
 */
export function meanSunPoint(date: Date): LatLon {
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  return { lat: sunParams(date).declination, lon: normalizeLon(-15 * (utcHours - 12)) };
}

/** Elevation of the Sun (degrees) seen from `p` when it stands overhead at `sun`. */
export function elevationFrom(sun: LatLon, p: LatLon): number {
  const s = sun;
  const v = Math.sin(p.lat * RAD) * Math.sin(s.lat * RAD)
    + Math.cos(p.lat * RAD) * Math.cos(s.lat * RAD) * Math.cos((p.lon - s.lon) * RAD);
  return Math.asin(Math.max(-1, Math.min(1, v))) * DEG;
}

export function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.floor((date.getTime() - start) / 86_400_000) + 1;
}

export function dateFromDayAndMinutes(year: number, day: number, utcMinutes: number): Date {
  return new Date(Date.UTC(year, 0, 1) + (day - 1) * 86_400_000 + utcMinutes * 60_000);
}

/** Minutes of daylight (Sun above the horizon) in a day at latitude `lat` when the Sun's declination is `declination`. */
export function dayLightMinutes(lat: number, declination: number): number {
  const c = -Math.tan(lat * RAD) * Math.tan(declination * RAD);
  if (c <= -1) return 1440;
  if (c >= 1) return 0;
  return ((2 * Math.acos(c) * DEG) / 15) * 60;
}
