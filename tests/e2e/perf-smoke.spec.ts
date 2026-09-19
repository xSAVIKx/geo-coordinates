import { expect, test, type Page } from '@playwright/test';
import { openPage, pageErrors, setFlatView, setMapStyle, waitForTexture } from './helpers';

// Spec §8 "Performance smoke". SwiftShader in headless Chromium is far slower than a phone GPU, so the bounds are
// generous (planning ruling R23); the numbers are printed for the report and the phone check is manual.
const draws = (page: Page, view: 'flat' | 'globe') => page.evaluate((v) => (window as unknown as { __mapTextures: { drawCount(v: string): number } }).__mapTextures.drawCount(v), view);
/** Image decodes and renderer uploads so far in this page session (src/map/texture/testHooks.ts). */
const counts = (page: Page) => page.evaluate(() => (window as unknown as { __mapTextures: { counts(): { decodes: number; uploads: number; bytes: number } } }).__mapTextures.counts());
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
  // Not `waitForTexture`: that counts *all* the frames a view has ever drawn, and the Satellite frames above
  // already satisfy it, so it returns before Physical has been handed to a renderer at all. The frame's
  // `data-map-style` is the drawn style, which only flips once a view has uploaded Physical's images — which is
  // also when the decode cache gives Satellite's back, the thing `countsBefore` is here to measure.
  await expect(page.locator('.view-flat .frame')).toHaveAttribute('data-map-style', 'physical');
  const before = await draws(page, 'flat');
  const countsBefore = await counts(page);
  t = Date.now();
  await setMapStyle(page, 'satellite');
  await expect.poll(() => draws(page, 'flat'), { intervals: [10] }).toBeGreaterThan(before);
  const switchBack = Date.now() - t;
  const countsAfter = await counts(page);

  console.log(JSON.stringify({ firstDrawMs: firstDraw, dragMedianMs: median, dragP90Ms: p90, switchBackMs: switchBack, decodesOnSwitchBack: countsAfter.decodes - countsBefore.decodes, uploadsOnSwitchBack: countsAfter.uploads - countsBefore.uploads, heldBytesOnPhysical: countsBefore.bytes, heldBytesOnSatellite: countsAfter.bytes }));
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
   * This bound used to read "a style already seen must not be decoded again" — the decode cache held every image
   * for the life of the page. It no longer does: the three world images are 4096 × 2048 of RGBA each, so holding
   * both styles cost about 107 MB, which on a 2 GB Chromebook is the likeliest way to reach the `oom` rung of the
   * fallback chain and lose the style altogether. assets.ts now gives the images back as soon as the *other*
   * style's renderer has its own copy (`releaseTexturesExcept`), and coming back re-decodes them. That trade is
   * deliberate, so it is asserted in both directions here: a decode really does happen, and it is exactly one per
   * image of the style being returned to — never more, which would mean the two views were each decoding their
   * own copy. `bytes` below is the other half: what is actually still held.
   */
  const satelliteImages = 3; // day, night, region (the lab's Sun is on, so the night image is loaded too)
  expect(countsAfter.decodes - countsBefore.decodes, 'coming back to a released style decodes its images once each').toBe(satelliteImages);
  expect(countsAfter.uploads - countsBefore.uploads, 'one upload per view, no more').toBe(2);
  /*
   * Only the style on screen is held. Physical's two images at 4096 × 2048 and 720 × 420 are 34.8 MB; Satellite's
   * three are 71.9 MB. Before the release both were held at once (106.7 MB), and a canvas-tier fallback would have
   * added a second, 2048 px set on top. The bound is the bigger of the two styles plus a little slack, which is
   * the point: whatever is chosen, one style's worth of pixels is the most the page ever holds.
   */
  const MB = 1024 * 1024;
  expect(countsBefore.bytes / MB, 'on Physical, only Physical is held').toBeLessThan(40);
  expect(countsAfter.bytes / MB, 'on Satellite, only Satellite is held').toBeLessThan(75);
  // The same backstop reasoning as above: a style switch re-decodes three images and re-uploads them to two WebGL
  // contexts, which SwiftShader does on the CPU (about 225 ms for Physical's two images, 380–415 ms for
  // Satellite's three, plus the decodes the release above deliberately bought back), and that cost triples on a
  // loaded machine. The spec-level target, "≤ 100 ms after the first decode", is a GPU number and stays a manual
  // check on real hardware (see the report).
  expect(switchBack).toBeLessThan(5000);
});

/*
 * Political on the globe. It is the one style drawn entirely in SVG, and one <path> per country — 210 of them —
 * is re-projected and re-serialised on every frame of a drag. Measured on the lab's globe at CPU ×4 before the
 * fix: 33.3 ms median and 283 ms at p90, against Atlas's 16.7 / 83–100. A 283 ms frame is a visible stall to a
 * child turning the Earth, and nothing in the suite was watching it.
 *
 * Two changes brought it to Atlas-and-Physical territory (see src/map/political.ts): the countries on the far
 * side of the Earth are culled by spherical cap before d3 sees them, and the globe picks its own detail level
 * from the pixels it is really drawn at rather than from the flat zoom its coverage corresponds to.
 *
 * The bound is a backstop, not a target, and it is expressed against Atlas measured in the same run — the whole
 * point is "no worse than the map this replaces", and a shared denominator survives a loaded machine far better
 * than a wall-clock number. Atlas's own p90 is 83–100 ms here and Physical's is 150.
 */
test('Political: globe drag frame times under CPU ×4, against Atlas in the same run', async ({ page }) => {
  test.setTimeout(120_000);
  await openPage(page, 'en/lab', '?test');
  const atlas = await dragGlobe(page, 4);
  await setMapStyle(page, 'political');
  await expect(page.locator('.view-globe .frame')).toHaveAttribute('data-map-style', 'political');
  await expect(page.locator('.view-globe path.country').first()).toBeAttached();
  const political = await dragGlobe(page, 4);
  console.log(JSON.stringify({ atlasMedianMs: atlas.median, atlasP90Ms: atlas.p90, politicalMedianMs: political.median, politicalP90Ms: political.p90 }));
  // The per-country hooks the political spec addresses (`path.country[data-country]`) are still there: the cull
  // removes the far side of the Earth, it does not merge the countries that are drawn.
  expect(await page.locator('.view-globe path.country').count(), 'countries are still drawn one path each').toBeGreaterThan(50);
  expect(political.median, 'the median frame is no worse than twice Atlas\'s').toBeLessThanOrEqual(Math.max(50, atlas.median * 2));
  expect(political.p90, 'and p90 no worse than twice Atlas\'s').toBeLessThanOrEqual(Math.max(200, atlas.p90 * 2));
  expect(pageErrors(page)).toEqual([]);
});

/**
 * Drags the flat map and reports the frame intervals while it moves, the same way `dragGlobe` does for the globe.
 *
 * The press starts away from the middle for the same reason: the point's handle sits at the centre of a lab
 * scene, and a press that lands on it moves the point instead of panning the map.
 */
async function dragFlat(page: Page, rate: number): Promise<{ median: number; p90: number }> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  const box = (await page.locator('.view-flat .frame > svg').boundingBox())!;
  const x = box.x + box.width * 0.28, y = box.y + box.height * 0.3;
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
  const frames = (await page.evaluate(() => (window as unknown as { __frames: number[] }).__frames.slice(5))).sort((a, b) => a - b);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  return { median: frames[Math.floor(frames.length / 2)]!, p90: frames[Math.floor(frames.length * 0.9)]! };
}

/*
 * Panning inside a city close-up box, against the same map showing the world, in the same run.
 *
 * The whole-branch review measured a box at 2.5–3× the world view and nothing in the suite was watching: the
 * world view drew a frame pair in 33.8 ms, Katowice at its fit zoom in 88.1 and Giza at zoom 5 600 in 101.1 —
 * about 20–27 fps while dragging, against a 2 GB Chromebook target. Two things paid for most of it, and both
 * are fixed: `placeStreetLabels` called `streetsFor` a second time each frame purely to read `.names` off it,
 * rebuilding every clipped array in the box to do so (`streetNamesFor` now reads the names alone); and a
 * parallel at deep zoom was 3 118 vertices of which two could be seen, seven times a frame (`parallelSpan`).
 *
 * Expressed against the world view measured in the same run, like the Political test above and for the same
 * reason: a shared denominator survives a loaded machine, a wall-clock millisecond does not. Giza is the box
 * that carries the most ink — 2 540 class-4 subpaths against the main network's 163.
 */
test('a city close-up box pans no worse than the world view does, in the same run', async ({ page }) => {
  test.setTimeout(180_000);
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'physical');
  await waitForTexture(page, 'flat');
  const world = await dragFlat(page, 4);

  // Katowice at the view the close-up list lands on: photo, street grid and street names all drawn.
  await setFlatView(page, 50.26, 19.02, 4270);
  await expect(page.locator('.view-flat g.streets[data-city-box="katowice"]')).toHaveCount(1);
  await expect(page.locator('.view-flat text.street-name').first()).toBeAttached();
  const katowice = await dragFlat(page, 4);

  // Giza deep enough to draw every class, which is the heaviest thing this feature ever asks a frame to do.
  // Its fit zoom is 5 009 and the alleys come in at 1.15 x that, so 5 900 is past every rung and under the
  // flat map's ceiling of 6 000.
  await setFlatView(page, 29.9792, 31.1342, 5900);
  await expect(page.locator('.view-flat g.streets[data-city-box="giza"] path.road.c5')).toHaveCount(1);
  const giza = await dragFlat(page, 4);

  console.log(JSON.stringify({ worldMedianMs: world.median, worldP90Ms: world.p90,
    katowiceMedianMs: katowice.median, katowiceP90Ms: katowice.p90, gizaMedianMs: giza.median, gizaP90Ms: giza.p90 }));
  /*
   * Backstops, not targets, set the way the rest of this file sets them: about 1.5× the worst value measured,
   * and no higher. What this environment gives (median ms a frame, CPU ×4):
   *
   *                        before the fix   alone, idle   alone x3   with three other heavy spec files
   *   world                     16.9            16.7      16.7         16.7
   *   Katowice, fit zoom        44.1            16.7      16.7–33.2    49.9
   *   Giza, every class         50.6            50.0      50.0        100.0
   *
   * ("Before the fix" is the whole-branch review's own figure, halved: it reported milliseconds per two frames.
   * Its Giza reading was at zoom 5 600, where the alleys had only just arrived; this one is at 5 900, past every
   * rung, so the two are not quite the same picture — Giza's honest comparison is that it did not get worse
   * while gaining a class.)
   *
   * Everything here quantises to whole animation frames — 16.7, 33.3, 50, 66.7 — so a bound between two of them
   * is a coin toss. If one of these ever fails on a loaded machine, re-run this test alone before touching the
   * number and write the failing run into the table: this test drags three times and is the slowest in the file.
   */
  expect(katowice.median, 'Katowice pans no worse than three world frames').toBeLessThanOrEqual(Math.max(75, world.median * 3));
  expect(giza.median, 'and Giza, with every street class drawn, no worse than six').toBeLessThanOrEqual(Math.max(150, world.median * 6));
  expect(pageErrors(page)).toEqual([]);
});
