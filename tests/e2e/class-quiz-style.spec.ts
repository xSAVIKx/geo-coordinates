import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

const read = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const s = (window as unknown as { __mapState: { chosenMapStyle: string; runStyle: string | null; stylePreference: string } }).__mapState;
  return { chosen: s.chosenMapStyle, run: s.runStyle, saved: localStorage.getItem('geo-coords:map-style') };
});

test('the class quiz style applies to the run only; the saved choice is untouched', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('geo-coords:map-style', 'physical'); sessionStorage.setItem('seeded', '1'); } });
  await openPage(page, 'en/class-quiz', '?test');
  const group = page.getByRole('group', { name: 'Map style for the class' });
  await expect(group.getByRole('radio', { name: 'Physical' })).toBeChecked();
  await group.getByRole('radio', { name: 'Political' }).check();
  await expectNoAxeViolations(page, 'class quiz setup with style');
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  expect(await read(page)).toEqual({ chosen: 'political', run: 'political', saved: 'physical' });
  await expect(page.getByRole('group', { name: 'Map style' }).first().getByRole('button', { name: 'Political' })).toHaveAttribute('aria-pressed', 'true');

  // A pick on the toolbar during the run changes the run, not the saved choice.
  await page.getByRole('group', { name: 'Map style' }).first().getByRole('button', { name: 'Satellite' }).click();
  expect(await read(page)).toEqual({ chosen: 'satellite', run: 'satellite', saved: 'physical' });
  await page.locator('body').press('ArrowRight');
  expect((await read(page)).chosen).toBe('satellite');

  await page.getByRole('button', { name: 'End quiz' }).click();
  expect(await read(page)).toEqual({ chosen: 'physical', run: null, saved: 'physical' });
  expect(pageErrors(page)).toEqual([]);
});

test('leaving a running quiz for another page ends the run style', async ({ page }) => {
  await openPage(page, 'en/class-quiz', '?test');
  await page.getByRole('group', { name: 'Map style for the class' }).getByRole('radio', { name: 'Satellite' }).check();
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  await page.goto(page.url().replace(/#.*/, '#en/lab'));
  await page.waitForSelector('.view-flat');
  expect(await read(page)).toEqual({ chosen: 'atlas', run: null, saved: null });
});

test('worksheets and the cheat sheet stay Atlas with no style switch', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('geo-coords:map-style', 'satellite'));
  await openPage(page, 'en/worksheet');
  await expect(page.locator('.paper svg path.land').first()).toBeAttached();
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Map style' })).toHaveCount(0);
  await openPage(page, 'en/cheatsheet');
  await expect(page.locator('canvas')).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Map style' })).toHaveCount(0);
});
