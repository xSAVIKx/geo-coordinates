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

/*
 * The Canvas 2D tier shades every pixel with src/map/texture/cpuShade.ts, the fragment shader's `main` written out in
 * TypeScript. The two must draw the same night: this repeats the first test's samples with WebGL switched off, and
 * also checks that the grid ink stays readable (WCAG 1.4.11, 3:1 for a graphical object) over the dark night side.
 */
test('the canvas tier draws the same night, and the grid stays readable over it', async ({ page }) => {
  await openPage(page, 'en/lab', '?test&gl=off');
  await setMapStyle(page, 'satellite');
  await setSun(page, 17 * 60);
  await waitForTexture(page, 'flat');
  await expect.poll(async () => (await probe(page, 'flat', 28.61, 77.21, 3))?.maxSum ?? 0, { timeout: 15_000 }).toBeGreaterThan(450);
  const ocean = (await probe(page, 'flat', -10, 80, 3))!;
  expect(ocean.maxSum).toBeLessThan(150);
  const gridInk = await page.locator('.view-flat .frame').evaluate((f) => getComputedStyle(f).getPropertyValue('--grid').trim());
  const lum = ([r, g, b]: number[]) => { const f = (x: number) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!); };
  const ink = [1, 3, 5].map((i) => parseInt(gridInk.slice(i, i + 2), 16));
  const [hi, lo] = [lum(ink), lum(ocean.avg)].sort((a, b) => b - a);
  expect((hi! + 0.05) / (lo! + 0.05)).toBeGreaterThanOrEqual(3);
  expect(pageErrors(page)).toEqual([]);
});
