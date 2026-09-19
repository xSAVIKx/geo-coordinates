import { expect, test } from '@playwright/test';
import boxesJson from '../../src/map/data/city/boxes.json' with { type: 'json' };
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

const fit = (b: { west: number; east: number; south: number; north: number }) =>
  Math.min(360 / (b.east - b.west), 180 / (b.north - b.south));
const flat = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __mapState: { flat: { zoom: number; center: { lat: number; lon: number } } } }).__mapState.flat);
const go = (page: import('@playwright/test').Page, id: string) =>
  page.evaluate((i) => (window as unknown as { __mapState: { showCityBox(id: string): unknown } }).__mapState.showCityBox(i), id);

/*
 * The list's buttons are sorted by their *translated* name, not by the boxes.json order, so none of them is ever
 * addressed by position: a button is found by its accessible name ("Show <name> up close"), and the twelve are
 * driven through `showCityBox` directly. The list itself is addressed by `details.close-ups`, not by its title —
 * the Settings switch carries the same words, and that is deliberate (it is the same feature's name).
 */
const list = (page: import('@playwright/test').Page) => page.locator('details.close-ups');

test('each of the twelve is one click away and lands with the box filling the view', async ({ page }) => {
  test.setTimeout(180_000);
  await openPage(page, 'en/lab', '?test');
  await list(page).locator('> summary').click();
  const buttons = page.getByRole('button', { name: /up close$/ });
  await expect(buttons).toHaveCount(12);
  for (const b of boxesJson.boxes) {
    await go(page, b.id);
    const f = await flat(page);
    expect(f.zoom, b.id).toBeCloseTo(fit(b), 0);
    expect(f.center.lat, b.id).toBeCloseTo(b.lat, 2);
    expect(f.center.lon, b.id).toBeCloseTo(b.lon, 2);
    await expect(page.locator(`.view-flat g.streets[data-city-box="${b.id}"]`), b.id).toHaveCount(1);
  }
  // And really through the list, for the one the lesson is about.
  await buttons.filter({ hasText: 'Katowice' }).click();
  expect((await flat(page)).center.lat).toBeCloseTo(50.26, 2);
  expect(pageErrors(page)).toEqual([]);
});

test('the list is reachable and operable from the keyboard alone', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const summary = list(page).locator('> summary');
  await summary.focus();
  await expect(summary).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(list(page)).toHaveAttribute('open', '');
  const greenwich = page.getByRole('button', { name: 'Show Greenwich Observatory up close' });
  await greenwich.focus();
  await page.keyboard.press('Enter');
  expect((await flat(page)).center.lat).toBeCloseTo(51.4779, 2);
  // Every target in the list is at least 44 px tall (WCAG 2.2 AA). Layout height, not the painted box, so an
  // animation or a fractional device pixel can never turn 44 into 43.98.
  for (const el of [summary, greenwich]) {
    expect(await el.evaluate((n) => (n as HTMLElement).offsetHeight), await el.evaluate((n) => n.tagName)).toBeGreaterThanOrEqual(44);
  }
});

test('a button says where the map landed, and the card agrees with the readout', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await list(page).locator('> summary').click();
  const card = list(page).getByRole('button', { name: 'Show Rovaniemi — the Arctic Circle up close' });
  // Minutes, so the card cannot say 67°N while the note says the Arctic Circle is at 66°34′N.
  await expect(card).toContainText('66°33′N, 25°51′E');
  const live = page.locator('[aria-live="polite"]').first();
  await card.click();
  await expect(live).toHaveText('Showing Rovaniemi — the Arctic Circle up close', { timeout: 3000 });
  // And what the pupil now reads on the map is the same pair.
  await expect(page.locator('output').first()).toHaveText('66°33′N, 25°51′E');
});

test('the three teaching places show their note, and the others do not', async ({ page }) => {
  test.setTimeout(120_000);
  await openPage(page, 'en/lab', '?test');
  const note = page.locator('.close-up-note');
  await go(page, 'greenwich');
  await expect(note).toHaveText(/prime meridian is painted/);
  await go(page, 'mitaddelmundo');
  await expect(note).toHaveText(/equator, 0° latitude/);
  await go(page, 'rovaniemi');
  await expect(note).toHaveText(/Arctic Circle, 66°34′N/);
  await go(page, 'katowice');
  await expect(note).toHaveCount(0);
  // The credit follows the box's own source.
  await expect(page.locator('.close-up-credit')).toHaveText(/Ortofotomapa.*OpenStreetMap/);
  await go(page, 'giza');
  await expect(page.locator('.close-up-credit')).toHaveText(/Copernicus Sentinel.*OpenStreetMap/);
});

test('standing in a box, the map tells a screen reader what the box shows', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  // The paragraph the flat map's own `aria-describedby` points at (FlatMap.svelte's `{uid}-style-desc`).
  const desc = page.locator('.view-flat p[id$="-style-desc"]');
  await expect(desc).not.toHaveText(/aerial photo/);
  await go(page, 'katowice');
  await expect(desc).toHaveText(/Inside this box the map shows an aerial photo with the streets drawn over it\./);
});

test("topic 9's find step: picking a place moves the readout there, not just the map", async ({ page }) => {
  // The step's sentence promises "the readout still gives the coordinates to the minute" for the place you pick.
  await openPage(page, 'en/topic-9/explore/5', '?test');
  await list(page).locator('> summary').click();
  const card = list(page).getByRole('button', { name: 'Show Giza — the pyramids up close' });
  const pair = (await card.locator('.coords').textContent())!;
  expect(pair).toBe('29°59′N, 31°08′E');
  // The letters readout — this step shows decimals first and the letters beside them.
  const letters = page.locator('.readout.second output');
  await expect(letters).toHaveText('50°16′N, 19°01′E');
  await card.click();
  await expect(letters).toHaveText(pair);
  await expect(page.locator('.readout.decimal output')).toHaveText('29.9792, 31.1342');
});

test("topic 9's find step says so, and the list is there", async ({ page }) => {
  await openPage(page, 'en/topic-9/explore/5');
  await expect(page.getByText(/open .Places up close. under the map/)).toBeVisible();
  await expect(list(page).locator('> summary')).toBeVisible();
  await expectNoAxeViolations(page, 'topic 9 find step with close-ups');
});

test('the list and the note pass axe in the lab, standing in a teaching box', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await list(page).locator('> summary').click();
  await go(page, 'greenwich');
  await expect(page.locator('.close-up-note')).toBeVisible();
  /*
   * Run axe on the *scrolled* page, at the bottom of it, where the close-up list, the note and the credit all
   * are — not pinned back to the top, which is what this used to do.
   *
   * The pin was there because a 44 px target caught half under the sticky header is reported by axe's
   * target-size rule as obscured, and Playwright's own scroll-into-view before a click had parked the globe's
   * "Show the point" button exactly there. That is geometry, not a bug in this list, and it cannot be designed
   * away: with an obscuring band [a, b] and a target of height H, the unobscured part of the target is under
   * 24 px for a window of scroll positions (b - a) + 48 - H px wide, which for a 44 px header widget over a
   * 44 px target is 48 px however the header is laid out — see the Task 8 report for the sweep and the
   * arithmetic.
   *
   * What this run is worth, stated plainly: at the bottom of the page the map toolbars are entirely above the
   * viewport (measured: top -603), so axe returns exactly what it returns at scroll 0. It adds no coverage of
   * the obscured-target case; it is here because a defined, real scroll position is a better place to make the
   * claim than a pin back to zero, which reads as if scrolling were the problem. The case that does matter,
   * keyboard focus under the header (WCAG 2.4.11), is measured in tests/e2e/city-a11y.spec.ts.
   */
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  expect(await page.evaluate(() => window.scrollY), 'the page really is scrolled').toBeGreaterThan(0);
  await expectNoAxeViolations(page, 'lab with the close-up list open at Greenwich, scrolled to the bottom');
});

for (const lang of ['pl', 'uk'] as const) {
  test(`the list, the notes and topic 9's sentence are translated (${lang})`, async ({ page }) => {
    const title = lang === 'pl' ? 'Miejsca z bliska' : 'Місця зблизька';
    await openPage(page, `${lang}/lab`, '?test');
    await expect(list(page).locator('> summary')).toContainText(title);
    await go(page, 'greenwich');
    await expect(page.locator('.close-up-note')).toHaveText(lang === 'pl' ? /Południk zerowy/ : /Нульовий меридіан/);
    // The announcement is translated too (PL/UK put the place after a colon, as the Schools list does).
    await list(page).locator('> summary').click();
    await list(page).getByRole('button', { name: /Warszawa|Варшава/ }).click();
    await expect(page.locator('[aria-live="polite"]').first())
      .toHaveText(lang === 'pl' ? 'Pokazuję z bliska: Warszawa' : 'Показую зблизька: Варшава', { timeout: 3000 });
    await openPage(page, `${lang}/topic-9/explore/5`);
    await expect(list(page).locator('> summary')).toContainText(title);
    await expect(page.getByText(lang === 'pl' ? /odczyt nadal poda współrzędne/ : /координати точки й далі показуватимуться/)).toBeVisible();
  });
}
