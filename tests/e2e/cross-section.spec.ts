import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage } from './helpers';

test('cross-section shows the latitude angle and follows the point', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await page.evaluate(() => {
    const s = (window as any).__mapState;
    s.applyScene({ views: ['cross-section'], point: { lat: 52, lon: 21 }, pointEditable: true });
  });
  const diagram = page.getByRole('group', { name: /Cross-section of the Earth/ });
  await expect(diagram).toBeVisible();
  await expect(diagram.locator('text.angle-t')).toHaveText('52°N');
  await diagram.focus();
  await page.keyboard.press('Shift+ArrowDown');
  await expect(diagram.locator('text.angle-t')).toHaveText('42°N');
  await expectNoAxeViolations(page, 'cross-section');
});

test('southern latitude draws the point below the equator', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await page.evaluate(() => {
    const s = (window as any).__mapState;
    s.applyScene({ views: ['cross-section'], point: { lat: -35, lon: 21 }, pointEditable: true });
  });
  const diagram = page.getByRole('group', { name: /Cross-section of the Earth/ });
  await expect(diagram.locator('text.angle-t')).toHaveText('35°S');
  const centre = await diagram.locator('circle.centre').boundingBox();
  const point = await diagram.locator('circle.pt').boundingBox();
  if (!centre || !point) throw new Error('missing bounding boxes');
  expect(point.y + point.height / 2).toBeGreaterThan(centre.y + centre.height / 2);
});

test('dragging the point toward the top increases the northern latitude', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await page.evaluate(() => {
    const s = (window as any).__mapState;
    s.applyScene({ views: ['cross-section'], point: { lat: 10, lon: 21 }, pointEditable: true });
  });
  const diagram = page.getByRole('group', { name: /Cross-section of the Earth/ });
  const svgBox = await diagram.boundingBox();
  const startBox = await diagram.locator('circle.pt').boundingBox();
  if (!svgBox || !startBox) throw new Error('missing bounding boxes');
  const startX = startBox.x + startBox.width / 2;
  const startY = startBox.y + startBox.height / 2;
  const targetX = svgBox.x + svgBox.width / 2;
  const targetY = svgBox.y + svgBox.height * 0.1;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 10 });
  await page.mouse.up();
  const text = (await diagram.locator('text.angle-t').textContent()) ?? '';
  expect(text.endsWith('N')).toBe(true);
  expect(Number(text.match(/\d+/)?.[0] ?? '0')).toBeGreaterThan(10);
});

test('locked point ignores keyboard nudge', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await page.evaluate(() => {
    const s = (window as any).__mapState;
    s.applyScene({ views: ['cross-section'], point: { lat: 52, lon: 21 }, pointEditable: false });
  });
  const diagram = page.getByRole('group', { name: /Cross-section of the Earth/ });
  await expect(diagram.locator('text.angle-t')).toHaveText('52°N');
  await diagram.focus();
  await page.keyboard.press('ArrowUp');
  await expect(diagram.locator('text.angle-t')).toHaveText('52°N');
});
