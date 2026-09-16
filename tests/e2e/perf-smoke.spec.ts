import { expect, test, type Page } from '@playwright/test';
import { openPage, setMapStyle, waitForTexture } from './helpers';

// Spec §8 "Performance smoke". SwiftShader in headless Chromium is far slower than a phone GPU, so the bounds are
// generous (planning ruling R23); the numbers are printed for the report and the phone check is manual.
const draws = (page: Page, view: 'flat' | 'globe') => page.evaluate((v) => (window as unknown as { __mapTextures: { drawCount(v: string): number } }).__mapTextures.drawCount(v), view);
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

  const { median, p90 } = await dragGlobe(page, 4);

  await setMapStyle(page, 'physical');
  await waitForTexture(page, 'flat');
  const before = await draws(page, 'flat');
  t = Date.now();
  await setMapStyle(page, 'satellite');
  await expect.poll(() => draws(page, 'flat'), { intervals: [10] }).toBeGreaterThan(before);
  const switchBack = Date.now() - t;

  console.log(JSON.stringify({ firstDrawMs: firstDraw, dragMedianMs: median, dragP90Ms: p90, switchBackMs: switchBack }));
  expect(firstDraw).toBeLessThan(2500);
  expect(median).toBeLessThan(120);
  /*
   * Task 20 measured this bound instead of assuming it. Choosing an already-decoded style re-uploads the three
   * images to both views' WebGL contexts, which SwiftShader does on the CPU: 420–450 ms on this container with the
   * spec running alone, and up to ~1005 ms with the whole suite on six workers beside it. (Of that, physical — two
   * images, no Black Marble — takes about 225 ms and satellite about 400 ms.) The spec's original 400 ms therefore
   * only ever passed on an idle machine. Raised to 1500 ms, which still catches the regression worth catching here,
   * a switch that decodes the images again: a first draw including the decode is itself ~700 ms. The real target,
   * "≤ 100 ms after the first decode", is a GPU number and stays a manual check on real hardware (see the report).
   */
  expect(switchBack).toBeLessThan(1500);
});
