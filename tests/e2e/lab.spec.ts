import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

test('lab: time slider moves night and updates clocks', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const time = page.getByRole('slider', { name: 'Time (UTC, Greenwich)' });
  await time.focus();
  await page.keyboard.press('Home');
  await expect(time).toHaveAttribute('aria-valuetext', '00:00 UTC');
  const warsaw = page.getByRole('row', { name: /Warsaw/ });
  await expect(warsaw).toContainText('01:24');
  await expect(warsaw).toContainText('night');
  const noonAt = async () => page.locator('.view-flat path.noon').getAttribute('d');
  const before = await noonAt();
  await page.keyboard.press('PageUp'); // +60 min
  await expect(warsaw).toContainText('02:24');
  // The noon line moved 15° west.
  await expect.poll(noonAt).not.toBe(before);
  // The clocks run west to east.
  await expect(page.locator('.clocks tbody th .name')).toHaveText(['New York', 'London', 'Warsaw', 'The point (21°E)', 'Kyiv', 'Delhi', 'Tokyo']);
  await expectNoAxeViolations(page, 'lab');
  expect(pageErrors(page)).toEqual([]);
});

test('lab: date slider shows polar night in December at the North Pole', async ({ page }) => {
  await openPage(page, 'pl/lab');
  const date = page.getByRole('slider', { name: 'Dzień roku' });
  await date.focus();
  await page.keyboard.press('End');
  await expect(date).toHaveAttribute('aria-valuetext', /grudnia/);
  // Moving the point to the Arctic: its clock row says night at every hour of the day.
  const lat = page.getByRole('slider', { name: 'Szerokość geograficzna' });
  await lat.focus();
  await page.keyboard.press('End');
  const time = page.getByRole('slider', { name: 'Godzina (UTC, Greenwich)' });
  const point = page.getByRole('row', { name: /Punkt/ });
  for (const minutes of [0, 360, 720, 1080]) {
    await time.focus();
    await page.keyboard.press('Home');
    for (let i = 0; i < minutes / 60; i++) await page.keyboard.press('PageUp');
    await expect(point).toContainText('noc');
  }
  // The summer solstice button: polar day instead.
  await page.getByRole('button', { name: /21 cze/ }).click();
  await expect(date).toHaveAttribute('aria-valuetext', /czerwca/);
  await expect(page.getByRole('button', { name: /21 cze/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(point).toContainText('dzień');
});

test('lab: spinning the Earth runs the clock and turns the globe, and stops again', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const time = page.getByRole('slider', { name: 'Time (UTC, Greenwich)' });
  const read = () => page.evaluate(() => {
    const s = (window as unknown as { __mapState: { sun: { utcMinutes: number }; rotate: [number, number] } }).__mapState;
    return { sun: { utcMinutes: s.sun.utcMinutes }, rotate: [s.rotate[0], s.rotate[1]] };
  });
  const start = await read();
  const startMinutes = start.sun.utcMinutes, startLambda = start.rotate[0]!;
  await page.getByRole('button', { name: 'Spin the Earth' }).click();
  await expect.poll(async () => (((await read()).sun.utcMinutes - startMinutes + 1440) % 1440)).toBeGreaterThan(30);
  const moved = await read();
  // The globe turned west to east by the same angle the Sun moved: 1° per 4 minutes.
  const minutes = (moved.sun.utcMinutes - startMinutes + 1440) % 1440;
  const turned = (moved.rotate[0]! - startLambda + 360) % 360;
  expect(Math.abs(turned - minutes / 4)).toBeLessThan(3);
  await page.getByRole('button', { name: 'Stop' }).click();
  const stopped = await time.getAttribute('aria-valuenow');
  await page.waitForTimeout(300);
  await expect(time).toHaveAttribute('aria-valuenow', stopped!);
  expect(pageErrors(page)).toEqual([]);
});

test('reduced motion hides the spin button', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPage(page, 'en/lab');
  await expect(page.getByRole('button', { name: 'Spin the Earth' })).toHaveCount(0);
});

test('lab on a phone: controls follow the map and nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openPage(page, 'uk/lab');
  await expect(page.getByRole('row', { name: /Київ/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await expectNoAxeViolations(page, 'lab phone');
});
