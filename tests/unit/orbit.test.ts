import { describe, expect, test } from 'vitest';
import { AXIS, angleFromScreen, dayForAngle, earthOnOrbit, eventDay, eventOnDay, litOutline, orbitAngle, sunSeenFromEarth, toCamera, VIEW_ELEVATION } from '../../src/geo/orbit';
import { dateFromDayAndMinutes } from '../../src/geo/sun';

const close = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);
const area = (pts: [number, number][]) => Math.abs(pts.reduce((s, [x, y], i) => { const [x2, y2] = pts[(i + 1) % pts.length]!; return s + x * y2 - x2 * y; }, 0)) / 2;
const RAD = Math.PI / 180;

describe('where the Earth is on its orbit', () => {
  test('the Earth is opposite the Sun: 180° at the March equinox, 270° in June, 0° in September, 90° in December', () => {
    close(orbitAngle(new Date('2026-03-20T14:46:00Z')), 180, 0.05);
    close(orbitAngle(new Date('2026-06-21T08:24:00Z')), 270, 0.05);
    const sep = orbitAngle(new Date('2026-09-23T00:05:00Z'));
    close(Math.min(sep, 360 - sep), 0, 0.05);
    close(orbitAngle(new Date('2026-12-21T20:50:00Z')), 90, 0.05);
  });
  test('seen from slightly above: March at the back, June left, September front, December right', () => {
    const e = VIEW_ELEVATION * RAD;
    const [mr, mu] = earthOnOrbit(180, 1); close(mr, 0); close(mu, Math.sin(e));
    const [jr, , jt] = earthOnOrbit(270, 1); close(jr, -1); close(jt, 0);
    const [sr, su, st] = earthOnOrbit(0, 1); close(sr, 0); close(su, -Math.sin(e)); close(st, Math.cos(e));
    close(earthOnOrbit(90, 1)[0], 1);
  });
  test('the axis leans right, towards the Sun in June and away from it in December', () => {
    close(AXIS[0], Math.sin(23.44 * RAD));
    expect(AXIS[1]).toBeGreaterThan(0.8);
    const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
    expect(dot(AXIS, sunSeenFromEarth(270))).toBeGreaterThan(0.39);
    expect(dot(AXIS, sunSeenFromEarth(90))).toBeLessThan(-0.39);
    close(dot(AXIS, sunSeenFromEarth(180)), 0);
    const len = (v: number[]) => Math.hypot(v[0]!, v[1]!, v[2]!);
    close(len(toCamera([0.3, -0.4, 0.5])), Math.hypot(0.3, 0.4, 0.5));
  });
  test('dragging: a screen position gives back its angle', () => {
    for (let a = 0; a < 360; a += 17) { const [r, u] = earthOnOrbit(a, 250); close(angleFromScreen(r, u), a, 1e-6); }
  });
  test('an angle gives back its day; the four special days', () => {
    expect(dayForAngle(orbitAngle(dateFromDayAndMinutes(2026, 172, 720)), 2026)).toBe(172);
    expect([eventDay(2026, 'march'), eventDay(2026, 'june'), eventDay(2026, 'september'), eventDay(2026, 'december')]).toEqual([79, 172, 266, 355]);
    expect(eventDay(2028, 'june')).toBe(173);
    expect([eventOnDay(2026, 172), eventOnDay(2026, 173), eventOnDay(2026, 266)]).toEqual(['june', null, 'september']);
  });
});

describe('the lit half of the Earth as drawn', () => {
  test('Sun to the side: half lit; towards the viewer: all; behind: none; in between: a gibbous or crescent share', () => {
    close(area(litOutline([1, 0, 0])), Math.PI / 2, 0.01);
    close(area(litOutline([0, 0, 1])), Math.PI, 0.01);
    expect(litOutline([0, 0, -1])).toEqual([]);
    close(area(litOutline([0.6, 0, 0.8])), (Math.PI / 2) * 1.8, 0.02);
    close(area(litOutline([0.6, 0, -0.8])), (Math.PI / 2) * 0.2, 0.02);
    for (const [x] of litOutline([1, 0, 0])) expect(x).toBeGreaterThanOrEqual(-1e-9);
  });
});
