# Part 6 — Seasons mode and topic 10 (spec §9.6)

Read spec §6.1 and §6.2 first.

Context every task here needs:
- `src/geo/sun.ts` (after Task 14): `solarParams(date) → { declination, eqTimeMin, appLongitude }`, `dayLightMinutes(lat, declination)` (geometric day length in minutes, 1440 polar day, 0 polar night), `dateFromDayAndMinutes(year, day, utcMinutes)`, `dayOfYear(date)`, `daysInYear(year)`.
- `src/geo/format.ts`: `formatLat(lat, lang, precision)` → `23°26′N` / UK `23°26′ пн. ш.`; `formatLon`; `formatLatLon`.
- `src/geo/time.ts`: `formatClock(minutes)` → `HH:MM`.
- `MapState` (`src/map/mapState.svelte.ts`): `views`, `phoneView`, `sun` (`{ utcMinutes, dayOfYear, year } | null`), `sunDate()`, `realSun`, `point`, `labControls`, `applyScene(scene)`. `SceneSpec` and `ViewId`, `LabControl` live in `src/map/types.ts` (`LabControl` = `'sun-time' | 'sun-date' | 'clocks' | 'now' | 'real-sun'` after Task 16).
- `src/map/MapStage.svelte` renders `mapState.views` (phones: only `phoneView`, with a view switch labelled `t('map.view.<id>')`), then `CoordinateControls`, `LabControls` (when `labControls.length`), `PlaceList`, `SchoolList`.
- `src/map/LabControls.svelte`: `has(control)`, the time and date sliders (`Slider.svelte`), key dates buttons (`lab.keyDate.*`), clocks.
- Topics are data: `src/topics/t9-phone.ts` is the model for an explore-only topic (`questionTypes: []`); texts are `topic.<n>.step.<id>.title/body`.

---

### Task 17: Seasons and orbit maths

**Files:**
- Create: `src/geo/seasons.ts`, `src/geo/orbit.ts`
- Test: `tests/unit/seasons.test.ts`, `tests/unit/orbit.test.ts`

**Interfaces:**
- Consumes: `solarParams`, `dayLightMinutes`, `dateFromDayAndMinutes`, `dayOfYear`, `daysInYear` (`src/geo/sun.ts`).
- Produces:
  ```ts
  // src/geo/seasons.ts
  export interface DayInfo { declination: number; eqTimeMin: number; dayMinutes: number; polar: 'day' | 'night' | null; sunrise: number | null; sunset: number | null }
  export function dayInfo(lat: number, date: Date, realSun: boolean): DayInfo;   // sunrise/sunset: minutes of local mean solar time
  export interface PolarLimit { lat: number; hemisphere: 'N' | 'S' }
  export function polarLimits(declination: number): { day: PolarLimit; night: PolarLimit } | null;
  export function splitMinutes(minutes: number): { h: number; m: number };
  // src/geo/orbit.ts
  export type Vec3 = [number, number, number];
  export type SeasonEvent = 'march' | 'june' | 'september' | 'december';
  export const AXIAL_TILT = 23.44;          // used in calculations; texts say 23½°
  export const VIEW_ELEVATION = 22;         // degrees above the orbit plane
  export function orbitAngle(date: Date): number;                               // Earth's heliocentric ecliptic longitude, [0, 360)
  export function toCamera(v: Vec3, elevationDeg?: number): Vec3;               // ecliptic → [screen right, screen up, towards viewer]
  export function earthOnOrbit(angleDeg: number, radius: number): Vec3;
  export function sunSeenFromEarth(angleDeg: number): Vec3;                     // unit vector, camera frame
  export const AXIS: Vec3;                                                      // north pole direction, camera frame
  export function litOutline(sun: Vec3, steps?: number): [number, number][];    // unit-circle outline of the lit part of a sphere, y up
  export function angleFromScreen(right: number, up: number): number;           // inverse of earthOnOrbit's screen position
  export function dayForAngle(angleDeg: number, year: number): number;
  export function eventDay(year: number, e: SeasonEvent): number;               // 20 Mar, 21 Jun, 23 Sep, 21 Dec
  export function eventOnDay(year: number, day: number): SeasonEvent | null;
  ```

Geometry (planning ruling R16): ecliptic frame x → ecliptic longitude 0°, y → 90°, z → ecliptic north. The camera looks at the Sun from the September side, raised 22°: screen right = y, depth into the screen = −x, so the Earth is at the back (top) in March, on the left in June, at the front (bottom) in September and on the right in December, moving counter-clockwise. The axis points towards longitude 90° tilted 23.44° from the ecliptic pole, so in June it leans towards the Sun.

- [ ] **Step 1: Failing tests**

`tests/unit/seasons.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { formatLat } from '../../src/geo/format';
import { dayInfo, polarLimits, splitMinutes } from '../../src/geo/seasons';
import { solarParams } from '../../src/geo/sun';

const close = (a: number | null, b: number, tol: number) => expect(Math.abs(a! - b)).toBeLessThanOrEqual(tol);
const d = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe('day length, sunrise and sunset (geometric, local mean solar time)', () => {
  test('Katowice (50.26°N) at the solstices: 16 h 11 min and 7 h 49 min', () => {
    const june = dayInfo(50.26, d('2026-06-21'), false);
    close(june.dayMinutes, 971.4, 1);
    expect(splitMinutes(june.dayMinutes)).toEqual({ h: 16, m: 11 });
    close(june.sunrise, 720 - 971.4 / 2, 1);
    close(june.sunset, 720 + 971.4 / 2, 1);
    const december = dayInfo(50.26, d('2026-12-21'), false);
    close(december.dayMinutes, 468.6, 1);
    expect(splitMinutes(december.dayMinutes)).toEqual({ h: 7, m: 49 });
  });
  test('Sydney (33.87°S) the other way round; the equator always 12 h', () => {
    close(dayInfo(-33.87, d('2026-06-21'), false).dayMinutes, 585, 2);
    close(dayInfo(-33.87, d('2026-12-21'), false).dayMinutes, 855, 2);
    for (const iso of ['2026-03-20', '2026-06-21', '2026-12-21']) close(dayInfo(0, d(iso), false).dayMinutes, 720, 0.5);
  });
  test('polar day and polar night have no sunrise or sunset', () => {
    expect(dayInfo(70, d('2026-06-21'), false)).toMatchObject({ polar: 'day', dayMinutes: 1440, sunrise: null, sunset: null });
    expect(dayInfo(70, d('2026-12-21'), false)).toMatchObject({ polar: 'night', dayMinutes: 0, sunrise: null, sunset: null });
  });
  test('with the real Sun, sunrise and sunset move by the equation of time', () => {
    const date = d('2026-11-03');
    const eq = solarParams(date).eqTimeMin;
    close(dayInfo(50, date, true).sunrise, dayInfo(50, date, false).sunrise! - eq, 1e-9);
    close(dayInfo(50, date, true).sunset, dayInfo(50, date, false).sunset! - eq, 1e-9);
  });
  test('splitMinutes rounds to the minute and carries', () => {
    expect(splitMinutes(719.6)).toEqual({ h: 12, m: 0 });
    expect(splitMinutes(1440)).toEqual({ h: 24, m: 0 });
  });
});

describe('where polar day and polar night begin', () => {
  test('at the June solstice: north of 66°34′N day, south of 66°34′S night (lesson notation)', () => {
    const lim = polarLimits(23.44)!;
    expect(lim.day).toEqual({ lat: 66.56, hemisphere: 'N' });
    expect(lim.night.hemisphere).toBe('S');
    expect(formatLat(lim.day.lat, 'en', 'minute')).toBe('66°34′N');
    expect(formatLat(-lim.night.lat, 'uk', 'minute')).toBe('66°34′ пд. ш.');
  });
  test('southern summer mirrors it; no polar day at an equinox', () => {
    expect(polarLimits(-10)).toEqual({ day: { lat: 80, hemisphere: 'S' }, night: { lat: 80, hemisphere: 'N' } });
    expect(polarLimits(0)).toBeNull();
  });
});
```

`tests/unit/orbit.test.ts`:
```ts
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
```
Run: `npx vitest run tests/unit/seasons.test.ts tests/unit/orbit.test.ts` — Expected: FAIL (modules not found).

- [ ] **Step 2: `src/geo/seasons.ts`**

```ts
import { dayLightMinutes, solarParams } from './sun';

/*
 * Seasons for a place and a date (spec §6.1 readout). Day length is geometric: the Sun's centre on the horizon, the
 * same boundary the day and night shading uses (planning ruling R14). Times are local mean solar time: the mean Sun
 * is highest at 12:00; with the real Sun it is highest at 12:00 − equation of time.
 */
export interface DayInfo { declination: number; eqTimeMin: number; dayMinutes: number; polar: 'day' | 'night' | null; sunrise: number | null; sunset: number | null }

export function dayInfo(lat: number, date: Date, realSun: boolean): DayInfo {
  const { declination, eqTimeMin } = solarParams(date);
  const dayMinutes = dayLightMinutes(lat, declination);
  const polar = dayMinutes >= 1440 ? 'day' : dayMinutes <= 0 ? 'night' : null;
  const noon = 720 - (realSun ? eqTimeMin : 0);
  return { declination, eqTimeMin, dayMinutes, polar, sunrise: polar ? null : noon - dayMinutes / 2, sunset: polar ? null : noon + dayMinutes / 2 };
}

export interface PolarLimit { lat: number; hemisphere: 'N' | 'S' }

/** Beyond 90° − |declination| the Sun does not set (towards the Sun's side) or does not rise (the other pole). */
export function polarLimits(declination: number): { day: PolarLimit; night: PolarLimit } | null {
  if (Math.abs(declination) < 1e-6) return null;
  const lat = Math.round((90 - Math.abs(declination)) * 1e6) / 1e6;
  const sunSide = declination > 0 ? 'N' : 'S';
  return { day: { lat, hemisphere: sunSide }, night: { lat, hemisphere: sunSide === 'N' ? 'S' : 'N' } };
}

export function splitMinutes(minutes: number): { h: number; m: number } {
  const total = Math.round(minutes);
  return { h: Math.floor(total / 60), m: total % 60 };
}
```

- [ ] **Step 3: `src/geo/orbit.ts`**

```ts
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
```
Note `litOutline`'s `k` uses `|sz| / |sun|`, so a non-unit vector still works; the test vectors are unit length.

- [ ] **Step 4: Run and commit**

Run: `npx vitest run tests/unit/seasons.test.ts tests/unit/orbit.test.ts` — Expected: PASS (13 tests). The Katowice and Sydney values were measured with `dayLightMinutes` while planning (16 h 11, 7 h 49, 9 h 45, 14 h 15).
```bash
npm run check && npm test
git add src/geo/seasons.ts src/geo/orbit.ts tests/unit/seasons.test.ts tests/unit/orbit.test.ts
git commit -m "feat(geo): day length, polar limits and the Earth's orbit for the seasons"
```

---

### Task 18: Orbit view and Seasons mode

**Files:**
- Create: `src/map/OrbitView.svelte`, `src/map/SeasonsReadout.svelte`
- Modify: `src/map/types.ts` (`ViewId` gains `'orbit'`, `LabControl` gains `'seasons'`), `src/map/mapState.svelte.ts` (`orbitToggle`, `toggleOrbit`), `src/map/MapStage.svelte`, `src/map/LabControls.svelte`, `src/app/LabPage.svelte`, `src/i18n/en.json`, `src/i18n/pl.json`, `src/i18n/uk.json`, `scripts/translation-review-lib.ts`
- Test: `tests/unit/mapState-orbit.test.ts`, `tests/e2e/seasons.spec.ts`

**Interfaces:**
- Consumes: Task 17 (`orbitAngle`, `earthOnOrbit`, `sunSeenFromEarth`, `AXIS`, `litOutline`, `angleFromScreen`, `dayForAngle`, `eventDay`, `eventOnDay`, `dayInfo`, `polarLimits`, `splitMinutes`); `mapState.sun`, `mapState.sunDate()`, `mapState.realSun`, `mapState.point`; `formatLat`, `formatClock`, `dateFromDayAndMinutes`, `daysInYear`.
- Produces:
  ```ts
  // src/map/types.ts
  export type ViewId = 'globe' | 'flat' | 'cross-section' | 'orbit';
  export type LabControl = 'sun-time' | 'sun-date' | 'clocks' | 'now' | 'real-sun' | 'seasons';
  // MapState
  orbitToggle: boolean;     // $state: the scene lists 'seasons' but not the 'orbit' view (the lab): LabControls offers "Seasons mode"
  toggleOrbit(): void;      // adds 'orbit' first in `views` or removes it; keeps phoneView valid
  // OrbitView.svelte: no props (reads mapState). Earth handle: role="slider", aria-valuemin 1, aria-valuemax daysInYear, aria-valuenow dayOfYear, aria-valuetext "21 June, June solstice"
  // SeasonsReadout.svelte: no props; shows for mapState.point at the scene's day (12:00 UTC)
  // i18n: map.view.orbit, lab.seasons, seasons.orbit.label, seasons.orbit.slider, seasons.orbit.hint, seasons.sun, seasons.polaris,
  //   seasons.event.march|june|september|december, seasons.dateEvent, seasons.readout, seasons.dayLength, seasons.duration,
  //   seasons.sunrise, seasons.sunset, seasons.solarTime, seasons.overhead, seasons.polarDayNorth, seasons.polarDaySouth,
  //   seasons.polarNightNorth, seasons.polarNightSouth, seasons.polarDayHere, seasons.polarNightHere, seasons.equinoxNoPolar
  ```

- [ ] **Step 1: Messages**

| key | en | pl | uk |
|---|---|---|---|
| `map.view.orbit` | Orbit | Orbita | Орбіта |
| `lab.seasons` | Seasons mode | Tryb pór roku | Режим пір року |
| `seasons.orbit.label` | The Earth's orbit around the Sun | Orbita Ziemi wokół Słońca | Орбіта Землі навколо Сонця |
| `seasons.orbit.slider` | Date on the Earth's orbit | Data na orbicie Ziemi | Дата на орбіті Землі |
| `seasons.orbit.hint` | Drag the Earth along its orbit, or use the arrow keys (one day) and Page Up / Page Down (one month). | Przeciągnij Ziemię po orbicie albo użyj strzałek (jeden dzień) i klawiszy Page Up / Page Down (jeden miesiąc). | Перетягни Землю по орбіті або натискай стрілки (один день) і клавіші Page Up / Page Down (один місяць). |
| `seasons.sun` | Sun | Słońce | Сонце |
| `seasons.polaris` | towards the North Star | w stronę Gwiazdy Polarnej | до Полярної зорі |
| `seasons.event.march` | March equinox | Równonoc marcowa | Березневе рівнодення |
| `seasons.event.june` | June solstice | Przesilenie czerwcowe | Червневе сонцестояння |
| `seasons.event.september` | September equinox | Równonoc wrześniowa | Вересневе рівнодення |
| `seasons.event.december` | December solstice | Przesilenie grudniowe | Грудневе сонцестояння |
| `seasons.dateEvent` | {date}, {event} | {date}, {event} | {date}, {event} |
| `seasons.readout` | Seasons at the point | Pory roku w punkcie | Пори року в точці |
| `seasons.dayLength` | Day length | Długość dnia | Тривалість дня |
| `seasons.duration` | {h} h {m} min | {h} godz. {m} min | {h} год {m} хв |
| `seasons.sunrise` | Sunrise | Wschód Słońca | Схід Сонця |
| `seasons.sunset` | Sunset | Zachód Słońca | Захід Сонця |
| `seasons.solarTime` | local solar time | lokalny czas słoneczny | місцевий сонячний час |
| `seasons.overhead` | Sun overhead at {lat} | Słońce w zenicie nad {lat} | Сонце в зеніті над {lat} |
| `seasons.polarDayNorth` | Polar day north of {lat} | Dzień polarny na północ od {lat} | Полярний день на північ від {lat} |
| `seasons.polarDaySouth` | Polar day south of {lat} | Dzień polarny na południe od {lat} | Полярний день на південь від {lat} |
| `seasons.polarNightNorth` | Polar night north of {lat} | Noc polarna na północ od {lat} | Полярна ніч на північ від {lat} |
| `seasons.polarNightSouth` | Polar night south of {lat} | Noc polarna na południe od {lat} | Полярна ніч на південь від {lat} |
| `seasons.polarDayHere` | Polar day: the Sun does not set | Dzień polarny: Słońce nie zachodzi | Полярний день: Сонце не заходить |
| `seasons.polarNightHere` | Polar night: the Sun does not rise | Noc polarna: Słońce nie wschodzi | Полярна ніч: Сонце не сходить |
| `seasons.equinoxNoPolar` | No polar day or night: the Sun is over the equator | Nie ma dnia ani nocy polarnej: Słońce jest nad równikiem | Немає полярного дня чи ночі: Сонце над екватором |

`seasons.dateEvent` is only parameters (identical in all languages): add `/^seasons\.dateEvent$/` to `SAME_OK` with a comment line (`//  - seasons.dateEvent  "{date}, {event}" is parameters only`). Ukrainian uses the key names Page, Up, Down: add `'Page', 'Up', 'Down'` to `LATIN_OK` with `//  - Page, Up, Down  the Page Up / Page Down key names in seasons.orbit.hint (printed in Latin on keyboards)`. `seasons.polarDayHere` etc. are used when the point itself is in polar day/night; `seasons.equinoxNoPolar` when `polarLimits` returns null.

- [ ] **Step 2: Failing unit test `tests/unit/mapState-orbit.test.ts`**

```ts
import { expect, test } from 'vitest';
import { MapState } from '../../src/map/mapState.svelte';

test('the lab\'s Seasons mode adds the orbit view first and takes it away again', () => {
  const s = new MapState();
  s.applyScene({ views: ['globe', 'flat'], labControls: ['sun-date', 'seasons'], sun: { utcMinutes: 720, dayOfYear: 80 } });
  expect(s.orbitToggle).toBe(true);
  s.toggleOrbit();
  expect(s.views).toEqual(['orbit', 'globe', 'flat']);
  s.phoneView = 'orbit';
  s.toggleOrbit();
  expect(s.views).toEqual(['globe', 'flat']);
  expect(s.phoneView).toBe('flat');
});

test('a scene that shows the orbit itself offers no toggle; other scenes neither', () => {
  const s = new MapState();
  s.applyScene({ views: ['orbit', 'globe'], labControls: ['seasons'] });
  expect(s.orbitToggle).toBe(false);
  s.applyScene({ views: ['globe', 'flat'], labControls: ['sun-date'] });
  expect(s.orbitToggle).toBe(false);
});
```
Run — Expected: FAIL (`orbitToggle` undefined).

- [ ] **Step 3: Types and MapState**

`src/map/types.ts`: `export type ViewId = 'globe' | 'flat' | 'cross-section' | 'orbit';` and `LabControl` gains `| 'seasons'`.

`MapState`:
```ts
  /** Whether LabControls offers "Seasons mode": the scene lists the 'seasons' control but not the orbit view (the lab). */
  orbitToggle = $state(false);

  toggleOrbit(): void {
    this.views = this.views.includes('orbit') ? this.views.filter((v) => v !== 'orbit') : ['orbit', ...this.views];
    if (!this.views.includes(this.phoneView)) this.phoneView = this.views.includes('flat') ? 'flat' : this.views[0]!;
  }
```
In `replaceScene`: `this.orbitToggle = (scene.labControls ?? []).includes('seasons') && !scene.views.includes('orbit');`
Run the unit test — Expected: PASS.

- [ ] **Step 4: `src/map/OrbitView.svelte`**

Script (complete):
```svelte
<script lang="ts">
  import { AXIS, angleFromScreen, dayForAngle, earthOnOrbit, eventDay, eventOnDay, litOutline, orbitAngle, sunSeenFromEarth, type SeasonEvent } from '../geo/orbit';
  import { dateFromDayAndMinutes, daysInYear } from '../geo/sun';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { mapState } from './mapState.svelte';

  // Spec §6.1: the Sun in the middle, the Earth on its orbit seen from slightly above, its axis tilted 23½° and fixed
  // in space. Dragging the Earth (or the keys) sets the lab's date; the globe and the flat map follow.
  const W = 640, H = 380, CX = 320, CY = 196, R = 250, EARTH = 26, SUN = 34;
  const uid = `orbit-${Math.random().toString(36).slice(2, 8)}`;
  let svg: SVGSVGElement;

  const year = $derived(mapState.sun?.year ?? new Date().getUTCFullYear());
  const lastDay = $derived(daysInYear(year));
  const day = $derived(Math.min(lastDay, mapState.sun?.dayOfYear ?? 1));
  const angle = $derived(orbitAngle(dateFromDayAndMinutes(year, day, 720)));
  const screen = (v: readonly number[]): [number, number] => [CX + v[0]!, CY - v[1]!];
  const earth = $derived(earthOnOrbit(angle, R));
  const earthXY = $derived(screen(earth));
  const behindSun = $derived(earth[2] < 0);
  const orbitD = $derived(`M${Array.from({ length: 121 }, (_, i) => screen(earthOnOrbit((i * 360) / 120, R)).map((n) => n.toFixed(1)).join(' ')).join('L')}Z`);
  const litD = $derived.by(() => {
    const pts = litOutline(sunSeenFromEarth(angle));
    return pts.length ? `M${pts.map(([x, y]) => `${(earthXY[0] + x * EARTH).toFixed(1)} ${(earthXY[1] - y * EARTH).toFixed(1)}`).join('L')}Z` : '';
  });
  const axisEnd = (k: number): [number, number] => [earthXY[0] + AXIS[0] * EARTH * k, earthXY[1] - AXIS[1] * EARTH * k];

  const fmtDate = (d: number, month: 'long' | 'short') => new Intl.DateTimeFormat(i18n.lang, { day: 'numeric', month, timeZone: 'UTC' }).format(dateFromDayAndMinutes(year, d, 720));
  const event = $derived(eventOnDay(year, day));
  const valueText = $derived(event ? t('seasons.dateEvent', { date: fmtDate(day, 'long'), event: t(`seasons.event.${event}`) }) : fmtDate(day, 'long'));
  const EVENTS: SeasonEvent[] = ['march', 'june', 'september', 'december'];
  const marks = $derived(EVENTS.map((e) => { const d = eventDay(year, e); const p = earthOnOrbit(orbitAngle(dateFromDayAndMinutes(year, d, 720)), R); return { e, d, xy: screen(p), label: fmtDate(d, 'short') }; }));

  function setDay(d: number) {
    const s = mapState.sun;
    if (s) mapState.sun = { ...s, dayOfYear: Math.max(1, Math.min(lastDay, Math.round(d))) };
  }
  function monthStep(delta: number) {
    const date = dateFromDayAndMinutes(year, day, 720);
    const target = new Date(Date.UTC(year, date.getUTCMonth() + delta, 1));
    if (target.getUTCFullYear() !== year) { setDay(delta > 0 ? lastDay : 1); return; }
    const dim = new Date(Date.UTC(year, target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(date.getUTCDate(), dim));
    setDay(Math.floor((target.getTime() - Date.UTC(year, 0, 1)) / 86_400_000) + 1);
  }
  function onkeydown(e: KeyboardEvent) {
    const act: Record<string, () => void> = {
      ArrowRight: () => setDay(day + 1), ArrowUp: () => setDay(day + 1), ArrowLeft: () => setDay(day - 1), ArrowDown: () => setDay(day - 1),
      PageUp: () => monthStep(1), PageDown: () => monthStep(-1), Home: () => setDay(1), End: () => setDay(lastDay),
    };
    const f = act[e.key];
    if (!f) return;
    e.preventDefault();
    f();
  }
  let dragging = false;
  function fromPointer(e: PointerEvent) {
    const m = svg.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    setDay(dayForAngle(angleFromScreen(p.x - CX, CY - p.y), year));
  }
</script>
```
Markup (structure; painter's order puts the Earth behind the Sun when `behindSun`):
```svelte
<figure class="orbit" aria-labelledby="{uid}-title">
  <p id="{uid}-title" class="visually-hidden">{t('seasons.orbit.label')}</p>
  <!-- svelte-ignore a11y_no_static_element_interactions -- pointer drag on the orbit moves the Earth; the Earth itself is the keyboard slider -->
  <svg bind:this={svg} viewBox="0 0 {W} {H}" role="group" aria-labelledby="{uid}-title"
    onpointerdown={(e) => { dragging = true; svg.setPointerCapture(e.pointerId); fromPointer(e); }}
    onpointermove={(e) => dragging && fromPointer(e)} onpointerup={() => (dragging = false)} onpointercancel={() => (dragging = false)}>
    <path class="orbit-path" d={orbitD} />
    {#each marks as m (m.e)}<g class="mark"><circle cx={m.xy[0]} cy={m.xy[1]} r="4" /><text class="halo" x={m.xy[0]} y={m.xy[1] + (m.e === 'september' ? 22 : -12)} text-anchor="middle">{m.label}</text></g>{/each}
    {#snippet earthGroup()}
      <g class="earth" role="slider" tabindex="0" aria-label={t('seasons.orbit.slider')} aria-describedby="{uid}-hint"
        aria-valuemin={1} aria-valuemax={lastDay} aria-valuenow={day} aria-valuetext={valueText} {onkeydown}>
        <circle class="hit" cx={earthXY[0]} cy={earthXY[1]} r="34" />
        <line class="axis back" x1={axisEnd(-1.6)[0]} y1={axisEnd(-1.6)[1]} x2={earthXY[0]} y2={earthXY[1]} />
        <circle class="night-side" cx={earthXY[0]} cy={earthXY[1]} r={EARTH} />
        {#if litD}<path class="day-side" d={litD} />{/if}
        <circle class="rim" cx={earthXY[0]} cy={earthXY[1]} r={EARTH} />
        <line class="axis" x1={earthXY[0]} y1={earthXY[1]} x2={axisEnd(1.7)[0]} y2={axisEnd(1.7)[1]} />
        <text class="halo pole" x={axisEnd(1.7)[0] + 4} y={axisEnd(1.7)[1] - 4}>N</text>
        <circle class="focus-ring" cx={earthXY[0]} cy={earthXY[1]} r="36" />
      </g>
    {/snippet}
    {#if behindSun}{@render earthGroup()}{/if}
    <g class="sun" aria-hidden="true"><circle class="glow" cx={CX} cy={CY} r={SUN * 2.4} /><circle class="disc" cx={CX} cy={CY} r={SUN} /><text class="halo" x={CX} y={CY + 5} text-anchor="middle">{t('seasons.sun')}</text></g>
    {#if !behindSun}{@render earthGroup()}{/if}
    <text class="halo polaris" x={W - 16} y="24" text-anchor="end">↑ N · {t('seasons.polaris')}</text>
  </svg>
  <figcaption class="date" aria-hidden="true">{valueText}</figcaption>
  <p id="{uid}-hint" class="visually-hidden">{t('seasons.orbit.hint')}</p>
</figure>
```
CSS essentials: `.orbit svg { width: 100%; height: auto; touch-action: none; }`, `.orbit-path { fill: none; stroke: var(--grid); stroke-width: 2; stroke-dasharray: 6 5; }`, `.night-side { fill: #22324a; }`, `.day-side { fill: #9cc6ef; }`, `.rim { fill: none; stroke: var(--text); stroke-width: 1.5; }`, `.axis { stroke: var(--text); stroke-width: 2.2; }`, `.hit { fill: transparent; cursor: grab; }`, `.focus-ring { fill: none; stroke: var(--focus); stroke-width: 3; opacity: 0; }`, `.earth:focus { outline: none; } .earth:focus-visible .focus-ring { opacity: 1; }`, `.sun .disc { fill: var(--sun); stroke: var(--sun-stroke); stroke-width: 2; } .sun .glow { fill: var(--sun); opacity: 0.18; }`, `.mark circle { fill: var(--text-muted); }`, text `font-size: 15px; fill: var(--text);`, `.date { text-align: center; font-weight: var(--weight-heavy); font-size: var(--step-1); }`. The `hit` circle is 34 view units: at the smallest layout (orbit 288 CSS px wide) that is ≥ 30 CSS px; also give the focus/hit area `r = max(34, 22 × view units per CSS px)` by measuring `svg.clientWidth` (`let cssW = $state(640)` with `bind:clientWidth` on the figure; `const hitR = $derived(Math.max(34, 22 * (W / Math.max(1, cssW))))`) so the touch target is ≥ 44 CSS px.

- [ ] **Step 5: `src/map/SeasonsReadout.svelte`**

```svelte
<script lang="ts">
  import { formatLat } from '../geo/format';
  import { dayInfo, polarLimits, splitMinutes } from '../geo/seasons';
  import { dateFromDayAndMinutes } from '../geo/sun';
  import { formatClock } from '../geo/time';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { mapState } from './mapState.svelte';

  // Spec §6.1 readout for the movable point, at noon UTC of the scene's day, in the lesson's notation.
  const info = $derived.by(() => {
    const s = mapState.sun, p = mapState.point;
    return s && p ? dayInfo(p.lat, dateFromDayAndMinutes(s.year, s.dayOfYear, 720), mapState.realSun) : null;
  });
  const limits = $derived(info ? polarLimits(info.declination) : null);
  const duration = (m: number) => { const { h, m: min } = splitMinutes(m); return t('seasons.duration', { h, m: String(min).padStart(2, '0') }); };
  const lat = (v: number) => formatLat(v, i18n.lang, 'minute');
</script>

{#if info}
  <section class="seasons" aria-labelledby="seasons-title">
    <h3 id="seasons-title">{t('seasons.readout')}</h3>
    <dl>
      <div><dt>{t('seasons.dayLength')}</dt><dd>{duration(info.dayMinutes)}</dd></div>
      {#if info.polar === 'day'}<p class="polar">{t('seasons.polarDayHere')}</p>
      {:else if info.polar === 'night'}<p class="polar">{t('seasons.polarNightHere')}</p>
      {:else}
        <div><dt>{t('seasons.sunrise')}</dt><dd>{formatClock(info.sunrise!)} <span class="unit">({t('seasons.solarTime')})</span></dd></div>
        <div><dt>{t('seasons.sunset')}</dt><dd>{formatClock(info.sunset!)} <span class="unit">({t('seasons.solarTime')})</span></dd></div>
      {/if}
    </dl>
    <p>{t('seasons.overhead', { lat: lat(info.declination) })}</p>
    {#if limits}
      <p>{t(limits.day.hemisphere === 'N' ? 'seasons.polarDayNorth' : 'seasons.polarDaySouth', { lat: lat(limits.day.hemisphere === 'N' ? limits.day.lat : -limits.day.lat) })}</p>
      <p>{t(limits.night.hemisphere === 'N' ? 'seasons.polarNightNorth' : 'seasons.polarNightSouth', { lat: lat(limits.night.hemisphere === 'N' ? limits.night.lat : -limits.night.lat) })}</p>
    {:else}
      <p>{t('seasons.equinoxNoPolar')}</p>
    {/if}
  </section>
{/if}
```
CSS: a card like `.lab` (`background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-3) var(--space-4)`), `dl div { display: flex; justify-content: space-between; gap: var(--space-3); }`, `dd { margin: 0; font-weight: var(--weight-heavy); font-variant-numeric: tabular-nums; }`, `.unit { font-weight: 500; color: var(--text-muted); font-size: var(--step--1); }`, `h3 { margin: 0 0 var(--space-2); font-size: var(--step-1); }`, `p { margin: var(--space-1) 0 0; }`. A UK coordinate inside a sentence keeps together: pass it through `keepTogether` from `src/i18n/text.ts` (`lat(v)` → `keepTogether(formatLat(v, i18n.lang, 'minute'))`).

- [ ] **Step 6: Stage, lab controls, lab page**

`src/map/MapStage.svelte`: import `OrbitView`; in the views loop `{#if v === 'globe'}<Globe />{:else if v === 'flat'}<FlatMap />{:else if v === 'orbit'}<OrbitView />{:else}<CrossSection />{/if}`; CSS:
```css
  /* The orbit takes its own row above globe and map; with the globe alone they share a row. */
  .views.wide:has(.view-orbit):has(.view-flat) .view-orbit { grid-column: 1 / -1; justify-self: center; width: min(100%, 44rem); }
  .views.wide:has(.view-orbit):has(.view-globe):not(:has(.view-flat)) { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); }
```

`src/map/LabControls.svelte`:
- The outer `{#if mapState.layers.daylight || has('sun-time') …}` also shows for `has('seasons')`.
- After the key dates group (inside `{#if has('sun-date')}` or on its own when only `seasons`), add:
```svelte
      {#if has('seasons') && mapState.orbitToggle}
        <button type="button" class="btn seasons-toggle" aria-pressed={mapState.views.includes('orbit')} onclick={() => mapState.toggleOrbit()}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="12" rx="9.5" ry="4.5" /><circle cx="12" cy="12" r="2.6" /><circle cx="4.2" cy="13.6" r="1.6" /></svg>
          {t('lab.seasons')}
        </button>
      {/if}
```
- After the clocks (end of `.lab`): `{#if has('seasons') && mapState.views.includes('orbit') && mapState.point}<SeasonsReadout />{/if}`.

`src/app/LabPage.svelte`: labControls `['sun-time', 'sun-date', 'now', 'clocks', 'real-sun', 'seasons']`.

- [ ] **Step 7: E2E `tests/e2e/seasons.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

test('lab Seasons mode: the orbit sets the date by keyboard; globe, map and readout follow', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await page.evaluate(() => { (window as unknown as { __mapState: { sun: unknown } }).__mapState.sun = { utcMinutes: 720, dayOfYear: 80, year: 2026 }; });
  const toggle = page.getByRole('button', { name: 'Seasons mode' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const earth = page.getByRole('slider', { name: 'Date on the Earth\'s orbit' });
  await expect(earth).toHaveAttribute('aria-valuetext', '21 March');
  await earth.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('PageUp');
  await expect(earth).toHaveAttribute('aria-valuetext', '21 June, June solstice');
  await expect(page.getByRole('slider', { name: 'Day of the year' })).toHaveAttribute('aria-valuetext', /21 June/);
  const readout = page.getByRole('region', { name: 'Seasons at the point' });
  // The lab's point is Katowice snapped to whole degrees (50°N): 16 h 09 min on 21 June.
  await expect(readout).toContainText(/Day length\s*16 h 09 min/);
  await expect(readout).toContainText('Sun overhead at 23°26′N');
  await expect(readout).toContainText('Polar day north of 66°34′N');
  await expect(readout).toContainText('Polar night south of 66°34′S');
  await page.keyboard.press('End');
  await expect(earth).toHaveAttribute('aria-valuetext', '31 December');
  await page.keyboard.press('Home');
  await expect(earth).toHaveAttribute('aria-valuetext', '1 January');
  await page.keyboard.press('ArrowLeft');
  await expect(earth).toHaveAttribute('aria-valuenow', '1');
  await expectNoAxeViolations(page, 'lab seasons');
  await toggle.click();
  await expect(earth).toHaveCount(0);
  expect(pageErrors(page)).toEqual([]);
});

test('dragging the Earth to the left of the Sun gives June; a point in the Arctic reads polar day', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await page.evaluate(() => { const s = (window as unknown as { __mapState: { sun: unknown; setPoint(p: object): void; pointEditable: boolean } }).__mapState; s.sun = { utcMinutes: 720, dayOfYear: 80, year: 2026 }; s.setPoint({ lat: 75, lon: 20 }); });
  await page.getByRole('button', { name: 'Seasons mode' }).click();
  const svg = page.locator('.view-orbit svg');
  const box = (await svg.boundingBox())!;
  // The orbit's left end (June) in view units is (320 − 250, 196) of a 640 × 380 viewBox.
  await page.mouse.move(box.x + box.width * (70 / 640), box.y + box.height * (196 / 380));
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByRole('slider', { name: 'Date on the Earth\'s orbit' })).toHaveAttribute('aria-valuetext', /June/);
  await expect(page.getByRole('region', { name: 'Seasons at the point' })).toContainText('Polar day: the Sun does not set');
});

test('the Seasons readout in Polish and Ukrainian notation', async ({ page }) => {
  await openPage(page, 'uk/lab', '?test');
  await page.evaluate(() => { (window as unknown as { __mapState: { sun: unknown } }).__mapState.sun = { utcMinutes: 720, dayOfYear: 355, year: 2026 }; });
  await page.getByRole('button', { name: 'Режим пір року' }).click();
  const readout = page.getByRole('region', { name: 'Пори року в точці' });
  await expect(readout).toContainText(/Сонце в зеніті над 23°26′\s?пд\.\s?ш\./);
  await expect(readout).toContainText(/7 год 51 хв/); // 50°N on 21 December
});

test('on a phone the orbit is one of the views, and nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openPage(page, 'pl/lab');
  await page.getByRole('button', { name: 'Tryb pór roku' }).click();
  await page.getByRole('button', { name: 'Orbita' }).click();
  await expect(page.getByRole('slider', { name: 'Data na orbicie Ziemi' })).toBeVisible();
  const hit = await page.locator('.view-orbit .earth .hit').boundingBox();
  expect(Math.min(hit!.width, hit!.height)).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await expectNoAxeViolations(page, 'lab seasons phone');
});
```
The lab's point starts at Katowice snapped to 50°N (`precision: 'auto'` at world zoom), where `dayLightMinutes` gives 968.8 min (16 h 09 min) on 21 June and 471.2 min (7 h 51 min) on 21 December; `dt` and `dd` texts run together in `toContainText`. The first test's March date comes from `dayOfYear: 80` in 2026 (21 March).

- [ ] **Step 8: Run, look, commit**

```bash
npx vitest run tests/unit/mapState-orbit.test.ts
npm run check && npm test
npm run build && npx playwright test tests/e2e/seasons.spec.ts tests/e2e/lab.spec.ts tests/e2e/responsive.spec.ts tests/e2e/atlas-baseline.spec.ts
npm run shot -- en/lab lab-seasons
```
Expected: PASS. Before the shot, turn Seasons mode on in a scratch copy of the script or look at it in the Playwright MCP browser: the axis leans right, the lit side faces the Sun at every date, the Earth passes behind the Sun at the top of the orbit, labels do not overlap at 375 and 1366 px, and the side panel still fits one 1366×768 screen.
```bash
git add src/map/OrbitView.svelte src/map/SeasonsReadout.svelte src/map/types.ts src/map/mapState.svelte.ts src/map/MapStage.svelte src/map/LabControls.svelte src/app/LabPage.svelte src/i18n scripts/translation-review-lib.ts tests/unit/mapState-orbit.test.ts tests/e2e/seasons.spec.ts
git commit -m "feat(lab): Seasons mode with the Earth's orbit, day length, sunrise, sunset and polar limits"
```

---

### Task 19: Topic 10 "Why we have seasons" (explore only)

**Files:**
- Create: `src/topics/t10-seasons.ts`
- Modify: `src/app/ids.ts`, `src/app/router.ts`, `src/topics/index.ts`, `src/i18n/en.json`, `src/i18n/pl.json`, `src/i18n/uk.json`
- Modify existing tests (planning ruling R10 — only these three assertions): `tests/unit/router.test.ts`, `tests/unit/topics.test.ts`, `tests/e2e/explore.spec.ts`
- Test: `tests/unit/topic10.test.ts`, `tests/e2e/topic10.spec.ts`

**Interfaces:**
- Consumes: `ViewId 'orbit'`, `LabControl 'seasons'`, `OrbitView`, `SeasonsReadout` (Task 18); `solarParams`, `dayLightMinutes`, `dateFromDayAndMinutes`, `daysInYear` (sun.ts); `AXIAL_TILT` (orbit.ts); `formatLat`; `HOME`, `placeById` (`src/map/places.ts`); `TopicDef`, `ExploreStep` (`src/topics/types.ts`).
- Produces: `TopicId` includes `10`; `TOPIC_IDS = [1, …, 10]`; `topic10: TopicDef` with steps `orbit`, `tilt`, `june`, `december`, `equinox`, `katowice`, `play`; i18n `topic.10.title`, `topic.10.summary`, `topic.10.step.<id>.title|body`.

- [ ] **Step 1: Failing number test `tests/unit/topic10.test.ts`**

Every number in the step texts is checked here against `src/geo/sun.ts` (spec §6.2).
```ts
import { describe, expect, test } from 'vitest';
import en from '../../src/i18n/en.json';
import pl from '../../src/i18n/pl.json';
import uk from '../../src/i18n/uk.json';
import { formatLat } from '../../src/geo/format';
import { AXIAL_TILT } from '../../src/geo/orbit';
import { dateFromDayAndMinutes, dayLightMinutes, daysInYear, solarParams } from '../../src/geo/sun';
import type { LangCode } from '../../src/geo/types';
import { HOME, placeById } from '../../src/map/places';
import { TOPICS } from '../../src/topics';

const FILES: Record<LangCode, Record<string, string>> = { en, pl, uk };
const body = (lang: LangCode, id: string) => FILES[lang][`topic.10.step.${id}.body`]!;
const decl = (month: number, day: number) => solarParams(new Date(Date.UTC(2026, month, day, 12))).declination;
const hours = (lat: number, month: number, day: number) => Math.round(dayLightMinutes(lat, decl(month, day)) / 60);
const HOURS: Record<LangCode, (n: number) => string> = { en: (n) => `about ${n} hours`, pl: (n) => `około ${n} godzin`, uk: (n) => `близько ${n} годин` };

describe('topic 10: the numbers in the texts are what the model says', () => {
  const topic = TOPICS[10]!;
  test('explore only, seven steps, the last one free play at Katowice', () => {
    expect(topic.questionTypes).toEqual([]);
    expect(topic.steps.map((s) => s.id)).toEqual(['orbit', 'tilt', 'june', 'december', 'equinox', 'katowice', 'play']);
    expect(topic.steps.at(-1)!.scene.point).toEqual(HOME);
  });

  test('orbit: a year is 365 days', () => {
    expect(daysInYear(2026)).toBe(365);
    for (const lang of ['en', 'pl', 'uk'] as const) expect(body(lang, 'orbit')).toContain('365');
  });

  test('tilt: about 23½°, the largest declination of the year', () => {
    let max = 0;
    for (let d = 1; d <= 365; d++) max = Math.max(max, Math.abs(solarParams(dateFromDayAndMinutes(2026, d, 720)).declination));
    expect(Math.round(max * 2) / 2).toBe(23.5);
    expect(Math.round(AXIAL_TILT * 2) / 2).toBe(23.5);
    for (const lang of ['en', 'pl', 'uk'] as const) expect(body(lang, 'tilt')).toContain('23½°');
  });

  test('June: the Sun overhead at 23°26′N on 21 June; polar day inside the Arctic Circle (66.6°N)', () => {
    for (const lang of ['en', 'pl', 'uk'] as const) {
      expect(body(lang, 'june')).toContain(formatLat(decl(5, 21), lang, 'minute'));
      expect(body(lang, 'june')).toContain('21');
    }
    expect(dayLightMinutes(66.6, decl(5, 21))).toBe(1440);
  });

  test('December: 23°26′S on 21 December; polar night inside the Arctic Circle; topic 1 has the tropics step', () => {
    for (const lang of ['en', 'pl', 'uk'] as const) {
      expect(body(lang, 'december')).toContain(formatLat(decl(11, 21), lang, 'minute'));
      expect(body(lang, 'december')).toMatch(/\b1\b/);
    }
    expect(dayLightMinutes(66.6, decl(11, 21))).toBe(0);
    expect(TOPICS[1]!.steps.map((s) => s.id)).toContain('tropics');
  });

  test('equinoxes: the Sun over the equator on 20 March and 23 September; about 12 hours of day everywhere', () => {
    for (const [m, d] of [[2, 20], [8, 23]] as const) {
      expect(Math.abs(decl(m, d))).toBeLessThan(0.5);
      for (let lat = -60; lat <= 60; lat += 10) expect(Math.abs(dayLightMinutes(lat, decl(m, d)) - 720), `${lat} ${m}`).toBeLessThanOrEqual(15);
    }
    for (const lang of ['en', 'pl', 'uk'] as const) for (const n of ['20', '23', '12']) expect(body(lang, 'equinox'), `${lang} ${n}`).toContain(n);
  });

  test('Katowice and Sydney: rounded day lengths at the solstices', () => {
    const sydney = placeById('sydney');
    expect([hours(HOME.lat, 5, 21), hours(HOME.lat, 11, 21), hours(sydney.lat, 5, 21), hours(sydney.lat, 11, 21)]).toEqual([16, 8, 10, 14]);
    for (const lang of ['en', 'pl', 'uk'] as const) {
      const text = body(lang, 'katowice');
      for (const n of [16, 8, 10, 14]) expect(text, `${lang} ${n}`).toContain(HOURS[lang](n));
      expect(text).toContain(formatLat(HOME.lat, lang));
      expect(text).toContain(formatLat(sydney.lat, lang));
    }
  });
});
```
`formatLat(HOME.lat, 'en')` is `50°N`, `formatLat(-33.87, 'uk')` is `34° пд. ш.`. Run: `npx vitest run tests/unit/topic10.test.ts` — Expected: FAIL (`TOPICS[10]` undefined).

- [ ] **Step 2: Topic id, router, the three existing assertions**

`src/app/ids.ts`:
```ts
export type TopicId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export const TOPIC_IDS: readonly TopicId[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
```
`src/app/router.ts`: `const m = /^topic-([1-9]\d?)$/.exec(head ?? '');` (two digits, no leading zero).

`tests/unit/router.test.ts`: replace the row `['#en/topic-10', { name: 'home', lang: 'en' }],` with
```ts
    ['#en/topic-10', { name: 'explore', lang: 'en', topic: 10, step: 0 }],
    ['#en/topic-11', { name: 'home', lang: 'en' }],
    ['#en/topic-01', { name: 'home', lang: 'en' }],
```
`tests/unit/topics.test.ts`: `if (id !== 9)` → `if (id !== 9 && id !== 10)` (and the test's title stays).
`tests/e2e/explore.spec.ts`: `await expect(page.getByRole('link', { name: /Next topic/ })).toHaveCount(0);` → `await expect(page.getByRole('link', { name: 'Next topic: Why we have seasons' })).toBeVisible();`

- [ ] **Step 3: `src/topics/t10-seasons.ts`**

```ts
import type { SceneSpec } from '../map/types';
import { HOME, placeById } from '../map/places';
import type { TopicDef } from './types';

// Explore only (spec §6.2): no question types, so Practise, the rehearsal, the class quiz and the worksheet leave it out.
// Days of the year are for a common year: 21 June = 172, 23 September = 266, 21 December = 355 (a day earlier in a leap year).
const JUNE = { utcMinutes: 720, dayOfYear: 172 };
const SEPTEMBER = { utcMinutes: 720, dayOfYear: 266 };
const DECEMBER = { utcMinutes: 720, dayOfYear: 355 };
const SYDNEY = placeById('sydney');
const LIGHT = { specialLines: true, tropics: true, daylight: true, places: false } satisfies SceneSpec['layers'];

export const topic10: TopicDef = {
  id: 10,
  questionTypes: [],
  steps: [
    { id: 'orbit', scene: { views: ['orbit', 'globe'], phoneView: 'orbit', point: null, rotate: [0, -20], sun: JUNE, layers: LIGHT } },
    { id: 'tilt', scene: { views: ['orbit', 'globe'], phoneView: 'orbit', point: null, rotate: [-20, -35], sun: DECEMBER, layers: LIGHT } },
    { id: 'june', scene: { views: ['globe', 'flat'], phoneView: 'globe', point: null, rotate: [-20, -45], sun: JUNE, layers: LIGHT, labControls: ['sun-time'] } },
    { id: 'december', scene: { views: ['globe', 'flat'], phoneView: 'globe', point: null, rotate: [-20, -45], sun: DECEMBER, layers: LIGHT, labControls: ['sun-time'] } },
    { id: 'equinox', scene: { views: ['globe', 'flat'], phoneView: 'globe', point: null, rotate: [-20, -15], sun: SEPTEMBER, layers: LIGHT, labControls: ['sun-time'] } },
    {
      id: 'katowice',
      scene: {
        views: ['orbit', 'flat'], phoneView: 'orbit', point: HOME, sun: JUNE, layers: { specialLines: true, tropics: true, daylight: true },
        overlays: [{ kind: 'marker', p: { lat: SYDNEY.lat, lon: SYDNEY.lon }, tone: 'b', labelKey: 'place.sydney' }], labControls: ['seasons'],
      },
    },
    {
      id: 'play', showPlaces: true,
      scene: { views: ['orbit', 'globe', 'flat'], phoneView: 'orbit', point: HOME, pointEditable: true, precision: 'auto', sun: SEPTEMBER, layers: { graticuleStep: 'auto', specialLines: true, tropics: true, daylight: true }, labControls: ['seasons', 'sun-time'] },
    },
  ],
};
```
`src/topics/index.ts`: `import { topic10 } from './t10-seasons';` and add `10: topic10` to `TOPICS`.

The `katowice` step's point keeps degree precision (the scene default), so the readout shows Katowice at 50°N — the same latitude the text names.

- [ ] **Step 4: Texts (EN / PL / UK)**

| key | en | pl | uk |
|---|---|---|---|
| `topic.10.title` | Why we have seasons | Skąd się biorą pory roku | Чому бувають пори року |
| `topic.10.summary` | The Earth's orbit, its tilted axis, solstices and equinoxes | Orbita Ziemi, nachylona oś, przesilenia i równonoce | Орбіта Землі, нахилена вісь, сонцестояння й рівнодення |
| `topic.10.step.orbit.title` | Around the Sun in a year | Dookoła Słońca w rok | Навколо Сонця за рік |
| `topic.10.step.orbit.body` | The Earth travels around the Sun on a path called an orbit. One trip takes a year: 365 days. At the same time the Earth spins around its axis once a day. Drag the Earth along its orbit, or use the arrow keys, to change the date. | Ziemia krąży wokół Słońca po drodze zwanej orbitą. Jedno okrążenie trwa rok, czyli 365 dni. W tym samym czasie Ziemia raz na dobę obraca się wokół własnej osi. Przeciągnij Ziemię po orbicie albo użyj strzałek, żeby zmienić datę. | Земля рухається навколо Сонця шляхом, який називають орбітою. Один оберт триває рік — 365 днів. Водночас Земля щодоби обертається навколо своєї осі. Перетягни Землю по орбіті або скористайся стрілками, щоб змінити дату. |
| `topic.10.step.tilt.title` | A tilted axis | Nachylona oś | Нахилена вісь |
| `topic.10.step.tilt.body` | The Earth's axis is tilted by about 23½°. As the Earth goes around the Sun, the axis always points the same way in space: towards the North Star. So for half of the year the Northern Hemisphere leans towards the Sun, and for the other half the Southern Hemisphere does. | Oś Ziemi jest nachylona o około 23½°. Gdy Ziemia krąży wokół Słońca, oś zawsze wskazuje w przestrzeni ten sam kierunek: w stronę Gwiazdy Polarnej. Dlatego przez pół roku do Słońca bardziej zwrócona jest półkula północna, a przez drugie pół roku półkula południowa. | Вісь Землі нахилена приблизно на 23½°. Коли Земля рухається навколо Сонця, вісь завжди спрямована в космосі в той самий бік — на Полярну зорю. Тому пів року до Сонця більше нахилена Північна півкуля, а другі пів року — Південна. |
| `topic.10.step.june.title` | June solstice | Przesilenie czerwcowe | Червневе сонцестояння |
| `topic.10.step.june.body` | Around 21 June the Northern Hemisphere leans towards the Sun. It is summer there and the days are long. At noon the Sun is overhead at the Tropic of Cancer, 23°26′N. Inside the Arctic Circle the Sun does not set at all: this is polar day. | Około 21 czerwca półkula północna jest zwrócona w stronę Słońca. Jest tam lato, a dni są długie. W południe Słońce stoi w zenicie nad Zwrotnikiem Raka, na 23°26′N. Za kołem podbiegunowym północnym Słońce w ogóle nie zachodzi: to dzień polarny. | Близько 21 червня Північна півкуля нахилена до Сонця. Там літо, і дні довгі. Опівдні Сонце стоїть у зеніті над Тропіком Рака, на 23°26′ пн. ш. За Північним полярним колом Сонце взагалі не заходить: це полярний день. |
| `topic.10.step.december.title` | December solstice | Przesilenie grudniowe | Грудневе сонцестояння |
| `topic.10.step.december.body` | Around 21 December it is the other way round. The Southern Hemisphere leans towards the Sun and has summer, while in Poland it is winter and the days are short. The Sun is overhead at the Tropic of Capricorn, 23°26′S, and inside the Arctic Circle the Sun does not rise: this is polar night. You met these lines in topic 1. | Około 21 grudnia jest odwrotnie. To półkula południowa jest zwrócona w stronę Słońca i ma lato, a w Polsce jest zima i krótkie dni. Słońce stoi w zenicie nad Zwrotnikiem Koziorożca, na 23°26′S, a za kołem podbiegunowym północnym Słońce nie wschodzi: to noc polarna. Te linie znasz z tematu 1. | Близько 21 грудня все навпаки. До Сонця нахилена Південна півкуля, і там літо, а в Польщі зима й короткі дні. Сонце стоїть у зеніті над Тропіком Козерога, на 23°26′ пд. ш., а за Північним полярним колом Сонце не сходить: це полярна ніч. Ці лінії ти вже знаєш із теми 1. |
| `topic.10.step.equinox.title` | Equinoxes | Równonoce | Рівнодення |
| `topic.10.step.equinox.body` | Around 20 March and 23 September neither hemisphere leans towards the Sun. At noon the Sun is overhead at the equator, and day and night last about 12 hours everywhere on Earth. 23 September is an equinox: autumn begins in the Northern Hemisphere and spring in the Southern Hemisphere. | Około 20 marca i 23 września żadna półkula nie jest bardziej zwrócona w stronę Słońca. W południe Słońce stoi w zenicie nad równikiem, a dzień i noc trwają wszędzie na Ziemi około 12 godzin. 23 września jest równonoc: na półkuli północnej zaczyna się jesień, a na południowej wiosna. | Близько 20 березня і 23 вересня жодна півкуля не нахилена до Сонця більше за іншу. Опівдні Сонце стоїть у зеніті над екватором, а день і ніч скрізь на Землі тривають близько 12 годин. 23 вересня — рівнодення: у Північній півкулі починається осінь, а в Південній — весна. |
| `topic.10.step.katowice.title` | Seasons in Katowice | Pory roku w Katowicach | Пори року в Катовицях |
| `topic.10.step.katowice.body` | Katowice lies at 50°N. Around 21 June a day there lasts about 16 hours, but around 21 December only about 8 hours. Sydney, at 34°S, has it the other way round: about 10 hours in June and about 14 hours in December. Move the Earth and watch the day length for the point. | Katowice leżą na 50°N. Około 21 czerwca dzień trwa tu około 16 godzin, a około 21 grudnia tylko około 8 godzin. W Sydney, na 34°S, jest odwrotnie: w czerwcu dzień trwa około 10 godzin, a w grudniu około 14 godzin. Przesuń Ziemię i obserwuj długość dnia w punkcie. | Катовиці лежать на 50° пн. ш. Близько 21 червня день там триває близько 16 годин, а близько 21 грудня — лише близько 8 годин. У Сіднеї, на 34° пд. ш., навпаки: у червні день триває близько 10 годин, а в грудні — близько 14 годин. Пересунь Землю й стеж за тривалістю дня в точці. |
| `topic.10.step.play.title` | Try it yourself | Spróbuj sam | Спробуй сам |
| `topic.10.step.play.body` | Move the Earth around the Sun and move the point. Watch the day length, where the Sun is overhead, and where polar day and polar night begin. | Przesuwaj Ziemię wokół Słońca i przesuwaj punkt. Obserwuj długość dnia, miejsce, nad którym Słońce stoi w zenicie, i to, gdzie zaczyna się dzień polarny i noc polarna. | Пересувай Землю навколо Сонця й пересувай точку. Стеж за тривалістю дня, за тим, де Сонце в зеніті, і де починаються полярний день і полярна ніч. |

Wording checks the implementer must keep: the Polish `około 8 godzin` (not `8 godziny`), the Ukrainian `близько 8 годин`, and the notation from `formatLat` (`23°26′N`, `23°26′ пн. ш.`). The `i18n.test.ts` "sums never break" test is unaffected (no operators).

Run: `npx vitest run tests/unit/topic10.test.ts tests/unit/topics.test.ts tests/unit/router.test.ts tests/unit/i18n.test.ts` — Expected: PASS.

- [ ] **Step 5: E2E `tests/e2e/topic10.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

for (const lang of ['en', 'pl', 'uk'] as const) {
  test(`topic 10 in ${lang}: every step renders; axe on every step`, async ({ page }) => {
    await openPage(page, `${lang}/topic-10/explore`);
    const total = await page.locator('.dots li').count();
    expect(total).toBe(7);
    for (let i = 0; i < total; i++) {
      await page.goto(page.url().replace(/#.*/, `#${lang}/topic-10/explore/${i + 1}`));
      await expect(page.locator('#step-title')).not.toBeEmpty();
      await expectNoAxeViolations(page, `${lang} t10 s${i + 1}`);
    }
    expect(pageErrors(page)).toEqual([]);
  });
}

test('topic 10 is Explore only and comes after topic 9', async ({ page }) => {
  await openPage(page, 'en/');
  const card = page.locator('.card').filter({ has: page.getByRole('link', { name: 'Why we have seasons' }) });
  await expect(card).toHaveCount(1);
  await expect(card.getByRole('link', { name: /Practise/ })).toHaveCount(0);
  await openPage(page, 'en/topic-10/practice');
  await expect(page).toHaveURL(/#en\/topic-10\/explore$/);
  await expect(page.getByRole('link', { name: 'Previous topic: Coordinates in your phone' })).toBeVisible();
  await openPage(page, 'en/class-quiz');
  await expect(page.getByLabel(/Why we have seasons/)).toHaveCount(0);
});

test('topic 10 by keyboard: the Katowice step moves the Earth to December and the day shortens', async ({ page }) => {
  await openPage(page, 'en/topic-10/explore/6');
  const readout = page.getByRole('region', { name: 'Seasons at the point' });
  await expect(readout).toContainText(/Day length\s*16 h \d\d min/);
  const earth = page.getByRole('slider', { name: "Date on the Earth's orbit" });
  await earth.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press('PageUp');
  await expect(earth).toHaveAttribute('aria-valuetext', /21 December/);
  await expect(readout).toContainText(/Day length\s*7 h \d\d min/);
  // Arrow keys on the slider change the date, not the step.
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/explore\/6$/);
  await expect(earth).toHaveAttribute('aria-valuetext', /22 December/);
});
```
Explore's own ← → keys ignore focus inside `[role="slider"]` (`src/app/Explore.svelte` `isInteractive`).

- [ ] **Step 6: Run, look, commit**

```bash
npm run check && npm test
npm run build && npm run e2e
```
Expected: all PASS, including `explore.spec.ts` (with the one R10 edit), `routes.spec.ts`, `class-quiz.spec.ts` (still 8 topic checkboxes). Look at all seven steps at 375×667 and 1366×768 in EN and UK (`npm run shot -- uk/topic-10/explore/3 t10-june` etc.): orbit and globe sit side by side on wide screens; the date caption and readout do not overlap; text numbers match what the readout shows.
```bash
git add src/topics/t10-seasons.ts src/topics/index.ts src/app/ids.ts src/app/router.ts src/i18n tests/unit/topic10.test.ts tests/unit/router.test.ts tests/unit/topics.test.ts tests/e2e/explore.spec.ts tests/e2e/topic10.spec.ts
git commit -m "feat(topics): topic 10 Why we have seasons, explore only"
```
