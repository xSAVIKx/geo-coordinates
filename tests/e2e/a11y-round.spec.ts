import { expect, test, type Page } from '@playwright/test';
import { openPage, pageErrors } from './helpers';

// Accessibility fixes from the final design, UX and accessibility round (Task D3).

test('topic 9: the coordinate sliders say the decimal value, and seconds where the readout shows them', async ({ page }) => {
  await openPage(page, 'en/topic-9/explore/4', '?test');
  const lat = page.getByRole('slider', { name: 'Latitude' });
  await expect(lat).toHaveAttribute('aria-valuetext', /^50\.26\d\d, 50 degrees 15 minutes( \d+ seconds?)? north$/);
  await openPage(page, 'uk/topic-9/explore/3', '?test');
  await expect(page.getByRole('slider', { name: 'Довгота' })).toHaveAttribute('aria-valuetext', /^\d+\.\d{4}, \d+ градус\S* \d+ хвилин\S* східної довготи$/);
  // Letters elsewhere, as before.
  await openPage(page, 'en/lab', '?test');
  await expect(page.getByRole('slider', { name: 'Latitude' })).toHaveAttribute('aria-valuetext', '50 degrees north');
});

async function largeText(page: Page) {
  await page.addInitScript(() => localStorage.setItem('geo-coords:settings', JSON.stringify({ theme: 'system', largeText: true, reducedMotion: true })));
}
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test('320 px with larger text: no sideways scrolling on topic pages, the lab, the print pages and the results', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 320, height: 640 });
  await largeText(page);
  for (const hash of ['pl/topic-3/explore', 'uk/topic-3/practice', 'uk/lab', 'uk/topic-8/explore/6', 'en/cheatsheet', 'uk/cheatsheet', 'en/worksheet', 'uk/worksheet']) {
    await openPage(page, hash, '?test');
    await page.waitForTimeout(200);
    expect(await overflow(page), hash).toBeLessThanOrEqual(0);
  }
  // A finished rehearsal in Ukrainian (long words in the review).
  await openPage(page, 'uk/rehearsal', '?test');
  await page.locator('.setup .btn.primary').click();
  for (let i = 0; i < 15; i++) {
    const card = page.locator('form.card');
    await expect(card.locator('.progress')).toContainText(String(i + 1));
    const choices = card.locator('label.choice');
    const boxes = card.getByRole('textbox');
    if (await choices.count()) await choices.first().click();
    else if (await boxes.count() === 1) await boxes.first().fill((await card.locator('input').first().getAttribute('inputmode')) === 'numeric' ? '12:00' : '1');
    else if (await boxes.count() === 2) { await boxes.nth(0).fill('1N'); await boxes.nth(1).fill('1E'); }
    await card.locator('button[type=submit]').click();
    if (await card.locator('.need').count()) { await boxes.first().fill('12:00'); await card.locator('button[type=submit]').click(); }
    await card.locator('button[type=submit]').click();
  }
  await expect(page.locator('.results')).toBeVisible();
  expect(await overflow(page), 'rehearsal results').toBeLessThanOrEqual(0);
  expect(pageErrors(page)).toEqual([]);
});

test('focus after controls that disappear: class quiz Start and End, rehearsal Start and Again', async ({ page }) => {
  test.setTimeout(90_000);
  await openPage(page, 'en/class-quiz?seed=focus', '?test');
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  await expect(page.locator('#cq-prompt')).toBeFocused();
  await page.getByRole('button', { name: 'End quiz' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Class quiz' })).toBeFocused();

  await openPage(page, 'en/rehearsal', '?test');
  await page.getByRole('button', { name: /Start/ }).click();
  await expect(page.locator('form.card h2')).toBeFocused();
  for (let i = 0; i < 15; i++) {
    const card = page.locator('form.card');
    const choices = card.locator('label.choice');
    const boxes = card.getByRole('textbox');
    if (await choices.count()) await choices.first().click();
    else if (await boxes.count() === 2) { await boxes.nth(0).fill('1N'); await boxes.nth(1).fill('1E'); }
    else if (await boxes.count() === 1) await boxes.first().fill('1');
    await card.locator('button[type=submit]').click();
    if (await card.locator('.need').count()) { await boxes.first().fill('12:00'); await card.locator('button[type=submit]').click(); }
    await card.locator('button[type=submit]').click();
  }
  await page.getByRole('button', { name: 'Try another test' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Test rehearsal' })).toBeFocused();
  expect(pageErrors(page)).toEqual([]);
});

test('practice: arrow keys go through the levels without focus jumping to the question; New round focuses the question', async ({ page }) => {
  await openPage(page, 'en/topic-2/practice', '?test');
  await page.getByLabel('Easy').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Medium')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Hard')).toBeChecked();
  await expect(page.getByLabel('Hard')).toBeFocused();
  for (let i = 0; i < 10; i++) {
    const card = page.locator('form.card');
    await card.locator('label.choice').first().click();
    await card.locator('button[type=submit]').click();
    await card.locator('button[type=submit]').click();
  }
  await expect(page.getByRole('heading', { name: 'Round complete' })).toBeFocused();
  await page.getByRole('button', { name: 'New round' }).click();
  await expect(page.locator('form.card h2')).toBeFocused();
  // Moving on within the round focuses the next question as before.
  const card = page.locator('form.card');
  await card.locator('label.choice').first().click();
  await card.locator('button[type=submit]').click();
  await card.locator('button[type=submit]').click();
  await expect(page.getByText('Question 2 of 10')).toBeVisible();
  await expect(card.locator('h2')).toBeFocused();
});
