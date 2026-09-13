import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage } from './helpers';

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
