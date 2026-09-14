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
  await expect(flat.locator('.school-cluster').first()).toBeVisible();
  for (const projection of ['Grid map', 'Equal Earth', 'Map app (Mercator)']) {
    await flat.getByRole('button', { name: projection, exact: true }).click();
    await expect(flat.getByRole('button', { name: projection, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => {
      const counts = (await flat.locator('.school-cluster text.count').allTextContents()).map(Number);
      return counts.reduce((a, b) => a + b, 0) + (await flat.locator('rect.school').count());
    }, { message: projection }).toBe(487);
  }
  // Count badges are drawn above city dots and continent names.
  const order = await flat.locator('svg[role="group"]').evaluate((svg) => {
    const all = [...svg.querySelectorAll('circle.place, text.map-label, .school-cluster, rect.school:not(.school-chosen)')];
    const last = (sel: string) => Math.max(...all.map((e, i) => (e.matches(sel) ? i : -1)));
    const first = (sel: string) => all.findIndex((e) => e.matches(sel));
    return { placesEnd: last('circle.place, text.map-label'), badgesStart: first('.school-cluster'), squaresEnd: last('rect.school'), placesStart: first('circle.place') };
  });
  expect(order.badgesStart).toBeGreaterThan(order.placesEnd);
  if (order.squaresEnd >= 0) expect(order.squaresEnd).toBeLessThan(order.placesStart);
  await expect(page.locator('.view-globe .school-cluster').first()).toBeVisible();
  await expect(page.locator('details.schools > summary')).toContainText('487 schools');
  await expectNoAxeViolations(page, 'schools layer on');
  expect(pageErrors(page)).toEqual([]);
});

test('lab: choosing Maple Bear Katowice in the Schools list centres the map on it and shows its name', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await page.locator('.view-flat').getByRole('button', { name: 'Maple Bear schools' }).click();
  await page.locator('details.schools > summary').click();
  await expect(page.locator('details.schools')).toContainText('This page is not affiliated with Maple Bear.');
  await page.locator('details.country > summary', { hasText: 'Poland' }).click();
  await page.getByRole('button', { name: 'Move the point to Maple Bear Katowice' }).click();
  const s = await state(page);
  expect(s.flat.center.lat).toBeCloseTo(50.2604, 2);
  expect(s.flat.center.lon).toBeCloseTo(19.0185, 2);
  expect(s.flat.zoom).toBeGreaterThanOrEqual(12);
  expect(Math.abs(s.point!.lat - 50.2604)).toBeLessThan(1 / 60);
  expect(Math.abs(s.point!.lon - 19.0185)).toBeLessThan(1 / 60);
  const flat = page.locator('.view-flat');
  await expect(flat.locator('rect.school-chosen[data-school="pl-katowice"]')).toHaveCount(1);
  await expect(flat.locator('text.school-name', { hasText: 'Maple Bear Katowice' })).toBeVisible();
  await expect(page.locator('#live-polite, [aria-live="polite"]').first()).toContainText('Showing Maple Bear Katowice on the map');
  await expect(page.locator('.view-globe text.school-name', { hasText: 'Maple Bear Katowice' })).toBeVisible();
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
    await expectNoAxeViolations(page, `schools list ${lang}`);
    expect(pageErrors(page)).toEqual([]);
  });
}

test('footer: school locations note in English', async ({ page }) => {
  await openPage(page, 'en/');
  await expect(page.locator('footer')).toContainText('School locations: Maple Bear websites (retrieved September 13, 2026), approximate. This page is not affiliated with Maple Bear.');
});

// For every school, after choosing it: its square and its whole name are drawn inside the map (the
// globe's square view), and the name's real bounding box touches no count badge.
for (const [w, h, views] of [[1366, 768, ['.view-flat', '.view-globe']], [375, 667, ['.view-flat']]] as const) {
  test(`every one of the 487 schools, once chosen, is drawn alone with its whole name visible (${w} px: ${views.join(', ')})`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: w, height: h });
    await openPage(page, 'en/lab', '?test');
    const result = await page.evaluate(async (selectors) => {
      const s = (window as unknown as { __mapState: { chooseSchool(id: string): { id: string; name: string } | null } }).__mapState;
      const ids = (window as unknown as { __schoolIds: string[] }).__schoolIds;
      const frame = () => new Promise((r) => requestAnimationFrame(() => r(null)));
      const out: string[] = [];
      const within = (a: DOMRect, b: DOMRect) => a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5;
      const cross = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      let wrapped = 0;
      for (const id of ids) {
        const school = s.chooseSchool(id)!;
        await frame();
        for (const sel of selectors) {
          const svg = document.querySelector(`${sel} svg[role="group"]`)!;
          const map = svg.getBoundingClientRect();
          const square = svg.querySelector(`rect.school-chosen[data-school="${id}"]`);
          const name = svg.querySelector<SVGTextElement>(`text.school-name.chosen[data-school="${id}"]`);
          if (!square || !name) { out.push(`${sel} ${id}: missing`); continue; }
          if (name.textContent !== school.name) out.push(`${sel} ${id}: text "${name.textContent}"`);
          if (name.querySelectorAll('tspan').length > 1) wrapped++;
          const nb = name.getBoundingClientRect();
          if (!within(square.getBoundingClientRect(), map)) out.push(`${sel} ${id}: square outside`);
          if (!within(nb, map)) out.push(`${sel} ${id}: name outside ${JSON.stringify([nb.left - map.left, nb.right - map.right, nb.top - map.top, nb.bottom - map.bottom].map(Math.round))}`);
          for (const badge of svg.querySelectorAll('rect.school-badge')) {
            if (cross(nb, badge.getBoundingClientRect())) { out.push(`${sel} ${id}: name under a badge`); break; }
          }
          if (svg.querySelectorAll(`[data-school="${id}"]`).length !== 2) out.push(`${sel} ${id}: drawn more than once`);
        }
      }
      return { count: ids.length, wrapped, out };
    }, [...views]);
    expect(result.out).toEqual([]);
    expect(result.count).toBe(487);
    console.log(`${w}px: ${result.wrapped} of ${487 * views.length} names wrapped`);
    expect(pageErrors(page)).toEqual([]);
  });
}

for (const [country, name] of [['Singapore', 'MapleBear Adam'], ['India', 'Maple Bear Canadian Pre-school, Jakkur, Bengaluru'], ['Brazil', 'Maple Bear São Paulo - Alphaville']] as const) {
  test(`list: ${name} (${country}) shows alone and named on the flat map and the globe`, async ({ page }) => {
    await openPage(page, 'en/lab', '?test');
    await page.locator('.view-flat').getByRole('button', { name: 'Maple Bear schools' }).click();
    await page.locator('details.schools > summary').click();
    await page.locator('details.country > summary', { hasText: new RegExp(`^${country}`) }).click();
    const button = page.locator('details.country[open] button', { hasText: name }).first();
    const label = (await button.textContent())!.trim();
    await button.click();
    for (const view of ['.view-flat', '.view-globe']) {
      await expect(page.locator(`${view} rect.school-chosen`)).toHaveCount(1);
      await expect(page.locator(`${view} text.school-name.chosen`)).toHaveText(label);
    }
    expect(pageErrors(page)).toEqual([]);
  });
}

test('a badge that zooming cannot pull apart lists its schools; Escape and a press outside close the list', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await page.locator('.view-flat').getByRole('button', { name: 'Maple Bear schools' }).click();
  // Bengaluru's city-level entries share one spot, and the map is as close as it goes.
  await page.evaluate(() => (window as unknown as { __mapState: { setFlatView(c: unknown, z: number): void } }).__mapState.setFlatView({ lat: 12.9716, lon: 77.5946 }, 80));
  const flat = page.locator('.view-flat');
  const badges = flat.locator('.school-cluster');
  const counts = (await badges.locator('text.count').allTextContents()).map(Number);
  const badge = badges.nth(counts.indexOf(Math.max(...counts))).locator('rect.school-badge');
  const zoomBefore = (await state(page)).flat.zoom;
  const open = async () => {
    const b = (await badge.boundingBox())!;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  };
  await open();
  const dialog = flat.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(`${Math.max(...counts)} schools`);
  await expect(dialog.locator('button.pick').first()).toBeFocused();
  expect((await state(page)).flat.zoom).toBe(zoomBefore);
  await expectNoAxeViolations(page, 'badge list open');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(flat.locator('svg[role="group"]')).toBeFocused();
  await open();
  await expect(dialog).toBeVisible();
  await page.locator('h1').click();
  await expect(dialog).toHaveCount(0);
  await open();
  const pick = dialog.locator('button.pick').nth(1);
  const name = (await pick.textContent())!.trim();
  await pick.click();
  await expect(dialog).toHaveCount(0);
  await expect(flat.locator('text.school-name.chosen')).toHaveText(name);
  await expect(badges.locator('text.count', { hasText: new RegExp(`^${Math.max(...counts) - 1}$`) })).toHaveCount(1);
  expect(pageErrors(page)).toEqual([]);
});

test('badge list: focus leaving it or Escape anywhere closes it; near the bottom of the map it opens above the press', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await page.locator('.view-flat').getByRole('button', { name: 'Maple Bear schools' }).click();
  // Bengaluru low in the view, at the deepest zoom: its badge sits near the map's bottom edge.
  await page.evaluate(() => (window as unknown as { __mapState: { setFlatView(c: unknown, z: number): void } }).__mapState.setFlatView({ lat: 13.9, lon: 77.5946 }, 80));
  const flat = page.locator('.view-flat');
  const badges = flat.locator('.school-cluster');
  const counts = (await badges.locator('text.count').allTextContents()).map(Number);
  const badge = badges.nth(counts.indexOf(Math.max(...counts))).locator('rect.school-badge');
  const dialog = flat.getByRole('dialog');
  const open = async () => {
    const b = (await badge.boundingBox())!;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await expect(dialog.locator('button.pick').first()).toBeFocused();
    return b.y + b.height / 2;
  };
  const pressY = await open();
  const box = (await dialog.boundingBox())!;
  const toolbar = (await flat.locator('.toolbar').boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(pressY);
  expect(box.y + box.height).toBeLessThanOrEqual(toolbar.y);
  expect(box.y).toBeGreaterThanOrEqual((await page.locator('header').boundingBox())!.height);
  // Focus leaving the list closes it: back past its close button.
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Close the list' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog).toHaveCount(0);
  // Escape closes it wherever focus is inside (here the dialog itself, after a click on its title).
  await open();
  await dialog.locator('.title').click();
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(pageErrors(page)).toEqual([]);
});

test('badge pointer targets never overlap each other or the chosen school', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await page.evaluate(() => (window as unknown as { __mapState: { chooseSchool(id: string): unknown } }).__mapState.chooseSchool('br-sao-paulo-alphaville'));
  for (const view of ['.view-flat', '.view-globe']) {
    const overlapsFound = await page.locator(`${view} svg[role="group"]`).evaluate((svg) => {
      const boxes = [...svg.querySelectorAll('rect.hit')].map((r) => r.getBoundingClientRect());
      const chosen = svg.querySelector('rect.school-chosen')!.getBoundingClientRect();
      const cross = (a: DOMRect, b: DOMRect) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
      const out: string[] = [];
      boxes.forEach((a, i) => {
        if (a.height < 23.5 || a.width < 23.5) out.push(`${i} smaller than 24 px`);
        if (cross(a, chosen)) out.push(`${i} covers the chosen school`);
        boxes.forEach((b, j) => { if (j > i && cross(a, b)) out.push(`${i} and ${j}`); });
      });
      return { count: boxes.length, out };
    });
    expect(overlapsFound.count).toBeGreaterThan(3);
    expect(overlapsFound.out, view).toEqual([]);
  }
});

test('no schools switch on a practice question or in the class quiz', async ({ page }) => {
  await openPage(page, 'en/topic-3/practice', '?test');
  await expect(page.locator('svg[role="group"]').first()).toBeVisible();
  await expect(page.locator('.schools-toggle')).toHaveCount(0);
  await openPage(page, 'en/class-quiz?seed=5b');
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  await expect(page.locator('#cq-prompt')).toBeVisible();
  await expect(page.locator('svg[role="group"]').first()).toBeVisible();
  await expect(page.locator('.schools-toggle')).toHaveCount(0);
  expect(pageErrors(page)).toEqual([]);
});
