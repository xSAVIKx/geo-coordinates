import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors, probe, setMapStyle, textureHooks, waitForTexture } from './helpers';

const NOTE = "This device can't draw this style; showing Atlas.";
const drawCount = (page: Page) => page.evaluate(() => (window as unknown as { __mapTextures: { drawCount(v: string): number } }).__mapTextures.drawCount('flat'));
const styles = (page: Page) => page.evaluate(() => { const s = (window as unknown as { __mapState: { chosenMapStyle: string; mapStyle: string; drawnMapStyle: string } }).__mapState; return [s.chosenMapStyle, s.mapStyle, s.drawnMapStyle]; });

async function open(page: Page, flags: string, style: 'physical' | 'satellite' = 'physical') {
  await openPage(page, 'en/lab', `?test${flags}`);
  await setMapStyle(page, style);
}

/** `draws`: the frame count to wait for, so a tier that takes over mid-session is not confused with the frames before it. */
async function expectCanvasDrawing(page: Page, draws = 1) {
  await expect.poll(() => textureHooks(page).tier()).toBe('canvas');
  await waitForTexture(page, 'flat', draws);
  await expect(page.locator('.view-flat canvas.texture')).toHaveAttribute('data-tier', 'canvas');
  const sahara = (await probe(page, 'flat', 23, 12))!;
  expect(sahara.avg[0]).toBeGreaterThan(sahara.avg[2] + 15);
  await expect(page.getByText(NOTE)).toHaveCount(0);
}

async function expectAtlasWithNote(page: Page) {
  await expect.poll(() => textureHooks(page).tier()).toBe('atlas');
  await expect(page.getByRole('status').filter({ hasText: NOTE })).toBeVisible();
  expect(await styles(page)).toEqual(['physical', 'atlas', 'atlas']);
  await expect(page.locator('canvas.texture')).toHaveCount(0);
  await expect(page.locator('.view-flat path.land')).toHaveCount(1);
}

test('no WebGL: the same picture from the canvas path, no note', async ({ page }) => {
  await open(page, '&gl=off');
  await expectCanvasDrawing(page);
  expect(pageErrors(page)).toEqual([]);
});

test('a shader that fails to compile: canvas', async ({ page }) => {
  await open(page, '&gl=shader-fail');
  await expectCanvasDrawing(page);
});

test('an exception while drawing with WebGL: canvas', async ({ page }) => {
  await open(page, '&gl=render-fail');
  await expectCanvasDrawing(page);
});

test('no WebGL and no canvas: Atlas with the note, and axe is clean', async ({ page }) => {
  await open(page, '&gl=off&canvas=off');
  await expectAtlasWithNote(page);
  await expectNoAxeViolations(page, 'fallback note');
  expect(pageErrors(page)).toEqual([]);
});

test('an exception while drawing on the canvas: Atlas with the note', async ({ page }) => {
  await open(page, '&gl=off&canvas=render-fail');
  await expectAtlasWithNote(page);
});

test('images that cannot be decoded: Atlas with the note; nothing is remembered after a reload', async ({ page }) => {
  await open(page, '&gl=decode-fail');
  await expectAtlasWithNote(page);
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'physical');
  await waitForTexture(page, 'flat');
  expect(await textureHooks(page).tier()).toBe('webgl');
});

test('a lost WebGL context that is not restored in time: canvas', async ({ page }) => {
  await open(page, '&glRestoreMs=300');
  await waitForTexture(page, 'flat');
  const before = await drawCount(page);
  await textureHooks(page).loseContext('flat', null);
  await expectCanvasDrawing(page, before + 1);
});

test('a lost WebGL context that comes back: WebGL again, drawing', async ({ page }) => {
  await open(page, '&glRestoreMs=5000');
  await waitForTexture(page, 'flat');
  const before = await drawCount(page);
  await textureHooks(page).loseContext('flat', 150);
  await expect.poll(() => textureHooks(page).health()).toMatchObject({ tier: 'webgl', waitingForRestore: false });
  await page.evaluate(() => (window as unknown as { __mapState: { zoomFlat(f: number): void } }).__mapState.zoomFlat(1.5));
  await waitForTexture(page, 'flat', before + 1);
  expect((await probe(page, 'flat', 23, 12))).not.toBeNull();
});

test('printing replaces the canvas with a snapshot of the same picture', async ({ page }) => {
  await open(page, '');
  await waitForTexture(page, 'flat');
  await page.evaluate(() => dispatchEvent(new Event('beforeprint')));
  const src = await page.locator('.view-flat img.print-snapshot').getAttribute('src');
  expect(src?.startsWith('data:image/png;base64,')).toBe(true);
  expect(src!.length).toBeGreaterThan(20_000);
  await page.evaluate(() => dispatchEvent(new Event('afterprint')));
  await expect(page.locator('img.print-snapshot')).toHaveCount(0);
});

/*
 * The note is a live region, and a live region only gets announced when text changes inside one the browser already
 * knows about: `display: none` would keep it out of the accessibility tree until it is populated, which reads as a
 * brand-new region and is not announced by most screen readers. axe cannot see this, so it is asserted here.
 */
test('the fallback note is one live region, present before it has anything to say and then updated in place', async ({ page }) => {
  await openPage(page, 'en/lab', '?test&gl=off&canvas=off');
  const note = page.locator('p.style-note[role="status"]');
  await expect(note).toHaveCount(1);
  await expect(note).toHaveText('');
  const empty = await note.evaluate((el) => {
    const s = getComputedStyle(el);
    return { display: s.display, visibility: s.visibility, height: el.getBoundingClientRect().height };
  });
  expect(empty.display).not.toBe('none');      // still in the accessibility tree while it has nothing to say
  expect(empty.visibility).not.toBe('hidden');
  expect(empty.height).toBeLessThanOrEqual(1); // and out of flow, so it adds no spacing to the stage
  const same = (await note.elementHandle())!;
  await setMapStyle(page, 'physical');
  await expect.poll(() => textureHooks(page).tier()).toBe('atlas');
  await expect(note).toHaveText(NOTE);
  // The very same node changed its text; a node replaced wholesale would be a new region the browser never announces.
  expect(await same.evaluate((el) => [el.isConnected, el.textContent])).toEqual([true, NOTE]);
});
