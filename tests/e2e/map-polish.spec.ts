import { expect, test } from '@playwright/test';
import { openPage, pageErrors } from './helpers';

// Map polish from the final design, UX and accessibility round (Task D3).

type Box = { left: number; right: number; top: number; bottom: number };
const touches = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

test('a chosen school: the point guide that would run under its name is left out, the other stays', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const flat = page.locator('.view-flat svg[role="group"]');
  const check = async (id: string) => {
    await page.evaluate((id) => (window as unknown as { __mapState: { chooseSchool(id: string): unknown } }).__mapState.chooseSchool(id), id);
    const name = flat.locator('text.school-name.chosen');
    await expect(name).toBeVisible();
    const nb = await name.evaluate((e) => e.getBoundingClientRect().toJSON() as Box);
    const guides = await flat.locator('path.guide').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as Box));
    expect(guides.some((g) => touches(g, nb)), `${id}: a guide under the name`).toBe(false);
    return guides.length;
  };
  // This school's name sits beside it, across the parallel through the point: only the meridian's guide is drawn.
  expect(await check('bg-sofia-elementary-school-campus-boyana')).toBe(1);
  // Katowice's name sits clear of both lines: both guides stay.
  expect(await check('pl-katowice')).toBe(2);
  expect(pageErrors(page)).toEqual([]);
});

test('lab with the schools on (presenter, 1920): count badges never cover a line name or the noon label', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openPage(page, 'en/lab', '?test');
  await page.locator('body').press('p');
  await expect(page.locator('html')).toHaveAttribute('data-presenter', 'true');
  await page.evaluate(() => {
    const s = (window as unknown as { __mapState: { layers: { schools: boolean }; sun: object } }).__mapState;
    s.layers.schools = true;
    s.sun = { ...s.sun, utcMinutes: 630, dayOfYear: 172 };
  });
  for (const view of ['.view-flat', '.view-globe']) {
    const svg = page.locator(`${view} svg`).first();
    await expect(svg.locator('.school-cluster').first()).toBeVisible();
    const r = await svg.evaluate((s) => {
      const box = (e: Element) => e.getBoundingClientRect().toJSON();
      return {
        names: [...s.querySelectorAll('text')].filter((t) => t.classList.contains('label') || /Noon/.test(t.textContent ?? '')).map((t) => ({ text: t.textContent, b: box(t) })),
        badges: [...s.querySelectorAll('.school-cluster .school-badge')].map(box),
      };
    });
    // Estimated text boxes allow a few px of overlap at the ends; a badge right on a name covers far more.
    const shrink = (b: Box, d: number) => ({ left: b.left + d, right: b.right - d, top: b.top + d, bottom: b.bottom - d });
    const covered = r.names.filter((n) => r.badges.some((b) => touches(shrink(n.b as Box, 6), b as Box))).map((n) => n.text);
    expect(covered, view).toEqual([]);
  }
});

test('lab: zoomed in, a point on minutes; zoomed out again it moves to whole degrees with the readout', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const readout = page.locator('output').first();
  const flat = page.getByRole('group', { name: 'World map with parallels and meridians' });
  await page.evaluate(() => { (window as unknown as { __mapState: { flat: unknown } }).__mapState.flat = { center: { lat: 50.26, lon: 19.02 }, zoom: 20 }; });
  await flat.focus();
  await page.keyboard.press('ArrowRight');
  await expect(readout).toHaveText('50°00′N, 19°01′E');
  for (let i = 0; i < 3; i++) await page.keyboard.press('-');
  await expect(readout).toHaveText('50°N, 19°E');
  expect(await page.evaluate(() => (window as unknown as { __mapState: { point: object } }).__mapState.point)).toEqual({ lat: 50, lon: 19 });
  await page.keyboard.press('ArrowUp');
  await expect(readout).toHaveText('51°N, 19°E');
});
