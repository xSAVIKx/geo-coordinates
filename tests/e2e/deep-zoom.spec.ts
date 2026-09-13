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

test('flat map zoom stops at 80 and the globe at 60', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const flat = page.getByRole('group', { name: 'World map with parallels and meridians' });
  await flat.focus();
  for (let i = 0; i < 14; i++) await page.keyboard.press('+');
  const globe = page.getByRole('group', { name: 'Globe that you can turn' });
  await globe.focus();
  for (let i = 0; i < 14; i++) await page.keyboard.press('+');
  const z = await page.evaluate(() => { const s = (window as unknown as { __mapState: { flat: { zoom: number }; globeZoom: number } }).__mapState; return [s.flat.zoom, s.globeZoom]; });
  expect(z).toEqual([80, 60]);
  // Clicking still places the point exactly where clicked at the deepest zoom.
  await page.evaluate(() => { const s = (window as unknown as { __mapState: { precision: string } }).__mapState; s.precision = 'minute'; });
  const box = (await flat.boundingBox())!;
  await flat.click({ position: { x: box.width * 0.7, y: box.height * 0.3 } });
  const hb = (await flat.locator('[data-point-handle]').boundingBox())!;
  const onePx = 1;
  // A minute is ~2 CSS px at this width, so the snapped point is within a couple of px of the click.
  expect(Math.abs(hb.x + hb.width / 2 - (box.x + box.width * 0.7))).toBeLessThan(2 + onePx);
  expect(Math.abs(hb.y + hb.height / 2 - (box.y + box.height * 0.3))).toBeLessThan(2 + onePx);
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
