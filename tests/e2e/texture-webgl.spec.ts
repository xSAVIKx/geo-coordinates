import { expect, test } from '@playwright/test';
import { makeFlatCtx, makeGlobeCtx } from '../../src/map/geometry';
import { expectNoAxeViolations, openPage, pageErrors, probe, setMapStyle, textureHooks, waitForTexture } from './helpers';

type S = { flat: { center: { lat: number; lon: number }; zoom: number }; flatProjection: 'grid' | 'equal-earth' | 'mercator'; rotate: [number, number]; globeZoom: number; setFlatView(c: { lat: number; lon: number }, z: number): void; chooseProjection(p: string): void };
const state = (page: import('@playwright/test').Page) => page.evaluate(() => { const s = (window as unknown as { __mapState: S }).__mapState; return { flat: s.flat, projection: s.flatProjection, rotate: s.rotate, globeZoom: s.globeZoom }; });

test('the shader\'s inverse projections match d3 to 0.01° on every projection and the globe', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'physical');
  await waitForTexture(page, 'flat');
  await waitForTexture(page, 'globe');
  const hooks = textureHooks(page);
  const pts = (w: number, h: number): [number, number][] => Array.from({ length: 9 * 5 }, (_, k) => [((k % 9) + 0.37) * (w / 9), (Math.floor(k / 9) + 0.61) * (h / 5)]);
  for (const projection of ['grid', 'equal-earth', 'mercator'] as const) {
    for (const [center, zoom] of [[{ lat: 0, lon: 0 }, 1], [{ lat: 50.26, lon: 19.02 }, 9], [{ lat: 60, lon: 170 }, 2.5]] as const) {
      await page.evaluate(([p, c, z]) => { const s = (window as unknown as { __mapState: S }).__mapState; s.chooseProjection(p as string); s.setFlatView(c as { lat: number; lon: number }, z as number); }, [projection, center, zoom] as const);
      await page.waitForTimeout(150);
      const st = await state(page);
      const ctx = makeFlatCtx(960, 480, st.flat.center, st.flat.zoom, 1, st.projection);
      const got = await hooks.debugCoords('flat', pts(960, 480));
      let compared = 0;
      for (const g of got) {
        const d3 = g && ctx.invert([g.x, g.y]);
        if (!g || !d3) continue;
        compared++;
        expect(Math.abs(g.lat - d3.lat), `${projection} lat at ${g.x},${g.y}`).toBeLessThanOrEqual(0.01);
        expect(Math.abs(((g.lon - d3.lon + 540) % 360) - 180), `${projection} lon at ${g.x},${g.y}`).toBeLessThanOrEqual(0.01);
      }
      expect(compared, `${projection} ${zoom}`).toBeGreaterThan(20);
    }
  }
  for (const [rotate, zoom] of [[[-19, -50], 1], [[170, 30], 3], [[0, -90], 1]] as const) {
    await page.evaluate(([r, z]) => { const s = (window as unknown as { __mapState: S }).__mapState; s.rotate = r as [number, number]; s.globeZoom = z as number; }, [rotate, zoom] as const);
    await page.waitForTimeout(150);
    const st = await state(page);
    const ctx = makeGlobeCtx(500, st.rotate, 1, st.globeZoom);
    const got = await hooks.debugCoords('globe', pts(500, 500));
    for (const g of got) {
      const d3 = g && ctx.invert([g.x, g.y]);
      if (!g || !d3 || Math.abs(d3.lat) > 89.9) continue;
      expect(Math.abs(g.lat - d3.lat)).toBeLessThanOrEqual(0.01);
      expect(Math.abs(((g.lon - d3.lon + 540) % 360) - 180) * Math.cos((d3.lat * Math.PI) / 180)).toBeLessThanOrEqual(0.01);
    }
  }
  expect(pageErrors(page)).toEqual([]);
});

test('Physical: colour probes on the flat map and the globe; Atlas land is hidden under it', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'physical');
  await waitForTexture(page, 'flat');
  await waitForTexture(page, 'globe');
  await expect(page.locator('.view-flat .frame')).toHaveAttribute('data-map-style', 'physical');
  await expect(page.locator('.view-flat path.land')).toHaveCount(0);
  await expect(page.locator('.view-flat path.borders').first()).toBeAttached();
  // HYP_50M_SR_W samples measured while planning: Sahara (201,192,173), Baltic (207,225,242).
  const sahara = (await probe(page, 'flat', 23, 12))!;
  expect(sahara.avg[0]).toBeGreaterThan(sahara.avg[2] + 15);
  const baltic = (await probe(page, 'flat', 56.5, 19))!;
  expect(baltic.avg[2]).toBeGreaterThan(baltic.avg[0] + 15);
  await page.evaluate(() => { (window as unknown as { __mapState: S }).__mapState.rotate = [-12, -23]; });
  await page.waitForTimeout(200);
  const globeSahara = (await probe(page, 'globe', 23, 12))!;
  expect(globeSahara.avg[0]).toBeGreaterThan(globeSahara.avg[2] + 15);
  // Deep zoom over the Tatras: the detail tile shows relief (tan) where the Kraków lowland is green.
  await page.evaluate(() => (window as unknown as { __mapState: S }).__mapState.setFlatView({ lat: 49.6, lon: 20 }, 12));
  await page.waitForTimeout(250);
  const tatra = (await probe(page, 'flat', 49.2, 20.0))!;
  const lowland = (await probe(page, 'flat', 50.06, 19.94))!;
  expect(tatra.avg[0]).toBeGreaterThanOrEqual(tatra.avg[1] - 5);
  expect(lowland.avg[1]).toBeGreaterThan(lowland.avg[0] + 10);
  await expectNoAxeViolations(page, 'lab physical');
  expect(pageErrors(page)).toEqual([]);
});

test('Satellite (day): Blue Marble colours; Mercator and Equal Earth leave the outside of the world empty', async ({ page }) => {
  await openPage(page, 'en/topic-9/explore/3', '?test');
  await setMapStyle(page, 'satellite');
  await waitForTexture(page, 'flat');
  const sahara = (await probe(page, 'flat', 23, 12))!;       // (199,160,111)
  expect(sahara.avg[0]).toBeGreaterThan(sahara.avg[2] + 50);
  const baltic = (await probe(page, 'flat', 56.5, 19))!;     // (27,69,127)
  expect(baltic.avg[2]).toBeGreaterThan(baltic.avg[0] + 50);
  expect(await probe(page, 'flat', 86, 0)).toBeNull();        // beyond Mercator's 85°
  expect(pageErrors(page)).toEqual([]);
});

test('a device that allows only 2048 px textures still draws with WebGL, from smaller images', async ({ page }) => {
  await openPage(page, 'en/lab', '?test&gl=small-textures');
  await setMapStyle(page, 'physical');
  await waitForTexture(page, 'flat');
  expect(await textureHooks(page).health()).toMatchObject({ tier: 'webgl', maxTexture: 2048 });
  expect((await probe(page, 'flat', 23, 12))!.avg[0]).toBeGreaterThan(100);
});

test('Atlas draws no canvas at all', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await expect(page.locator('canvas.texture')).toHaveCount(0);
  await expect(page.locator('.view-flat .frame')).toHaveAttribute('data-map-style', 'atlas');
});
