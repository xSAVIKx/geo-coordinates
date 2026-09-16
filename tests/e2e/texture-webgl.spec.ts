import { expect, test } from '@playwright/test';
import { makeFlatCtx, makeGlobeCtx, type ViewCtx } from '../../src/map/geometry';
import { inverseProject } from '../../src/map/texture/inverse';
import { textureView } from '../../src/map/texture/viewParams';
import { expectNoAxeViolations, openPage, pageErrors, probe, setMapStyle, textureHooks, waitForTexture } from './helpers';

type S = { flat: { center: { lat: number; lon: number }; zoom: number }; flatProjection: 'grid' | 'equal-earth' | 'mercator'; rotate: [number, number]; globeZoom: number; setFlatView(c: { lat: number; lon: number }, z: number): void; chooseProjection(p: string): void };
/**
 * Whether inverse.ts puts this view point on the map, the way the shader's own `ok` decides it: a point whose
 * longitude ran past ±180 is not. The shader clips there (outside Equal Earth's oval, and beside Mercator's world
 * when the view is wider than it, stay empty); inverse.ts, like d3's own invert, wraps such a longitude round the
 * antimeridian and still returns a point, which forward-projects a whole world away from where it came from.
 * The difference is deliberate — a second, repeated world beside the oval would be wrong — and asserting it here
 * at every sample point is what stops the GLSL and the TypeScript drifting apart: Task 8's canvas tier has to clip
 * the same way. Only points inside [0, width] × [0, height] are passed in; inverse.ts does not check that itself.
 */
const onMap = (ctx: ViewCtx, x: number, y: number): boolean => {
  const ll = inverseProject(textureView(ctx), x, y);
  if (!ll) return false;
  const back = ctx.projection([(ll.lambda * 180) / Math.PI, (ll.phi * 180) / Math.PI]);
  return !!back && Math.abs(back[0] - x) < 0.5 && Math.abs(back[1] - y) < 0.5;
};

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
      const points = pts(960, 480);
      const got = await hooks.debugCoords('flat', points);
      expect(got.map((g) => g !== null), `${projection} ${zoom}: where the shader draws`).toEqual(points.map(([x, y]) => onMap(ctx, x, y)));
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
    const globePoints = pts(500, 500);
    const got = await hooks.debugCoords('globe', globePoints);
    expect(got.map((g) => g !== null), `globe ${rotate}: where the shader draws`).toEqual(globePoints.map(([x, y]) => onMap(ctx, x, y)));
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

test('a render failure after the images are ready falls all the way back to Atlas', async ({ page }) => {
  await openPage(page, 'en/lab', '?test&gl=render-fail');
  await setMapStyle(page, 'physical');
  await expect.poll(() => textureHooks(page).health()).toMatchObject({ tier: 'canvas', ready: { physical: false } });
  await expect(page.locator('.view-flat .frame')).toHaveAttribute('data-map-style', 'atlas');
  await expect(page.locator('.view-flat path.land')).toHaveCount(1);
  await expect(page.locator('.view-globe path.land')).toHaveCount(1);
});

test('Atlas draws no canvas at all', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await expect(page.locator('canvas.texture')).toHaveCount(0);
  await expect(page.locator('.view-flat .frame')).toHaveAttribute('data-map-style', 'atlas');
});
