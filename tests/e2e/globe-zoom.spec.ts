import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors, setFlatView, setMapStyle, waitForTexture } from './helpers';

test('zoom in/out buttons change globeZoom and clamp at the minimum', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const zoomIn = page.getByRole('button', { name: 'Zoom in on the globe' });
  const zoomOut = page.getByRole('button', { name: 'Zoom out on the globe' });
  await zoomIn.click();
  await zoomIn.click();
  await zoomIn.click();
  const zoomAfterIn = await page.evaluate(() => (window as any).__mapState.globeZoom);
  expect(zoomAfterIn).toBeCloseTo(3.375, 6);

  for (let i = 0; i < 10; i++) await zoomOut.click();
  const zoomAfterOut = await page.evaluate(() => (window as any).__mapState.globeZoom);
  expect(zoomAfterOut).toBeCloseTo(1, 6);
  expect(zoomAfterOut).toBeGreaterThanOrEqual(1);
});

test('keyboard + zooms and 0 resets', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const globe = page.getByRole('group', { name: 'Globe that you can turn' });
  await globe.focus();
  await page.keyboard.press('+');
  const zoomed = await page.evaluate(() => (window as any).__mapState.globeZoom);
  expect(zoomed).toBeCloseTo(1.5, 6);
  await page.keyboard.press('0');
  const reset = await page.evaluate(() => (window as any).__mapState.globeZoom);
  expect(reset).toBe(1);
});

test('Ctrl+wheel over the globe zooms while plain wheel does not', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const globe = page.getByRole('group', { name: 'Globe that you can turn' });
  const box = (await globe.boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -100);
  const plain = await page.evaluate(() => (window as any).__mapState.globeZoom);
  expect(plain).toBe(1);

  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  const ctrlZoomed = await page.evaluate(() => (window as any).__mapState.globeZoom);
  expect(ctrlZoomed).toBeGreaterThan(1);
});

test('axe is clean after zooming the globe, and the flat map keeps its own distinct zoom buttons', async ({ page }) => {
  await openPage(page, 'en/lab');
  await page.getByRole('button', { name: 'Zoom in on the globe' }).click();
  await page.getByRole('button', { name: 'Zoom in on the globe' }).click();
  await expectNoAxeViolations(page, 'globe zoomed');

  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom in on the globe' })).toBeVisible();
});

/*
 * The globe never shows a close-up, at any zoom (planning ruling R1: "A pupil who stays on the globe never sees
 * a close-up"). This is the two-view test the Task 5 deferral asked for, and the thing it proves is the fix to
 * the whole-branch review's Important 3.
 *
 * `cityBoxes.ts`'s thresholds — 24 for the streets, 40 for the photo — are on the flat map's 1–6000 scale. The
 * globe runs 1–60 on its own, and `ctx.zoom` reports a globe view's *flat equivalent*, which at globeZoom 60
 * clears both. So the three derivations that ask `visibleCityBox` used to say yes for the globe as well: the
 * globe centred on Katowice at its ceiling decoded the box's photo (5 529 600 B of RGBA), blended it over a
 * patch about ten pixels across, and drew the box's whole street map on top of it. That also broke ruling R13's
 * premise that only one photo is ever wanted at a time — here both views wanted one, and the refcounted
 * keep-set was the only thing standing between that and a closed bitmap being uploaded.
 *
 * All three now gate on `ctx.kind === 'flat'` first. The flat half of this test is what stops the gate being
 * "never draw a close-up at all", which would pass every assertion about the globe.
 */
test('the globe at its deepest zoom over Katowice shows no close-up, while the flat map beside it does', async ({ page }) => {
  test.setTimeout(90_000);
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'physical');
  await waitForTexture(page, 'globe');
  // The globe at its ceiling, centred on the school box. GLOBE_MAX_ZOOM is 60; asking for more is clamped to it.
  await page.evaluate(() => {
    const s = (window as unknown as { __mapState: { setGlobeZoom(z: number): void; centerGlobeOn(p: { lat: number; lon: number }): void } }).__mapState;
    s.centerGlobeOn({ lat: 50.26, lon: 19.02 });
    s.setGlobeZoom(60);
  });
  expect(await page.evaluate(() => (window as unknown as { __mapState: { globeZoom: number } }).__mapState.globeZoom)).toBe(60);
  // The flat map is somewhere else entirely, so nothing at all should have been decoded for a box yet.
  await setFlatView(page, 0, 0, 1);
  await waitForTexture(page, 'globe', 2);
  await expect(page.locator('.view-globe g.streets')).toHaveCount(0);
  await expect(page.locator('.view-globe text.street-name')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __mapTextures: { cityBytes(): number } }).__mapTextures.cityBytes()),
    'no city photo is decoded for the globe at any zoom').toBe(0);

  // …and the flat map, at the same place, does everything the globe just refused to.
  await setFlatView(page, 50.26, 19.02, 4270);
  await expect(page.locator('.view-flat g.streets[data-city-box="katowice"]')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __mapTextures: { cityBytes(): number } }).__mapTextures.cityBytes()),
    { timeout: 15_000 }).toBeGreaterThan(0);
  // One photo held, not two: 1440 x 960 x 4 is the whole of Katowice's, and the globe is still at zoom 60 on it.
  expect(await page.evaluate(() => (window as unknown as { __mapTextures: { cityBytes(): number } }).__mapTextures.cityBytes())).toBe(1440 * 960 * 4);
  // The globe is still deep over Katowice and still shows nothing of the box.
  expect(await page.evaluate(() => (window as unknown as { __mapState: { globeZoom: number } }).__mapState.globeZoom)).toBe(60);
  await expect(page.locator('.view-globe g.streets')).toHaveCount(0);
  expect(pageErrors(page)).toEqual([]);
});
