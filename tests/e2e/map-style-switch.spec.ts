import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors, waitForTexture } from './helpers';

test('every map toolbar offers the four styles; a choice is drawn, described and remembered', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const flatGroup = page.locator('.view-flat').getByRole('group', { name: 'Map style' });
  const globeGroup = page.locator('.view-globe').getByRole('group', { name: 'Map style' });
  await expect(flatGroup.getByRole('button')).toHaveText(['Atlas', 'Physical', 'Satellite', 'Political']);
  await expect(globeGroup.getByRole('button')).toHaveCount(4);
  await expect(flatGroup.getByRole('button', { name: 'Atlas' })).toHaveAttribute('aria-pressed', 'true');

  await flatGroup.getByRole('button', { name: 'Physical' }).click();
  await expect(globeGroup.getByRole('button', { name: 'Physical' })).toHaveAttribute('aria-pressed', 'true');
  await waitForTexture(page, 'flat');
  await expect(page.locator('.view-flat .frame')).toHaveAttribute('data-map-style', 'physical');
  await expect(page.getByRole('group', { name: 'World map with parallels and meridians' })).toHaveAccessibleDescription(/mountains in brown/);
  await expect(page.locator('.map-status')).toBeEmpty();
  await expectNoAxeViolations(page, 'lab physical switch');

  await page.reload();
  await page.waitForSelector('#main');
  await expect(page.locator('.view-flat').getByRole('group', { name: 'Map style' }).getByRole('button', { name: 'Physical' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('geo-coords:map-style'))).toBe('physical');
  expect(pageErrors(page)).toEqual([]);
});

test('the choice is shared by every map in the lesson and shown in Settings, which can change it', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('geo-coords:map-style', 'political'));
  await openPage(page, 'en/topic-3/practice');
  await expect(page.getByRole('group', { name: 'Map style' }).first().getByRole('button', { name: 'Political' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Settings' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('radio', { name: 'Political' })).toBeChecked();
  await dialog.getByRole('radio', { name: 'Atlas' }).check();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('group', { name: 'Map style' }).first().getByRole('button', { name: 'Atlas' })).toHaveAttribute('aria-pressed', 'true');
});

test('keyboard only: Tab to the switch, Enter picks a style', async ({ page }) => {
  await openPage(page, 'en/topic-1/explore/9');
  const satellite = page.locator('.view-flat').getByRole('group', { name: 'Map style' }).getByRole('button', { name: 'Satellite' });
  for (let i = 0; i < 60 && !(await satellite.evaluate((b) => b === document.activeElement)); i++) await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(satellite).toHaveAttribute('aria-pressed', 'true');
});

test('below 480 px the switch is a compact menu: open, choose, Esc returns focus', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openPage(page, 'pl/lab');
  const menu = page.locator('.view-flat').getByRole('button', { name: 'Styl mapy: Atlas' });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  const panel = page.getByRole('group', { name: 'Styl mapy' });
  await expect(panel.getByRole('button')).toHaveText(['Atlas', 'Fizyczna', 'Satelitarna', 'Polityczna']);
  await expect(panel.getByRole('button', { name: 'Atlas' })).toBeFocused();
  await expectNoAxeViolations(page, 'compact style menu');
  await panel.getByRole('button', { name: 'Satelitarna' }).click();
  await expect(page.locator('.view-flat').getByRole('button', { name: 'Styl mapy: Satelitarna' })).toBeFocused();
  await page.locator('.view-flat').getByRole('button', { name: /Styl mapy/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('group', { name: 'Styl mapy' })).toHaveCount(0);
  await expect(page.locator('.view-flat').getByRole('button', { name: /Styl mapy/ })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
});

for (const width of [320, 480, 600, 1024, 1366]) {
  test(`no horizontal page scroll with the style switch at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const hash of ['uk/lab', 'en/topic-1/explore', 'pl/topic-3/practice']) {
      await openPage(page, hash);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${hash} at ${width}`).toBeLessThanOrEqual(width);
    }
  });
}

test('reduced motion: changing the style does not animate the map', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPage(page, 'en/lab', '?test');
  await page.locator('.view-flat').getByRole('group', { name: 'Map style' }).getByRole('button', { name: 'Political' }).click();
  expect(await page.locator('.view-flat .frame').evaluate((f) => f.getAnimations().length)).toBe(0);
});

/*
 * The status is a live region, and a live region only gets announced when text changes inside one the browser
 * already knows about: `display: none` would keep it out of the accessibility tree until it is populated, which
 * reads as a brand-new region and is not announced by most screen readers (see MapStyleNote.svelte / the fallback
 * note, and src/map/MapStage.svelte's `.map-status:empty` rule, which takes the same out-of-flow treatment). axe
 * cannot see this, so it is asserted here — with `createImageBitmap` slowed down so the "Loading map…" window is
 * long enough to observe reliably instead of racing the real (near-instant, cached) decode.
 */
test('the loading status is one live region, present before it has anything to say and then updated in place', async ({ page }) => {
  await page.addInitScript(() => {
    const real = window.createImageBitmap.bind(window);
    window.createImageBitmap = ((...args: Parameters<typeof real>) =>
      new Promise((resolve, reject) => setTimeout(() => real(...args).then(resolve, reject), 400))) as typeof real;
  });
  await openPage(page, 'en/lab', '?test');
  const status = page.locator('p.map-status[role="status"]');
  await expect(status).toHaveCount(1);
  await expect(status).toHaveText('');
  const empty = await status.evaluate((el) => {
    const s = getComputedStyle(el);
    return { display: s.display, visibility: s.visibility, height: el.getBoundingClientRect().height };
  });
  expect(empty.display).not.toBe('none'); // still in the accessibility tree while it has nothing to say
  expect(empty.visibility).not.toBe('hidden');
  expect(empty.height).toBeLessThanOrEqual(1); // and out of flow, so it adds no spacing to the stage
  const same = (await status.elementHandle())!;
  await page.locator('.view-flat').getByRole('group', { name: 'Map style' }).getByRole('button', { name: 'Physical' }).click();
  await expect(status).toHaveText('Loading map…');
  // The very same node changed its text; a node replaced wholesale would be a new region the browser never announces.
  expect(await same.evaluate((el) => [el.isConnected, el.textContent])).toEqual([true, 'Loading map…']);
  await waitForTexture(page, 'flat');
  await expect(status).toBeEmpty();
});
