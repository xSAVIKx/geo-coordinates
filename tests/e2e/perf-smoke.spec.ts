import { expect, test, type Page } from '@playwright/test';
import { openPage, setMapStyle, waitForTexture } from './helpers';

// Spec §8 "Performance smoke". SwiftShader in headless Chromium is far slower than a phone GPU, so the bounds are
// generous (planning ruling R23); the numbers are printed for the report and the phone check is manual.
const draws = (page: Page, view: 'flat' | 'globe') => page.evaluate((v) => (window as unknown as { __mapTextures: { drawCount(v: string): number } }).__mapTextures.drawCount(v), view);
/** Image decodes and renderer uploads so far in this page session (src/map/texture/testHooks.ts). */
const counts = (page: Page) => page.evaluate(() => (window as unknown as { __mapTextures: { counts(): { decodes: number; uploads: number } } }).__mapTextures.counts());
const rotation = (page: Page) => page.evaluate(() => JSON.stringify((window as unknown as { __mapState: { rotate: [number, number] } }).__mapState.rotate));

/**
 * Drags across the globe and reports the frame intervals while it turns.
 *
 * The press must not start in the middle of the globe: the lab's own point sits at the centre of the projection, its
 * handle is a drag target of its own, and a press that lands on it moves the point instead of turning the Earth — the
 * frame times would then be a point drag's, with the country paths never re-projected at all. Starting the press at
 * 28 % of the box, and asserting afterwards that the rotation really changed, keeps this measuring what it claims to.
 */
async function dragGlobe(page: Page, rate: number): Promise<{ median: number; p90: number }> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  // `.view-globe svg` also matches every toolbar icon, so address the globe drawing itself: the only <svg> that is a
  // direct child of the globe's .frame.
  const box = (await page.locator('.view-globe .frame > svg').boundingBox())!;
  const x = box.x + box.width * 0.28, y = box.y + box.height * 0.28;
  const before = await rotation(page);
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[] };
    w.__frames = [];
    let last = performance.now();
    const tick = (now: number) => { w.__frames.push(now - last); last = now; if (w.__frames.length < 240) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 0; i < 80; i++) await page.mouse.move(x + ((i % 40) - 20) * 3, y + ((i % 16) - 8) * 2);
  await page.mouse.up();
  expect(await rotation(page), 'the drag has to turn the globe, not move the point').not.toBe(before);
  const frames = (await page.evaluate(() => (window as unknown as { __frames: number[] }).__frames.slice(5))).sort((a, b) => a - b);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  return { median: frames[Math.floor(frames.length / 2)]!, p90: frames[Math.floor(frames.length * 0.9)]! };
}

test('Satellite: first draw after choosing it, globe drag frame times under CPU ×4, a later style switch', async ({ page }) => {
  test.setTimeout(120_000);
  await openPage(page, 'en/lab', '?test');
  let t = Date.now();
  await setMapStyle(page, 'satellite');
  await waitForTexture(page, 'globe');
  const firstDraw = Date.now() - t;
  // The counters below are only worth asserting on if they move at all: the first choice of Satellite really does
  // decode its three images (day, night, region) and upload them to at least the globe.
  const firstCounts = await counts(page);
  expect(firstCounts.decodes, 'the decode counter is live').toBeGreaterThanOrEqual(3);
  expect(firstCounts.uploads, 'the upload counter is live').toBeGreaterThanOrEqual(1);

  const { median, p90 } = await dragGlobe(page, 4);

  await setMapStyle(page, 'physical');
  await waitForTexture(page, 'flat');
  const before = await draws(page, 'flat');
  const countsBefore = await counts(page);
  t = Date.now();
  await setMapStyle(page, 'satellite');
  await expect.poll(() => draws(page, 'flat'), { intervals: [10] }).toBeGreaterThan(before);
  const switchBack = Date.now() - t;
  const countsAfter = await counts(page);

  console.log(JSON.stringify({ firstDrawMs: firstDraw, dragMedianMs: median, dragP90Ms: p90, switchBackMs: switchBack, decodesOnSwitchBack: countsAfter.decodes - countsBefore.decodes, uploadsOnSwitchBack: countsAfter.uploads - countsBefore.uploads }));
  /*
   * The three wall-clock bounds below are backstops against something catastrophic, not performance limits. What
   * this environment can be relied on for, measured across six runs of the whole suite and several solo ones:
   *
   *                    alone, idle   alone, box at load 15–20   whole suite, 6 workers   6 heaviest, 4 workers
   *   firstDrawMs       654–832            1686–2358                    1889                   2469
   *   dragMedianMs       16.7               50–66.7                     66.7                    100
   *   switchBackMs      409–448            944–1303                  1005–1798                1444
   *
   * SwiftShader rasterises and uploads on the CPU, so every number here moves with whatever else the machine is
   * doing — by 3× between an idle container and a loaded one. The brief's original 2500 / 120 / 400 were solo
   * numbers: a bound that fails for the weather teaches people to ignore the spec.
   *
   * Each of these two is set at about 1.5× the worst value in the table, and no higher. Only `switchBack` below
   * earned more room, because it actually overshot (1798 ms against 1500) *and* has the decode/upload counters
   * standing behind it; these two have no counter, so every millimetre of slack here is a regression that could
   * hide under it. If one of them ever fails on a loaded machine, raise that one and write the failing run into
   * this table — do not round up in advance. The real performance check is on the owner's hardware (see the
   * Task 20 report).
   */
  expect(firstDraw).toBeLessThan(3700);
  expect(median).toBeLessThan(150);
  /*
   * What a later style switch must cost, asserted as work done rather than as elapsed time.
   *
   * The expensive thing is decoding the three embedded WebPs; assets.ts caches the promises for the page session,
   * so coming back to a style already seen must decode *nothing*. That is the regression worth catching — one
   * image decoding again is about +300–400 ms here — and unlike a stopwatch it does not move with the machine.
   * The uploads are the real remaining cost: each view's WebGL context is handed the images again, so exactly one
   * per view, two in the lab. A third would mean the layer had started thrashing.
   */
  expect(countsAfter.decodes - countsBefore.decodes, 'a style already seen must not be decoded again').toBe(0);
  expect(countsAfter.uploads - countsBefore.uploads, 'one upload per view, no more').toBe(2);
  // The same backstop reasoning as above: an already-decoded style still re-uploads three images to two WebGL
  // contexts, which SwiftShader does on the CPU (about 225 ms for Physical's two images, 380–415 ms for
  // Satellite's three), and that cost triples on a loaded machine. The spec-level target, "≤ 100 ms after the
  // first decode", is a GPU number and stays a manual check on real hardware (see the report).
  expect(switchBack).toBeLessThan(4000);
});
