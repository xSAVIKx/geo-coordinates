import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

const NAMES = {
  en: { map: 'World map with parallels and meridians', poland: 'Poland', zoomIn: 'Zoom in', katowice: 'Katowice', minute: /^\d+°\d\d′N$/ },
  uk: { map: 'Карта світу з паралелями й меридіанами', poland: 'Польща', zoomIn: 'Наблизити', katowice: 'Катовиці', minute: /^\d+°\d\d′ пн\. ш\.$/ },
} as const;

for (const lang of ['en', 'uk'] as const) {
  test(`lab (${lang}): zooming into Katowice shows its label, detailed map data and minute edge labels`, async ({ page }) => {
    const n = NAMES[lang];
    await openPage(page, `${lang}/lab`, '?test');
    const map = page.locator('.view-flat svg[role="group"]');
    await page.locator('.view-flat').getByRole('button', { name: n.poland, exact: true }).click();
    const zoomIn = page.locator('.view-flat').getByRole('button', { name: n.zoomIn, exact: true });
    for (let i = 0; i < 3; i++) await zoomIn.click();
    await expect(map.locator('[data-detail="central-europe"]')).toHaveCount(1);
    await expect(map.locator('path.river[data-river="vistula"]')).toHaveCount(1);
    await expect(map.locator('path.voivodeships')).toHaveCount(1);
    await expect(map.locator('text.river-name[data-river="vistula"]')).toHaveCount(1);

    // Pan south from the preset's centre (52°N) to Katowice (50.26°N) by dragging the map up.
    const zoom = await page.evaluate(() => (window as unknown as { __mapState: { flat: { zoom: number } } }).__mapState.flat.zoom);
    const box = (await map.boundingBox())!;
    const dy = ((52 - 50.26) * box.width * zoom) / 360;
    const x = box.x + box.width * 0.3, y = box.y + box.height * 0.5;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - dy, { steps: 8 });
    await page.mouse.up();
    for (let i = 0; i < 2; i++) await zoomIn.click();

    const state = await page.evaluate(() => (window as unknown as { __mapState: { flat: { zoom: number; center: { lat: number } } } }).__mapState.flat);
    expect(state.zoom).toBeGreaterThan(60);
    expect(Math.abs(state.center.lat - 50.26)).toBeLessThan(0.3);
    await expect(map.locator('text.place-name', { hasText: n.katowice })).toBeVisible();
    const edge = map.locator('.edge text');
    await expect.poll(async () => (await edge.allTextContents()).filter((s) => n.minute.test(s)).length).toBeGreaterThan(0);
    await expectNoAxeViolations(page, `deep zoom ${lang}`);
    expect(pageErrors(page)).toEqual([]);
  });
}

test('flat map zoom stops at 6000 and the globe at 60', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const flat = page.getByRole('group', { name: 'World map with parallels and meridians' });
  await flat.focus();
  // Each press multiplies the zoom by 1.5, and 22 is the exact minimum that arrives: 1.5^21 = 4 987.9 is short of
  // the ceiling and 1.5^22 = 7 481.8 is past it. There is no margin here — raising FLAT_MAX_ZOOM means raising this.
  for (let i = 0; i < 22; i++) await page.keyboard.press('+');
  const globe = page.getByRole('group', { name: 'Globe that you can turn' });
  await globe.focus();
  for (let i = 0; i < 14; i++) await page.keyboard.press('+');
  const z = await page.evaluate(() => { const s = (window as unknown as { __mapState: { flat: { zoom: number }; globeZoom: number } }).__mapState; return [s.flat.zoom, s.globeZoom]; });
  expect(z).toEqual([6000, 60]);

  // Clicking still places the point exactly where clicked. At zoom 80 a minute is about 2 CSS px, which is what
  // this check was written for; the deeper zooms are covered by tests/e2e/city-streets.spec.ts.
  await page.evaluate(() => { const s = (window as unknown as { __mapState: { precision: string; flat: unknown } }).__mapState; s.precision = 'minute'; s.flat = { center: { lat: 50.26, lon: 19.02 }, zoom: 80 }; });
  const box = (await flat.boundingBox())!;
  await flat.click({ position: { x: box.width * 0.7, y: box.height * 0.3 } });
  const hb = (await flat.locator('[data-point-handle]').boundingBox())!;
  expect(Math.abs(hb.x + hb.width / 2 - (box.x + box.width * 0.7))).toBeLessThan(3);
  expect(Math.abs(hb.y + hb.height / 2 - (box.y + box.height * 0.3))).toBeLessThan(3);
});

/**
 * The fence for this feature's whole reason to exist. Nothing else catches a call site that forgets to ask for
 * `parallelStep`: the unit tests only measure `geometry.ts`, and the seven Atlas baselines top out at zoom 12,
 * where the step is still exactly 1. This drives the real renderer at a city zoom and measures the drawn SVG.
 */
test('at a city zoom every drawn parallel lands on the parallel, not bowed off it', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const map = page.locator('.view-flat svg[role="group"]');
  // Seated on the Arctic Circle inside the Rovaniemi box, at the zoom that box fills the view. The point is put
  // on the line itself, so the point handle's own y *is* the parallel's true y — no arithmetic in the test.
  await page.evaluate(() => {
    const s = (window as unknown as { __mapState: { precision: string; flat: unknown; point: unknown } }).__mapState;
    s.precision = 'minute';
    s.flat = { center: { lat: 66.56, lon: 25.8475 }, zoom: 2659 };
    s.point = { lat: 66.56, lon: 25.8475 };
  });
  const handle = map.locator('[data-point-handle]');
  await expect(handle).toHaveAttribute('transform', /translate/);
  const trueY = Number(/translate\([-\d.]+[ ,]([-\d.]+)\)/.exec((await handle.getAttribute('transform'))!)![1]);

  const ys = (d: string) => [...d.matchAll(/(-?\d+\.?\d*),(-?\d+\.?\d*)/g)].map((m) => Number(m[2]));
  const drawn = async (sel: string) => (await map.locator(sel).evaluateAll((els) => els.map((e) => e.getAttribute('d') ?? ''))).filter((d) => d.length > 0);

  // 1. SpecialLines.svelte: the Arctic Circle, the line this box is *about*. (`.polar` is the Arctic and the
  //    Antarctic circles; only the Arctic one is anywhere near this view, so only it has a path.)
  const polar = await drawn('path.line.polar');
  expect(polar.length, 'the Arctic Circle is drawn in this view').toBe(1);
  for (const y of ys(polar[0]!)) expect(Math.abs(y - trueY), `special line y ${y} vs ${trueY}`).toBeLessThan(0.25);

  // 2. PointMarker.svelte: the point's own dashed latitude guide, along the same parallel.
  const guides = await drawn('path.guide');
  const flat = guides.map(ys).filter((v) => Math.max(...v) - Math.min(...v) < 1);   // the horizontal one of the two
  expect(flat.length, "the point's latitude guide is drawn").toBe(1);
  for (const y of flat[0]!) expect(Math.abs(y - trueY), `point guide y ${y} vs ${trueY}`).toBeLessThan(0.25);

  // 3. Overlays.svelte: a highlight-line on the same parallel. It suppresses the point's own guide (they would
  //    wash each other out), so it goes in its own pass.
  await page.evaluate(() => {
    const s = (window as unknown as { __mapState: { overlays: unknown } }).__mapState;
    s.overlays = [{ kind: 'highlight-line', axis: 'lat', value: 66.56 }];
  });
  await expect(map.locator('path.hl-line')).toHaveCount(1);
  const hl = await drawn('path.hl-line');
  for (const y of ys(hl[0]!)) expect(Math.abs(y - trueY), `highlight-line y ${y} vs ${trueY}`).toBeLessThan(0.25);

  expect(pageErrors(page)).toEqual([]);
});

test('lab: zoomed in to 20 the point snaps to minutes, zoomed out to degrees again', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const readout = page.locator('output').first();
  await expect(readout).toHaveText('50°N, 19°E');
  await page.evaluate(() => { (window as unknown as { __mapState: { flat: unknown } }).__mapState.flat = { center: { lat: 50.26, lon: 19.02 }, zoom: 20 }; });
  const flat = page.getByRole('group', { name: 'World map with parallels and meridians' });
  await flat.focus();
  await page.keyboard.press('ArrowRight');
  await expect(readout).toHaveText('50°00′N, 19°01′E');
  await expect(page.getByRole('slider', { name: 'Longitude' })).toHaveAttribute('aria-valuetext', /19 degrees 1 minute/);
  // Dragging the point lands on a whole minute too.
  const handle = flat.locator('[data-point-handle]');
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 + 37, hb.y + hb.height / 2 - 23, { steps: 5 });
  await page.mouse.up();
  await expect(readout).toHaveText(/^\d+°\d\d′N, \d+°\d\d′E$/);
  await expect(readout).not.toHaveText('50°00′N, 19°01′E');
  for (let i = 0; i < 3; i++) await page.keyboard.press('-');
  await expect(readout).toHaveText(/^\d+°N, \d+°E$/);
});

test('dragging the flat map slides the drawn map and redraws it at the end, landing where the pointer went', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await page.evaluate(() => { (window as unknown as { __mapState: { flat: unknown } }).__mapState.flat = { center: { lat: 51.5, lon: 19 }, zoom: 12 }; });
  const map = page.locator('.view-flat svg[role="group"]');
  const geo = map.locator('g.geo');
  const box = (await map.boundingBox())!;
  const x = box.x + box.width * 0.15, y = box.y + box.height * 0.2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 60, y + 30, { steps: 6 });
  await expect(geo).toHaveAttribute('transform', /^translate\(/);
  await page.mouse.move(x + 120, y + 60, { steps: 6 });
  await page.mouse.up();
  await expect(geo).not.toHaveAttribute('transform', /.+/);
  const c = await page.evaluate(() => (window as unknown as { __mapState: { flat: { center: { lat: number; lon: number } } } }).__mapState.flat.center);
  const degPerCssPx = 360 / (box.width * 12);
  expect(c.lon).toBeCloseTo(19 - 120 * degPerCssPx, 1);
  expect(c.lat).toBeCloseTo(51.5 + 60 * degPerCssPx, 1);
  expect(pageErrors(page)).toEqual([]);
});
