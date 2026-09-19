import { expect, test, type Page } from '@playwright/test';
import boxesJson from '../../src/map/data/city/boxes.json' with { type: 'json' };
import { openPage, pageErrors, probe, setFlatView, setMapStyle, textureHooks, waitForTexture } from './helpers';

/*
 * The third blend level (Places up close spec §5): the close-up photo over the world imagery inside one of the
 * twelve boxes. The shader, its CPU twin and the canvas tier are three copies of the same arithmetic, so the last
 * test here draws one scene on both tiers and compares the pixels.
 */
const boxOf = (id: string) => boxesJson.boxes.find((b) => b.id === id)!;
const fit = (b: { east: number; west: number; north: number; south: number }) => Math.min(360 / (b.east - b.west), 180 / (b.north - b.south));
const rgba = (b: { photoWidth: number; photoHeight: number }) => b.photoWidth * b.photoHeight * 4;

const katowice = boxOf('katowice');
const fitZoom = fit(katowice);

const cityBytes = (page: Page) => page.evaluate(() => (window as unknown as { __mapTextures: { cityBytes(): number } }).__mapTextures.cityBytes());

/**
 * Waits for the photo of `box` to be decoded and for the frame that follows it to be painted. The draw count
 * cannot be waited on here: the effect run that sets `cityLoaded` and the one the view change made are coalesced
 * into a single animation frame, so the count may or may not advance by one. `probe` redraws the *last* input, so
 * what matters is that the input carrying the photo has been queued and painted.
 */
async function waitForPhoto(page: Page, box: { photoWidth: number; photoHeight: number }): Promise<void> {
  await expect.poll(() => cityBytes(page), { timeout: 20_000 }).toBe(rgba(box));
  await page.waitForTimeout(300);
}

test('the close-up photo really sharpens inside the box and leaves everything outside it alone', async ({ page }) => {
  test.setTimeout(90_000);
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'satellite');
  await waitForTexture(page, 'flat');

  // Well outside every box, at a zoom where the world image is all there is.
  await setFlatView(page, 50.26, 10, 60);
  await waitForTexture(page, 'flat', 2);
  const away = await probe(page, 'flat', 50.26, 10, 3);
  expect(await cityBytes(page), 'no box in view, no photo decoded').toBe(0);

  // Inside the box, one octave apart: the same spot must look different once the photo is mixed in.
  await setFlatView(page, katowice.lat, katowice.lon, 30);
  await waitForTexture(page, 'flat', 3);
  const before = await probe(page, 'flat', katowice.lat, katowice.lon, 3);
  await setFlatView(page, katowice.lat, katowice.lon, fitZoom);
  await waitForPhoto(page, katowice);
  const after = await probe(page, 'flat', katowice.lat, katowice.lon, 3);

  expect(away).not.toBeNull();
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  const diff = (a: [number, number, number], b: [number, number, number]) =>
    Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  // Zoom 30 is below the photo's fade-in (40): the picture there is still the world image, only magnified.
  expect(diff(after!.avg, before!.avg), 'the photo did not change the picture').toBeGreaterThan(24);
  // A close-up photo has real structure; a magnified world image is flat.
  expect(after!.maxSum).toBeGreaterThan(before!.maxSum);
  expect(pageErrors(page)).toEqual([]);
});

test('no box, no photo: a deep zoom somewhere else shows only the world image', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'physical');
  await waitForTexture(page, 'flat');
  await setFlatView(page, 12.5, 40.5, 4000);       // open desert, 3 000 km from any box
  await waitForTexture(page, 'flat', 2);
  expect(await cityBytes(page)).toBe(0);
  expect(pageErrors(page)).toEqual([]);
});

/*
 * Planning ruling R13: one photo at a time. The three boxes below have three different photo sizes, so polling for
 * the exact byte count proves both halves — the new photo was decoded and the one before it was given back.
 */
test('only one photo is ever decoded at a time (planning ruling R13)', async ({ page }) => {
  test.setTimeout(90_000);
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'physical');
  await waitForTexture(page, 'flat');
  for (const id of ['katowice', 'warsaw', 'greenwich'] as const) {
    const b = boxOf(id);
    await setFlatView(page, b.lat, b.lon, fit(b));
    await expect.poll(() => cityBytes(page), { timeout: 20_000 }).toBe(rgba(b));
  }
  // Leaving every box gives the last one back too.
  await setFlatView(page, 12.5, 40.5, 4000);
  await expect.poll(() => cityBytes(page), { timeout: 20_000 }).toBe(0);
  expect(pageErrors(page)).toEqual([]);
});

/*
 * The controller's parity requirement: the WebGL shader, `shadePixel` and the canvas tier are three copies of the
 * same maths, and a city box exercises the newest of the three levels. The same scene is drawn on both tiers and
 * the pixels compared — the canvas tier samples 2048 px copies with bilinear filtering where the GPU uses mipmaps,
 * so the two are close rather than identical.
 */
test('the canvas tier draws the same close-up as the shader', async ({ page }) => {
  test.setTimeout(120_000);
  const shot = async (flags: string) => {
    await openPage(page, 'en/lab', `?test${flags}`);
    await setMapStyle(page, 'satellite');
    await waitForTexture(page, 'flat');
    await setFlatView(page, katowice.lat, katowice.lon, fitZoom);
    await waitForPhoto(page, katowice);
    const tier = await textureHooks(page).tier();
    const at = async (dLat: number, dLon: number) => (await probe(page, 'flat', katowice.lat + dLat, katowice.lon + dLon, 4))!.avg;
    return { tier, points: [await at(0, 0), await at(0.008, 0.02), await at(-0.008, -0.02), await at(0.0165, 0)] };
  };
  const gpu = await shot('');
  const cpu = await shot('&gl=off');
  expect(gpu.tier).toBe('webgl');
  expect(cpu.tier).toBe('canvas');
  // The four points really are a photo and not one flat colour, or agreement below would prove nothing: at this
  // zoom the Central Europe tile under the box is about one pixel across the whole view.
  const spread = (ps: [number, number, number][]) => Math.max(...ps.map((p) => p[0] + p[1] + p[2])) - Math.min(...ps.map((p) => p[0] + p[1] + p[2]));
  expect(spread(gpu.points), 'the shader drew real detail').toBeGreaterThan(30);
  expect(spread(cpu.points), 'the canvas tier drew real detail').toBeGreaterThan(30);
  for (let i = 0; i < gpu.points.length; i++) {
    for (let c = 0; c < 3; c++) {
      expect(Math.abs(gpu.points[i]![c]! - cpu.points[i]![c]!), `point ${i} channel ${c}: webgl ${gpu.points[i]} vs canvas ${cpu.points[i]}`).toBeLessThan(26);
    }
  }
  expect(pageErrors(page)).toEqual([]);
});

/*
 * Planning ruling R23: Black Marble is about 10 km a pixel, so inside a 6 x 4 km box the night image is one flat
 * smear. Over a box the night side shows a dimmed copy of the close-up instead — darker than the daylit photo, and
 * still carrying the photo's own structure rather than a single colour.
 */
test('at night a city box shows a dimmed close-up, not a smear', async ({ page }) => {
  test.setTimeout(90_000);
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'satellite');
  await waitForTexture(page, 'flat');
  await setFlatView(page, katowice.lat, katowice.lon, fitZoom);
  await waitForPhoto(page, katowice);
  const day = (await probe(page, 'flat', katowice.lat, katowice.lon, 6))!;

  // 00:00 UTC on 23 September: the Sun is over the Pacific and Katowice (19°E, 50°N) is deep in the night side.
  await page.evaluate(() => { (window as unknown as { __mapState: { sun: unknown } }).__mapState.sun = { utcMinutes: 0, dayOfYear: 266, year: 2026 }; });
  await page.waitForTimeout(400);
  const night = (await probe(page, 'flat', katowice.lat, katowice.lon, 6))!;

  const sum = (p: { avg: [number, number, number] }) => p.avg[0] + p.avg[1] + p.avg[2];
  expect(sum(night), 'night is darker than day').toBeLessThan(sum(day) * 0.6);
  expect(sum(night), 'but not the near-black of the unlit Black Marble').toBeGreaterThan(20);
  // The close-up's structure survives the dimming: a flat smear would have almost no spread between pixels.
  expect(night.maxSum).toBeGreaterThan(sum(night) * 1.05);
  expect(pageErrors(page)).toEqual([]);
});

/*
 * The owner's standing rule, and the global constraint for this feature: any failure in the texture path falls back
 * to Atlas, and nothing about it is remembered past the page session. A close-up is part of that path, so a photo
 * that cannot be decoded has to behave like any other texture failure. The block is removed from the page at
 * runtime, which is exactly what `loadCityPhoto` treats as a missing photo.
 */
test('a close-up that cannot be decoded falls back to Atlas, and a reload forgets it', async ({ page }) => {
  test.setTimeout(90_000);
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'physical');
  await waitForTexture(page, 'flat');
  await page.evaluate(() => document.getElementById('geo-photo-katowice')?.remove());
  await setFlatView(page, katowice.lat, katowice.lon, fitZoom);
  await expect.poll(() => textureHooks(page).tier(), { timeout: 20_000 }).toBe('atlas');
  await expect(page.getByRole('status').filter({ hasText: "This device can't draw this style; showing Atlas." })).toBeVisible();
  expect(await cityBytes(page), 'a photo that failed is not left in the cache').toBe(0);

  // Nothing is persisted: the next page session draws the close-up again. (A different query string, so the
  // browser really reloads the document instead of treating the same URL as a same-page navigation.)
  await openPage(page, 'en/lab', '?test&again=1');
  await setMapStyle(page, 'physical');
  await waitForTexture(page, 'flat');
  await setFlatView(page, katowice.lat, katowice.lon, fitZoom);
  await waitForPhoto(page, katowice);
  expect(await textureHooks(page).tier()).toBe('webgl');
  expect(pageErrors(page)).toEqual([]);
});
