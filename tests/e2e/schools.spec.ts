import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

type State = { flat: { zoom: number; center: { lat: number; lon: number } }; point: { lat: number; lon: number } | null; layers: { schools: boolean }; globeZoom: number };
const state = (page: Page) => page.evaluate(() => {
  const s = (window as unknown as { __mapState: State }).__mapState;
  return { flat: { zoom: s.flat.zoom, center: { ...s.flat.center } }, point: s.point && { ...s.point }, schools: s.layers.schools, globeZoom: s.globeZoom };
});

test('lab: the Maple Bear schools layer starts off; the switch shows count badges on both maps', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const flat = page.locator('.view-flat');
  const toggle = flat.getByRole('button', { name: 'Maple Bear schools' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.schools-toggle')).toHaveCount(2);
  await expect(page.locator('.school-cluster, rect.school')).toHaveCount(0);
  await expect(page.locator('details.schools')).toHaveCount(0);

  await toggle.click();
  await expect(page.locator('.schools-toggle[aria-pressed="true"]')).toHaveCount(2);
  const badges = flat.locator('.school-cluster');
  await expect(badges.first()).toBeVisible();
  const counts = (await flat.locator('.school-cluster text.count').allTextContents()).map(Number);
  const singles = await flat.locator('rect.school').count();
  expect(counts.reduce((a, b) => a + b, 0) + singles).toBe(487);
  await expect(page.locator('.view-globe .school-cluster').first()).toBeVisible();
  await expect(page.locator('details.schools > summary')).toContainText('487 schools');
  await expectNoAxeViolations(page, 'schools layer on');
  expect(pageErrors(page)).toEqual([]);
});

test('lab: choosing Maple Bear Katowice in the Schools list centres the map on it and shows its name', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await page.locator('.view-flat').getByRole('button', { name: 'Maple Bear schools' }).click();
  await page.locator('details.schools > summary').click();
  await expect(page.locator('details.schools')).toContainText('not connected with Maple Bear');
  await page.locator('details.country > summary', { hasText: 'Poland' }).click();
  await page.getByRole('button', { name: 'Move the point to Maple Bear Katowice' }).click();
  const s = await state(page);
  expect(s.flat.center.lat).toBeCloseTo(50.2604, 2);
  expect(s.flat.center.lon).toBeCloseTo(19.0185, 2);
  expect(s.flat.zoom).toBeGreaterThanOrEqual(12);
  expect(Math.abs(s.point!.lat - 50.2604)).toBeLessThan(1 / 60);
  expect(Math.abs(s.point!.lon - 19.0185)).toBeLessThan(1 / 60);
  const flat = page.locator('.view-flat');
  await expect(flat.locator('rect.school[data-school="pl-katowice"]')).toHaveCount(1);
  await expect(flat.locator('text.school-name', { hasText: 'Maple Bear Katowice' })).toBeVisible();
  await expect(page.locator('.view-globe text.school-name', { hasText: 'Maple Bear Katowice' })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0)); // see the list test below: nothing under the sticky header
  await expectNoAxeViolations(page, 'schools list open');
  expect(pageErrors(page)).toEqual([]);
});

test('lab: a click on a count badge zooms in on its group without moving the point', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await page.locator('.view-flat').getByRole('button', { name: 'Maple Bear schools' }).click();
  const before = await state(page);
  const badges = page.locator('.view-flat .school-cluster');
  const texts = (await badges.locator('text.count').allTextContents()).map(Number);
  const biggest = badges.nth(texts.indexOf(Math.max(...texts)));
  const b = (await biggest.locator('rect.school-badge').boundingBox())!;
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  const after = await state(page);
  expect(after.flat.zoom).toBeGreaterThanOrEqual(before.flat.zoom * 2);
  expect(after.flat.center.lat).toBeLessThan(0); // the biggest group is in Brazil
  expect(after.point).toEqual(before.point);
  expect(pageErrors(page)).toEqual([]);
});

test('lab: dragging the flat map slides the schools with it, then draws them where the map went', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await page.locator('.view-flat').getByRole('button', { name: 'Maple Bear schools' }).click();
  await page.evaluate(() => (window as unknown as { __mapState: { setFlatView(c: unknown, z: number): void } }).__mapState.setFlatView({ lat: 50.5, lon: 19 }, 30));
  const map = page.locator('.view-flat svg[role="group"]');
  const katowice = map.locator('rect.school[data-school="pl-katowice"]');
  const start = (await katowice.boundingBox())!;
  const x0 = await katowice.getAttribute('x');
  const box = (await map.boundingBox())!;
  const x = box.x + box.width * 0.2, y = box.y + box.height * 0.8;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 80, y - 40, { steps: 6 });
  await expect(map.locator('g.geo')).toHaveAttribute('transform', /^translate\(/);
  // Mid-drag the school is not redrawn, just moved along with the map.
  expect(await katowice.getAttribute('x')).toBe(x0);
  const mid = (await katowice.boundingBox())!;
  expect(mid.x - start.x).toBeCloseTo(80, 0);
  expect(mid.y - start.y).toBeCloseTo(-40, 0);
  await page.mouse.up();
  await expect(map.locator('g.geo')).not.toHaveAttribute('transform', /.+/);
  const end = (await katowice.boundingBox())!;
  expect(end.x - start.x).toBeCloseTo(80, 0);
  expect(end.y - start.y).toBeCloseTo(-40, 0);
  expect(pageErrors(page)).toEqual([]);
});

test('topic 9: only the last step offers the schools switch, off at first; other pages do not', async ({ page }) => {
  await openPage(page, 'en/topic-9/explore/8', '?test');
  const toggle = page.locator('.view-flat').getByRole('button', { name: 'Maple Bear schools' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect((await state(page)).schools).toBe(false);
  await toggle.click();
  await expect(page.locator('.view-flat .school-cluster').first()).toBeVisible();
  await expectNoAxeViolations(page, 'topic 9 schools');
  await page.getByRole('button', { name: /Previous/ }).click();
  await expect(page.locator('.schools-toggle')).toHaveCount(0);
  await expect(page.locator('.school-cluster')).toHaveCount(0);
  await page.goto(page.url().replace(/#.*/, '#en/topic-1/explore/1'));
  await expect(page.locator('svg[role="group"]').first()).toBeVisible();
  await expect(page.locator('.schools-toggle')).toHaveCount(0);
  expect(pageErrors(page)).toEqual([]);
});

for (const [lang, n] of [['pl', { toggle: 'Szkoły Maple Bear', country: 'Polska', total: '487 szkół', three: '3 szkoły', footer: /Położenie szkół: strony Maple Bear \(stan z 13 września 2026\), przybliżone/ }], ['uk', { toggle: 'Школи Maple Bear', country: 'Польща', total: '487 шкіл', three: '3 школи', footer: /Розташування шкіл: сайти Maple Bear \(станом на 13 вересня 2026/ }]] as const) {
  test(`schools list (${lang}): country names and counts in the page language, footer note`, async ({ page }) => {
    await openPage(page, `${lang}/lab`, '?test');
    await expect(page.locator('footer')).toContainText(n.footer);
    await page.locator('.view-flat').getByRole('button', { name: n.toggle }).click();
    await expect(page.locator('details.schools > summary')).toContainText(n.total);
    await page.locator('details.schools > summary').click();
    const poland = page.locator('details.country > summary', { hasText: n.country });
    await expect(poland).toContainText(n.three);
    await poland.click();
    await expect(page.locator('details.country[open] button')).toHaveCount(3);
    // Opening the list scrolls the page; axe counts a toolbar button under the sticky header as too small.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectNoAxeViolations(page, `schools list ${lang}`);
    expect(pageErrors(page)).toEqual([]);
  });
}

test('footer: school locations note in English', async ({ page }) => {
  await openPage(page, 'en/');
  await expect(page.locator('footer')).toContainText('School locations: Maple Bear websites (retrieved September 13, 2026), approximate');
});
