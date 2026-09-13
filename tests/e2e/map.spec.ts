import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

test('lab shows globe and flat map side by side on desktop', async ({ page }) => {
  await openPage(page, 'en/lab');
  await expect(page.getByRole('group', { name: 'World map with parallels and meridians' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Globe that you can turn' })).toBeVisible();
  await expectNoAxeViolations(page, 'lab desktop');
  expect(pageErrors(page)).toEqual([]);
});

test('phone shows one view with a switch', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openPage(page, 'pl/lab');
  await expect(page.getByRole('group', { name: 'Globus, który możesz obracać' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Globus' }).click();
  await expect(page.getByRole('group', { name: 'Globus, który możesz obracać' })).toBeVisible();
  await expectNoAxeViolations(page, 'lab phone');
});

test('clicking the flat map moves the point', async ({ page }) => {
  await openPage(page, 'en/lab');
  const map = page.getByRole('group', { name: 'World map with parallels and meridians' });
  const box = (await map.boundingBox())!;
  // x = 75% of width → lon 90°E; y = 25% of height → lat 45°N
  await map.click({ position: { x: box.width * 0.75, y: box.height * 0.25 } });
  const handle = map.locator('[data-point-handle]');
  const hb = (await handle.boundingBox())!;
  expect(Math.abs(hb.x + hb.width / 2 - (box.x + box.width * 0.75))).toBeLessThan(6);
});

test('keyboard moves the point on the flat map', async ({ page }) => {
  await openPage(page, 'en/lab');
  const map = page.getByRole('group', { name: 'World map with parallels and meridians' });
  const before = (await map.locator('[data-point-handle]').boundingBox())!;
  await map.focus();
  await page.keyboard.press('Shift+ArrowRight');
  const after = (await map.locator('[data-point-handle]').boundingBox())!;
  expect(after.x).toBeGreaterThan(before.x + 5);
});

test('turning the globe past the point hides it, "Show the point" brings it back', async ({ page }) => {
  await openPage(page, 'en/lab');
  const globe = page.getByRole('group', { name: 'Globe that you can turn' });
  const handle = globe.locator('[data-point-handle]');
  await expect(handle).toHaveCount(1);
  const turnSouth = page.getByRole('button', { name: 'Tilt globe to show the south' });
  // The point (Katowice, 50°N) starts centred; 8 south tilts (15° each) swing the visible
  // centre to well past the opposite hemisphere, taking the point below the horizon.
  // This also guards against the recentre effect firing on rotation: if it did, the point
  // would be snapped back into view after every click and this would never reach 0.
  for (let i = 0; i < 8; i++) await turnSouth.click();
  await expect(handle).toHaveCount(0);
  await page.getByRole('button', { name: 'Show the point' }).click();
  await expect(handle).toHaveCount(1);
});

test('dragging the globe rotates the view', async ({ page }) => {
  await openPage(page, 'en/lab');
  const globe = page.getByRole('group', { name: 'Globe that you can turn' });
  const handle = globe.locator('[data-point-handle]');
  const box = (await globe.boundingBox())!;
  const before = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.5, { steps: 10 });
  await page.mouse.up();
  if ((await handle.count()) === 0) {
    // The drag rotated the point off the visible side — the view clearly changed.
    expect(await handle.count()).toBe(0);
  } else {
    const after = (await handle.boundingBox())!;
    expect(Math.abs(after.x - before.x)).toBeGreaterThan(5);
  }
});

test('switching to Equal Earth keeps the point workable and the map accessible', async ({ page }) => {
  await openPage(page, 'en/lab');
  const map = page.getByRole('group', { name: 'World map with parallels and meridians' });
  const gridBtn = page.getByRole('button', { name: 'Grid map' });
  const equalEarthBtn = page.getByRole('button', { name: 'Equal Earth' });
  await expect(gridBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(equalEarthBtn).toHaveAttribute('aria-pressed', 'false');

  await equalEarthBtn.click();
  await expect(equalEarthBtn).toHaveAttribute('aria-pressed', 'true');
  await expect(gridBtn).toHaveAttribute('aria-pressed', 'false');

  const handle = map.locator('[data-point-handle]');
  await expect(handle).toHaveCount(1);
  const before = (await handle.boundingBox())!;
  await map.focus();
  await page.keyboard.press('Shift+ArrowRight');
  const after = (await handle.boundingBox())!;
  expect(after.x).not.toBeCloseTo(before.x, 0);

  await expectNoAxeViolations(page, 'lab equal-earth');
  expect(pageErrors(page)).toEqual([]);
});

test('the Equal Earth preference is remembered after a reload', async ({ page }) => {
  await openPage(page, 'en/lab');
  await page.getByRole('button', { name: 'Equal Earth' }).click();
  await openPage(page, 'en/lab');
  await expect(page.getByRole('button', { name: 'Equal Earth' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Grid map' })).toHaveAttribute('aria-pressed', 'false');
});

test('Map app (Mercator): the whole world at first, zoom in and pan north past 66°, click sets a point, no errors', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const map = page.getByRole('group', { name: 'World map with parallels and meridians' });
  const mercator = page.getByRole('button', { name: 'Map app (Mercator)' });
  await mercator.click();
  await expect(mercator).toHaveAttribute('aria-pressed', 'true');
  type S = { __mapState: { flat: { zoom: number; center: { lat: number } }; flatMinZoom: number } };
  const state = () => page.evaluate(() => { const s = (window as unknown as S).__mapState; return { zoom: s.flat.zoom, lat: s.flat.center.lat, min: s.flatMinZoom }; });
  const world = await state();
  expect(world.zoom).toBeCloseTo(world.min, 6);
  expect(world.min).toBeLessThan(0.51);
  // Zoom in (the world gets taller than the view) and drag the map down to see further north.
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  const box = (await map.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height - 10, { steps: 8 });
  await page.mouse.up();
  const panned = await state();
  expect(panned.zoom).toBeGreaterThan(world.min);
  expect(panned.lat).toBeGreaterThan(10);
  expect(panned.lat).toBeLessThan(85);
  await map.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(map.locator('[data-point-handle]')).toHaveCount(1);
  await expectNoAxeViolations(page, 'lab mercator');
  // A sweep of views, north to south and deep into Katowice: no broken (NaN) SVG anywhere.
  for (const [lat, lon, zoom] of [[84, -40, 0.8], [70, -40, 1.3], [60, 170, 2], [-80, 0, 1.1], [0, -179, 3], [50.26, 19.02, 9], [50.26, 19.02, 80], [-60, 60, 30]] as const) {
    const bad = await page.evaluate(async ([la, lo, z]) => {
      const s = (window as unknown as S).__mapState as unknown as { zoomFlat(f: number): void; panFlat(a: number, b: number): void; flat: { zoom: number; center: { lat: number; lon: number } } };
      s.zoomFlat(z / s.flat.zoom); s.panFlat(la - s.flat.center.lat, lo - s.flat.center.lon);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return [...document.querySelectorAll('svg path, svg circle, svg text, svg g[transform]')].map((el) => [...el.attributes].map((at) => at.value).join(' ')).filter((v) => /NaN|Infinity/.test(v)).length;
    }, [lat, lon, zoom] as const);
    expect(bad, `view ${lat},${lon} zoom ${zoom}`).toBe(0);
  }
  expect(pageErrors(page)).toEqual([]);
});
