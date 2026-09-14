import { expect, test } from '@playwright/test';
import { openPage } from './helpers';

test('map text is drawn above the noon meridian and the point guides', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const order = await page.locator('.view-flat svg[role="group"]').evaluate((svg) => {
    const all = [...svg.querySelectorAll('path.guide, path.noon, text.map-label, text.place-name, text.label')];
    const idx = (sel: string) => all.flatMap((e, i) => (e.matches(sel) ? [i] : []));
    return { lines: idx('path.guide, path.noon'), names: idx('text.map-label, text.place-name, text.label') };
  });
  expect(order.lines.length).toBeGreaterThan(0);
  expect(order.names.length).toBeGreaterThan(0);
  expect(Math.min(...order.names)).toBeGreaterThan(Math.max(...order.lines));
});

test('a phone map draws the dots of unnamed places small and soft (.minor), every other dot has its name', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openPage(page, 'en/lab', '?test');
  await page.evaluate(() => (window as unknown as { __mapState: { setFlatPreset(p: string): void } }).__mapState.setFlatPreset('poland'));
  const map = page.locator('.view-flat svg[role="group"]');
  await expect(map.locator('text.place-name').first()).toBeVisible();
  const counts = await map.evaluate((svg) => ({
    minor: svg.querySelectorAll('circle.place.minor').length,
    named: svg.querySelectorAll('circle.place:not(.minor)').length,
    names: svg.querySelectorAll('text.place-name').length,
    minorRadius: Math.max(...[...svg.querySelectorAll('circle.place.minor')].map((c) => Number(c.getAttribute('r')))),
    namedRadius: Math.min(...[...svg.querySelectorAll('circle.place:not(.minor)')].map((c) => Number(c.getAttribute('r')))),
  }));
  expect(counts.minor).toBeGreaterThan(0);
  expect(counts.named).toBe(counts.names);
  expect(counts.minorRadius).toBeLessThan(counts.namedRadius);
});
