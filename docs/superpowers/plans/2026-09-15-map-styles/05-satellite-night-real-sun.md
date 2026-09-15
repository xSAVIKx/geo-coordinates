# Part 5 — Satellite day/night with city lights; real-Sun switch (spec §9.5)

Read spec §4 "Satellite day/night" and §6.3 "Real Sun" first.

Context every task here needs:
- `src/geo/sun.ts` has a private `sunParams(date)` (NOAA series: declination and equation of time in minutes), `subsolarPoint(date)` (the real Sun: `lon = −15 × (utcHours − 12 + eqTime/60)`), `meanSunPoint(date)` (the lesson's Sun: same declination, `lon = −15 × (utcHours − 12)`), `elevationFrom(sun, p)`, `dayOfYear`, `daysInYear`, `dateFromDayAndMinutes`, `dayLightMinutes(lat, declination)`.
- `src/geo/time.ts`: `localSolarMinutes(utcMinutes, lon)`, `wrapDayMinutes`, `formatClock`, `MINUTES_PER_DEGREE = 4`.
- `MapState.sun` is `{ utcMinutes, dayOfYear, year } | null`; `MapState.sunDate()` turns it into a `Date`. The consumers of `meanSunPoint` today: `src/map/layers/Daylight.svelte`, `src/map/layers/Overlays.svelte` (noon line and its label), `src/map/layers/Places.svelte` (the noon label as an obstacle), `src/map/LabControls.svelte` (clocks, sky track).
- The lab page (`src/app/LabPage.svelte`) applies a scene with `labControls: ['sun-time', 'sun-date', 'now', 'clocks']` and then `mapState.setSunNow()`.
- Texture layer (`src/map/texture/`): `TextureLayer.svelte` builds `DrawInputs` with `night: null` so far; `loadStyleTextures(style, maxSize, withNight)`; `sunVector(p: LatLon): SunVector`; the shader (`shaders.ts`) and `cpuShade.ts` already blend day and night when `input.night` is set and a night texture is bound. The e2e helpers `setMapStyle`, `waitForTexture`, `probe(page, view, lat, lon, radius)` exist.

---

### Task 14: Sun model — real Sun in MapState (mean Sun stays the default everywhere)

**Files:**
- Modify: `src/geo/sun.ts`, `src/geo/time.ts`, `src/map/mapState.svelte.ts`, `src/map/layers/Daylight.svelte`, `src/map/layers/Overlays.svelte`, `src/map/layers/Places.svelte`, `src/map/LabControls.svelte`
- Test: `tests/unit/sun-real.test.ts` (existing `tests/unit/sun.test.ts` stays unchanged)

**Interfaces:**
- Consumes: see Context.
- Produces:
  ```ts
  // src/geo/sun.ts
  export interface SolarParams { declination: number; eqTimeMin: number; appLongitude: number }  // degrees, minutes, degrees [0, 360)
  export function solarParams(date: Date): SolarParams;
  export function sunPoint(date: Date, real: boolean): LatLon;     // real ? subsolarPoint(date) : meanSunPoint(date)
  // src/geo/time.ts
  export function apparentSolarMinutes(utcMinutes: number, lon: number, eqTimeMin: number): number;
  // MapState
  realSun: boolean;                   // $state(false), reset to false by every applyScene, never saved
  sunPoint(): LatLon | null;          // sunPoint(this.sunDate(), this.realSun)
  ```

- [ ] **Step 1: Failing test `tests/unit/sun-real.test.ts` — published values**

Reference values (UTC; NOAA/USNO almanac, 2026): equation of time on 11 February ≈ −14 min 13 s, on 3 November ≈ +16 min 26 s, on 26 July ≈ −6 min 32 s, and ≈ 0 on about 15 April, 13 June, 1 September and 25 December. Equinoxes and solstices 2026: 20 March 14:46, 21 June 08:24, 23 September 00:05, 21 December 20:50.

```ts
import { describe, expect, test } from 'vitest';
import { dateFromDayAndMinutes, meanSunPoint, solarParams, subsolarPoint, sunPoint } from '../../src/geo/sun';
import { apparentSolarMinutes, localSolarMinutes } from '../../src/geo/time';
import { MapState } from '../../src/map/mapState.svelte';
import { TOPICS } from '../../src/topics';

const close = (a: number, b: number, tol: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);
const noon = (iso: string) => solarParams(new Date(`${iso}T12:00:00Z`));

describe('equation of time and declination against published values (2026)', () => {
  test('equation of time', () => {
    close(noon('2026-02-11').eqTimeMin, -14.22, 0.3);
    close(noon('2026-11-03').eqTimeMin, 16.43, 0.3);
    close(noon('2026-07-26').eqTimeMin, -6.53, 0.3);
    for (const d of ['2026-04-15', '2026-06-13', '2026-09-01', '2026-12-25']) close(noon(d).eqTimeMin, 0, 0.6);
  });
  test('declination and the Sun\'s apparent longitude at the equinoxes and solstices', () => {
    const at = (iso: string) => solarParams(new Date(iso));
    close(at('2026-03-20T14:46:00Z').declination, 0, 0.02);
    close(at('2026-06-21T08:24:00Z').declination, 23.44, 0.02);
    close(at('2026-09-23T00:05:00Z').declination, 0, 0.02);
    close(at('2026-12-21T20:50:00Z').declination, -23.44, 0.02);
    close(Math.min(at('2026-03-20T14:46:00Z').appLongitude, 360 - at('2026-03-20T14:46:00Z').appLongitude), 0, 0.02);
    close(at('2026-06-21T08:24:00Z').appLongitude, 90, 0.02);
    close(at('2026-09-23T00:05:00Z').appLongitude, 180, 0.02);
    close(at('2026-12-21T20:50:00Z').appLongitude, 270, 0.02);
  });
  test('the spec note: the real Sun is up to 16 minutes off clock time, so noon moves up to 4°', () => {
    let max = 0;
    for (let day = 1; day <= 365; day++) max = Math.max(max, Math.abs(solarParams(dateFromDayAndMinutes(2026, day, 720)).eqTimeMin));
    expect(Math.floor(max)).toBe(16);
    expect(Math.floor(max / 4)).toBe(4);
  });
});

describe('mean Sun and real Sun', () => {
  test('sunPoint is the lesson\'s mean Sun unless asked for the real one', () => {
    const d = new Date('2026-11-03T12:00:00Z');
    expect(sunPoint(d, false)).toEqual(meanSunPoint(d));
    expect(sunPoint(d, true)).toEqual(subsolarPoint(d));
    close(sunPoint(d, true).lon, -16.43 / 4, 0.1);
  });
  test('apparent solar time = mean solar time + equation of time', () => {
    expect(apparentSolarMinutes(720, 0, 16.43)).toBe(736);
    expect(apparentSolarMinutes(720, 21, 0)).toBe(localSolarMinutes(720, 21));
    expect(apparentSolarMinutes(10, -10, -14.2)).toBe(1396);
  });
  test('MapState uses the mean Sun unless its switch is on, and every scene switches it off', () => {
    const s = new MapState();
    s.applyScene({ views: ['flat'], sun: { utcMinutes: 720, dayOfYear: 307 } });
    const mean = s.sunPoint()!;
    s.realSun = true;
    expect(s.sunPoint()!.lon).not.toBe(mean.lon);
    s.applyScene({ views: ['flat'], sun: { utcMinutes: 720, dayOfYear: 307 } });
    expect(s.realSun).toBe(false);
    expect(s.sunPoint()).toEqual(mean);
  });
  test('no topic scene can turn on the real Sun (lessons and topic 8 always use the mean Sun)', () => {
    for (const topic of Object.values(TOPICS)) for (const step of topic!.steps) expect(JSON.stringify(step.scene), `${topic!.id} ${step.id}`).not.toMatch(/realSun|real-sun/);
  });
});
```
Run: `npx vitest run tests/unit/sun-real.test.ts` — Expected: FAIL (`solarParams` not exported).

- [ ] **Step 2: `src/geo/sun.ts`**

Rename `sunParams` to an exported `solarParams`, return the apparent longitude too (the body is otherwise the existing NOAA code, shown here in full so nothing is lost):
```ts
export interface SolarParams { declination: number; eqTimeMin: number; appLongitude: number }

/** NOAA's solar position series: declination (°), equation of time (minutes: apparent − mean solar time) and the Sun's apparent ecliptic longitude (°, 0–360). */
export function solarParams(date: Date): SolarParams {
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
  return { declination, eqTimeMin, appLongitude: ((appLong % 360) + 360) % 360 };
}
```
Replace the two internal calls (`sunParams(date)`) in `subsolarPoint` and `meanSunPoint` with `solarParams(date)`. Add:
```ts
/** The Sun the scene uses: the lesson's mean Sun, or (the lab's advanced switch, spec §6.3) the real Sun. */
export function sunPoint(date: Date, real: boolean): LatLon {
  return real ? subsolarPoint(date) : meanSunPoint(date);
}
```
`src/geo/time.ts`:
```ts
/** Apparent (real Sun) solar time: local mean solar time plus the equation of time, in whole minutes. */
export function apparentSolarMinutes(utcMinutes: number, lon: number, eqTimeMin: number): number {
  return wrapDayMinutes(utcMinutes + normalizeLon(lon) * MINUTES_PER_DEGREE + eqTimeMin);
}
```

- [ ] **Step 3: `MapState.realSun` and `sunPoint()`**

```ts
import { dateFromDayAndMinutes, dayOfYear, daysInYear, sunPoint } from '../geo/sun';
…
  /** The lab's "Advanced: real Sun" switch (spec §6.3): off by default, not saved, off again with every scene. */
  realSun = $state(false);
…
  /** Where the Sun stands overhead at the scene's date and time: the mean Sun, or the real Sun with the switch on. */
  sunPoint(): LatLon | null {
    const d = this.sunDate();
    return d ? sunPoint(d, this.realSun) : null;
  }
```
In `replaceScene`: `this.realSun = false;` (next to `this.sun = …`).

- [ ] **Step 4: Use `sunPoint` in the layers and the lab controls**

- `Daylight.svelte`: `const sun = sunPoint(date, mapState.realSun);` (import `sunPoint` instead of `meanSunPoint`).
- `Overlays.svelte`: both `meanSunPoint(date).lon` → `sunPoint(date, mapState.realSun).lon`.
- `Places.svelte`: `meanSunPoint(date).lon` → `sunPoint(date, mapState.realSun).lon`.
- `LabControls.svelte`: `const sunPoint = $derived(date ? meanSunPoint(date) : null);` → `const sunHere = $derived(date ? sunPointAt(date, mapState.realSun) : null);` (import `sunPoint as sunPointAt` to avoid the name clash; rename uses of the old `sunPoint` variable to `sunHere`), and in `clocks`:
```ts
    const eq = mapState.realSun && date ? solarParams(date).eqTimeMin : 0;
    …
        const minutes = mapState.realSun ? apparentSolarMinutes(sun.utcMinutes, r.lon, eq) : localSolarMinutes(sun.utcMinutes, r.lon);
```
With `realSun` false every value is exactly what it was, so the Atlas baseline and all existing lab and topic 8 tests are unchanged.

- [ ] **Step 5: Run and commit**

```bash
npx vitest run tests/unit/sun-real.test.ts tests/unit/sun.test.ts
npm run check && npm test
npm run build && npx playwright test tests/e2e/lab.spec.ts tests/e2e/atlas-baseline.spec.ts tests/e2e/explore.spec.ts
git add src/geo/sun.ts src/geo/time.ts src/map/mapState.svelte.ts src/map/layers/Daylight.svelte src/map/layers/Overlays.svelte src/map/layers/Places.svelte src/map/LabControls.svelte tests/unit/sun-real.test.ts
git commit -m "feat(geo): real Sun alongside the lesson's mean Sun, off unless the lab asks for it"
```
Expected: all PASS.

---

### Task 15: Satellite day/night with city lights

**Files:**
- Modify: `src/map/texture/TextureLayer.svelte`, `src/map/layers/Daylight.svelte`, `src/map/LabControls.svelte`, `src/i18n/en.json`, `src/i18n/pl.json`, `src/i18n/uk.json`
- Test: `tests/e2e/satellite-night.spec.ts`

**Interfaces:**
- Consumes: `mapState.sunPoint()`, `mapState.realSun` (Task 14); `sunVector` (Task 7); `loadStyleTextures(style, maxSize, withNight)` (Task 7); `mapState.layers.daylight`, `mapState.drawnMapStyle`.
- Produces: in Satellite with `layers.daylight` on and a Sun in the scene, the texture layer blends Blue Marble (day) and Black Marble (night) across the twilight band (Sun 0° to −6°); the SVG day/twilight/night shading is not drawn in Satellite (the Sun symbol still is); the lab legend shows "city lights" wording in Satellite.

- [ ] **Step 1: Failing e2e `tests/e2e/satellite-night.spec.ts`**

```ts
import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors, probe, setMapStyle, waitForTexture } from './helpers';

type S = { sun: unknown; rotate: [number, number]; realSun: boolean };
const setSun = (page: Page, utcMinutes: number, dayOfYear = 266) => page.evaluate(([m, d]) => { (window as unknown as { __mapState: S }).__mapState.sun = { utcMinutes: m, dayOfYear: d, year: 2026 }; }, [utcMinutes, dayOfYear]);

test('city lights over India at 17:00 UTC on 23 September, on the flat map and the globe', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'satellite');
  await setSun(page, 17 * 60);
  await waitForTexture(page, 'flat');
  // Black Marble at Delhi is (253,253,250); the Indian Ocean at night is (5,5,15). The night image loads after the
  // first (day) frame, so wait for the lights.
  await expect.poll(async () => (await probe(page, 'flat', 28.61, 77.21, 3))?.maxSum ?? 0, { timeout: 15_000 }).toBeGreaterThan(450);
  expect((await probe(page, 'flat', -10, 80, 3))!.maxSum).toBeLessThan(150);
  await page.evaluate(() => { (window as unknown as { __mapState: S }).__mapState.rotate = [-78, -22]; });
  await page.waitForTimeout(250);
  expect((await probe(page, 'globe', 28.61, 77.21, 3))!.maxSum).toBeGreaterThan(450);
  // The SVG night shading is Satellite's own job now; the Sun symbol stays.
  await expect(page.locator('.view-flat .daylight path.night')).toHaveCount(0);
  await expect(page.locator('.view-flat .daylight g.sun')).toHaveCount(1);
  await expectNoAxeViolations(page, 'satellite night');
  expect(pageErrors(page)).toEqual([]);
});

test('the Sahara is lit at noon UTC and dark at midnight; twilight fades between', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'satellite');
  await setSun(page, 720);
  await waitForTexture(page, 'flat');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __mapTextures: { health(): { ready: { satellite: boolean } } } }).__mapTextures.health().ready.satellite)).toBe(true);
  await page.waitForTimeout(500);
  const noon = (await probe(page, 'flat', 23, 12))!;
  expect(noon.avg[0]).toBeGreaterThan(150);
  await setSun(page, 0);
  await page.waitForTimeout(250);
  const night = (await probe(page, 'flat', 23, 12))!;
  expect(night.avg[0] + night.avg[1] + night.avg[2]).toBeLessThan(200);
  // The Sahara (23°N, 12°E) around sunset at the March equinox: 17:00 UTC the Sun is 2.8° up, 17:24 it is 2.8° down
  // (twilight), 18:00 it is 12° down. Brightness falls in that order.
  const lum = async (minutes: number) => {
    await setSun(page, minutes, 80);
    await page.waitForTimeout(250);
    const p = (await probe(page, 'flat', 23, 12, 2))!;
    return p.avg[0] + p.avg[1] + p.avg[2];
  };
  const day = await lum(17 * 60), twilight = await lum(17 * 60 + 24), dark = await lum(18 * 60);
  expect(day).toBeGreaterThan(twilight + 40);
  expect(twilight).toBeGreaterThan(dark + 40);
});

test('with daylight off (a topic scene without a Sun) Satellite shows the day image everywhere', async ({ page }) => {
  await openPage(page, 'en/topic-1/explore/9', '?test');
  await setMapStyle(page, 'satellite');
  await waitForTexture(page, 'flat');
  const pacificNight = (await probe(page, 'flat', 0, -140))!;
  expect(pacificNight.avg[2]).toBeGreaterThan(pacificNight.avg[0]);
});
```
The Sahara is bright by day (≈ 470 summed) and dim at night (≈ 130), so the three sunset samples separate by far more than the 40 margin (twilight ≈ 330 by the shader's formula).

Run: `npm run build && npx playwright test tests/e2e/satellite-night.spec.ts` — Expected: FAIL (no night blend yet).

- [ ] **Step 2: Night in the texture layer**

`src/map/texture/TextureLayer.svelte`:
```ts
  import { sunVector } from './renderer';
  // Spec §4: city lights on the night side wherever `daylight` is on.
  const nightSun = $derived.by(() => {
    if (style !== 'satellite' || !mapState.layers.daylight) return null;
    const p = mapState.sunPoint();
    return p ? sunVector(p) : null;
  });
  const withNight = $derived(nightSun !== null);
```
- Effect 2 (textures): `loadStyleTextures(s, max, withNight)`, and track loaded night: keep `let loadedNight = $state(false)` set to `t.night !== null` on success; the effect re-runs when `withNight` changes (it reads it). Cleanup unchanged.
- Effect 3 (draw): `night: nightSun && loadedNight ? nightSun : null` in `base`.
- `DrawInputs` otherwise unchanged; both renderers already handle `night`.

- [ ] **Step 3: Daylight and the legend in Satellite**

`src/map/layers/Daylight.svelte`: `const shading = $derived(mapState.drawnMapStyle !== 'satellite');` and wrap the four `<path>`s (`day`, two `twilight`, `night`) in `{#if shading}…{/if}`; the Sun group stays.

`src/map/LabControls.svelte`: in the legend, when `mapState.drawnMapStyle === 'satellite'` show a single swatch instead of the three: `<span class="swatch lights"><i aria-hidden="true"></i>{t('lab.cityLights')}</span>` with CSS `.swatch.lights i { background: radial-gradient(circle at 30% 60%, #ffd98a 0 2px, transparent 3px), radial-gradient(circle at 70% 40%, #ffe7b0 0 1.5px, transparent 2.5px), #0b1020; }`. Messages:

| key | en | pl | uk |
|---|---|---|---|
| `lab.cityLights` | Night side: city lights | Strona nocna: światła miast | Нічний бік: вогні міст |

- [ ] **Step 4: Run, look, commit**

```bash
npm run check && npm test
npm run build && npx playwright test tests/e2e/satellite-night.spec.ts tests/e2e/texture-webgl.spec.ts tests/e2e/texture-fallback.spec.ts tests/e2e/lab.spec.ts tests/e2e/atlas-baseline.spec.ts
```
Expected: PASS. Also run the first test with `?test&gl=off` by hand (change the `openPage` query in a scratch copy, do not commit) to see the canvas path draws the same night. Look at the lab in Satellite with "Spin the Earth": lights travel with the night, the twilight band is soft, the globe has a thin blue glow.
```bash
git add src/map/texture/TextureLayer.svelte src/map/layers/Daylight.svelte src/map/LabControls.svelte src/i18n tests/e2e/satellite-night.spec.ts
git commit -m "feat(map): Satellite night side with Black Marble city lights across a twilight band"
```

---

### Task 16: Real-Sun switch in the lab

**Files:**
- Modify: `src/map/types.ts` (`LabControl` gains `'real-sun'`), `src/map/LabControls.svelte`, `src/app/LabPage.svelte`, `src/i18n/en.json`, `src/i18n/pl.json`, `src/i18n/uk.json`
- Test: `tests/e2e/real-sun.spec.ts`

**Interfaces:**
- Consumes: `mapState.realSun` (Task 14), the clocks and noon line already follow it.
- Produces: `LabControl = 'sun-time' | 'sun-date' | 'clocks' | 'now' | 'real-sun'`; the lab scene lists `'real-sun'`; i18n `lab.realSun`, `lab.realSunNote`.

- [ ] **Step 1: Messages** (the EN note is the spec's text, verbatim)

| key | en | pl | uk |
|---|---|---|---|
| `lab.realSun` | Advanced: real Sun | Dla zaawansowanych: prawdziwe Słońce | Для допитливих: справжнє Сонце |
| `lab.realSunNote` | The real Sun can be up to 16 minutes ahead of or behind clock time during the year, so noon moves up to 4° from the 12:00 meridian. Lessons use the average Sun. | Prawdziwe Słońce w ciągu roku może wyprzedzać wskazania zegara albo się za nimi spóźniać nawet o 16 minut, więc południe przesuwa się nawet o 4° od południka 12:00. Na lekcjach używamy średniego Słońca. | Протягом року справжнє Сонце може випереджати годинник або відставати від нього до 16 хвилин, тому полудень зсувається до 4° від меридіана 12:00. На уроках ми використовуємо середнє Сонце. |

The numbers 16 and 4° are checked by `tests/unit/sun-real.test.ts` (Task 14: `floor(max |EoT|) = 16`, `floor(max |EoT| / 4) = 4`); add to that test file:
```ts
import en from '../../src/i18n/en.json';
import pl from '../../src/i18n/pl.json';
import uk from '../../src/i18n/uk.json';
test('the real-Sun note states the verified numbers in every language', () => {
  for (const f of [en, pl, uk] as Record<string, string>[]) { expect(f['lab.realSunNote']).toMatch(/\b16\b/); expect(f['lab.realSunNote']).toContain('4°'); expect(f['lab.realSunNote']).toContain('12:00'); }
});
```

- [ ] **Step 2: The switch**

`src/map/types.ts`: `export type LabControl = 'sun-time' | 'sun-date' | 'clocks' | 'now' | 'real-sun';`

`src/app/LabPage.svelte`: the scene's `labControls` becomes `['sun-time', 'sun-date', 'now', 'clocks', 'real-sun']`.

`src/map/LabControls.svelte`, inside `.controls` after the spin speed block (and inside the `{#if mapState.layers.daylight || has('sun-time') …}` condition add `|| has('real-sun')`):
```svelte
      {#if has('real-sun')}
        <div class="real-sun">
          <button type="button" class="btn" aria-pressed={mapState.realSun} aria-describedby="real-sun-note" onclick={() => (mapState.realSun = !mapState.realSun)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21" /><path d="M16.5 5.5l2 2" /></svg>
            {t('lab.realSun')}
          </button>
          <p id="real-sun-note" class="real-sun-note">{t('lab.realSunNote')}</p>
        </div>
      {/if}
```
CSS: `.real-sun { display: grid; gap: var(--space-1); padding-top: var(--space-2); border-top: 1px dashed var(--border); } .real-sun .btn { justify-self: start; } .real-sun svg { width: 1.25rem; height: 1.25rem; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; } .real-sun-note { margin: 0; font-size: var(--step--1); color: var(--text-muted); max-width: 40ch; }`.

- [ ] **Step 3: E2E `tests/e2e/real-sun.spec.ts`**

```ts
import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

const noonX = (page: Page) => page.locator('.view-flat path.noon').getAttribute('d').then((d) => Number(/M\s*([-\d.]+)/.exec(d!)![1]));

test('the real Sun moves noon and the clocks by the equation of time; off again after leaving the lab', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  // 3 November 12:00 UTC: the real Sun is 16.4 minutes ahead, 4.1° west of the 12:00 meridian.
  await page.evaluate(() => { (window as unknown as { __mapState: { sun: unknown } }).__mapState.sun = { utcMinutes: 720, dayOfYear: 307, year: 2026 }; });
  const london = page.getByRole('row', { name: /London/ });
  await expect(london).toContainText('12:00');
  const meanX = await noonX(page);
  const toggle = page.getByRole('button', { name: 'Advanced: real Sun' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle).toHaveAccessibleDescription(/up to 16 minutes/);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(london).toContainText('12:16');
  await expect.poll(async () => meanX - (await noonX(page))).toBeGreaterThan(9);  // ≈ 4.1° × 960/360 ≈ 11 units west
  expect(meanX - (await noonX(page))).toBeLessThan(13);
  await expectNoAxeViolations(page, 'lab real sun');

  await page.goto(page.url().replace(/#.*/, '#en/topic-8/explore/9'));
  await expect(page.getByRole('button', { name: 'Advanced: real Sun' })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __mapState: { realSun: boolean } }).__mapState.realSun)).toBe(false);
  await page.goto(page.url().replace(/#.*/, '#en/lab'));
  await expect(page.getByRole('button', { name: 'Advanced: real Sun' })).toHaveAttribute('aria-pressed', 'false');
  expect(pageErrors(page)).toEqual([]);
});

test('the switch is not saved', async ({ page }) => {
  await openPage(page, 'pl/lab');
  await page.getByRole('button', { name: 'Dla zaawansowanych: prawdziwe Słońce' }).click();
  await page.reload();
  await page.waitForSelector('#main');
  await expect(page.getByRole('button', { name: 'Dla zaawansowanych: prawdziwe Słońce' })).toHaveAttribute('aria-pressed', 'false');
});
```
The lab's flat map at world zoom is the grid map (`960/360` units per degree); `path.noon`'s `d` starts at the line's first point.

- [ ] **Step 4: Run, look, commit**

```bash
npx vitest run tests/unit/sun-real.test.ts
npm run check && npm test
npm run build && npm run e2e
```
Expected: PASS (all existing lab tests unchanged: the clock order and texts are the same with the switch off). Look at the lab panel at 1280 px (side panel) and 375 px: the switch and its note fit without crowding the Sun controls.
```bash
git add src/map/types.ts src/map/LabControls.svelte src/app/LabPage.svelte src/i18n tests/unit/sun-real.test.ts tests/e2e/real-sun.spec.ts
git commit -m "feat(lab): advanced real-Sun switch with the equation of time note"
```
