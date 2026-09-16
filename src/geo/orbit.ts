import { dateFromDayAndMinutes, dayOfYear, daysInYear, solarParams } from './sun';

/* The Earth's orbit as the Seasons view draws it (spec §6.1, planning ruling R16). */
export type Vec3 = [number, number, number];
export type SeasonEvent = 'march' | 'june' | 'september' | 'december';

const RAD = Math.PI / 180;
export const AXIAL_TILT = 23.44;
export const VIEW_ELEVATION = 22;

/** The Earth's heliocentric ecliptic longitude: opposite the Sun's apparent longitude. */
export function orbitAngle(date: Date): number {
  return (solarParams(date).appLongitude + 180) % 360;
}

/** Ecliptic (x → longitude 0°, y → 90°, z → north) to the camera: [screen right, screen up, towards the viewer]. */
export function toCamera([x, y, z]: Vec3, elevationDeg = VIEW_ELEVATION): Vec3 {
  const right = y, depth = -x, up = z;
  const e = elevationDeg * RAD;
  return [right, up * Math.cos(e) + depth * Math.sin(e), up * Math.sin(e) - depth * Math.cos(e)];
}

export function earthOnOrbit(angleDeg: number, radius: number): Vec3 {
  const a = angleDeg * RAD;
  return toCamera([radius * Math.cos(a), radius * Math.sin(a), 0]);
}

export function sunSeenFromEarth(angleDeg: number): Vec3 {
  const a = angleDeg * RAD;
  return toCamera([-Math.cos(a), -Math.sin(a), 0]);
}

/** The north end of the axis: tilted 23.44° from the orbit's pole towards ecliptic longitude 90°, fixed in space. */
export const AXIS: Vec3 = toCamera([0, Math.sin(AXIAL_TILT * RAD), Math.cos(AXIAL_TILT * RAD)]);

/**
 * The lit part of a unit sphere seen by the camera, as a closed outline (x right, y up): the half of the rim facing the
 * Sun, then the terminator (a great circle whose picture is an ellipse with half-axes 1 and |sun towards viewer|).
 */
export function litOutline(sun: Vec3, steps = 40): [number, number][] {
  const [sx, sy, sz] = sun;
  const q = Math.hypot(sx, sy);
  if (q < 1e-9) return sz > 0 ? Array.from({ length: 2 * steps }, (_, i) => [Math.cos((Math.PI * i) / steps), Math.sin((Math.PI * i) / steps)] as [number, number]) : [];
  const ux = sx / q, uy = sy / q;   // towards the Sun on screen
  const px = -uy, py = ux;          // across
  const out: [number, number][] = [];
  const a0 = Math.atan2(py, px);
  for (let i = 0; i <= steps; i++) { const a = a0 - (Math.PI * i) / steps; out.push([Math.cos(a), Math.sin(a)]); }
  const side = sz >= 0 ? -1 : 1;    // more than half lit: the terminator bulges away from the Sun
  const k = Math.abs(sz) / Math.hypot(sx, sy, sz);
  for (let i = 1; i < steps; i++) {
    const a = Math.PI - (Math.PI * i) / steps;
    const along = Math.cos(a), across = Math.sin(a) * k * side;
    out.push([along * px + across * ux, along * py + across * uy]);
  }
  return out;
}

/** The orbit angle of a point on the drawn orbit (screen right, screen up relative to the Sun; any radius). */
export function angleFromScreen(right: number, up: number): number {
  const a = Math.atan2(right, -up / Math.sin(VIEW_ELEVATION * RAD)) / RAD;
  return (a + 360) % 360;
}

/** The day of `year` (at 12:00 UTC) whose orbit angle is closest to `angleDeg`. */
export function dayForAngle(angleDeg: number, year: number): number {
  let best = 1, bestDiff = Infinity;
  for (let day = 1; day <= daysInYear(year); day++) {
    const diff = Math.abs(((orbitAngle(dateFromDayAndMinutes(year, day, 720)) - angleDeg + 540) % 360) - 180);
    if (diff < bestDiff) { bestDiff = diff; best = day; }
  }
  return best;
}

const EVENTS: Record<SeasonEvent, [month: number, day: number]> = { march: [2, 20], june: [5, 21], september: [8, 23], december: [11, 21] };

/** The lesson's dates for the equinoxes and solstices (the same as the lab's key dates). */
export function eventDay(year: number, e: SeasonEvent): number {
  const [m, d] = EVENTS[e];
  return dayOfYear(new Date(Date.UTC(year, m, d)));
}

export function eventOnDay(year: number, day: number): SeasonEvent | null {
  return (Object.keys(EVENTS) as SeasonEvent[]).find((e) => eventDay(year, e) === day) ?? null;
}
