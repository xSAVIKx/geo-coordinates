import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

test('lab: time slider moves night and updates clocks', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const time = page.getByRole('slider', { name: 'Time (UTC, Greenwich)' });
  await time.focus();
  await page.keyboard.press('Home');
  await expect(time).toHaveAttribute('aria-valuetext', '00:00 UTC');
  const katowice = page.getByRole('row', { name: /Katowice/ });
  await expect(katowice).toContainText('01:16');
  await expect(katowice).toContainText('night');
  const noonAt = async () => page.locator('.view-flat path.noon').getAttribute('d');
  const before = await noonAt();
  await page.keyboard.press('PageUp'); // +60 min
  await expect(katowice).toContainText('02:16');
  // The noon line moved 15° west.
  await expect.poll(noonAt).not.toBe(before);
  // The clocks run west to east.
  await expect(page.locator('.clocks tbody th .name')).toHaveText(['New York', 'London', 'Katowice', 'The point (19°E)', 'Kyiv', 'Delhi', 'Tokyo']);
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

test('lab: the spin speed changes how fast the clocks run, even while spinning', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const minutes = () => page.evaluate(() => (window as unknown as { __mapState: { sun: { utcMinutes: number } } }).__mapState.sun.utcMinutes);
  const speed = page.getByRole('group', { name: 'Speed: one day lasts' });
  await expect(speed.getByRole('button', { name: '12 sec' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('One day = 12 seconds, 7,200 times faster than the real Earth.')).toBeVisible();

  // The real Earth: a minute of simulated time takes a whole real minute, so nothing moves in a second.
  await speed.getByRole('button', { name: '24 hr' }).click();
  await expect(page.getByText(/Real speed: the Earth turns 15° every hour/)).toBeVisible();
  const before = await minutes();
  await page.getByRole('button', { name: 'Spin the Earth' }).click();
  await page.waitForTimeout(800);
  expect(await minutes()).toBe(before);

  // Switch to one day a second without stopping: hours go by within half a second.
  await speed.getByRole('button', { name: '1 sec' }).click();
  await expect(speed.getByRole('button', { name: '1 sec' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => ((await minutes()) - before + 1440) % 1440, { timeout: 2000 }).toBeGreaterThan(240);
  await page.getByRole('button', { name: 'Stop' }).click();
  await expectNoAxeViolations(page);
  expect(pageErrors(page)).toEqual([]);
});

test('lab: the spin speed is named in Polish and Ukrainian', async ({ page }) => {
  await openPage(page, 'pl/lab');
  await expect(page.getByRole('group', { name: 'Prędkość: doba trwa' })).toBeVisible();
  await expect(page.getByText(/Jedna doba\s=\s12\ssekund, czyli 7200 razy szybciej/)).toBeVisible();
  await openPage(page, 'uk/lab');
  await expect(page.getByRole('group', { name: 'Швидкість: доба триває' })).toBeVisible();
  await expect(page.getByText(/Одна доба\s=\s12\sсекунд, тобто в 7\s?200 разів швидше/)).toBeVisible();
});

test('reduced motion hides the spin button', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPage(page, 'en/lab');
  await expect(page.getByRole('button', { name: 'Spin the Earth' })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Speed: one day lasts' })).toHaveCount(0);
});

test('lab on a phone: controls follow the map and nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openPage(page, 'uk/lab');
  await expect(page.getByRole('row', { name: /Київ/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await expectNoAxeViolations(page, 'lab phone');
});
