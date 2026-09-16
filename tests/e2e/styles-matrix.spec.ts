import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors, setMapStyle, waitForTexture } from './helpers';

const STYLES = ['atlas', 'physical', 'satellite', 'political'] as const;
const ROUTES = ['en/lab', 'pl/topic-1/explore/9', 'uk/topic-3/practice', 'en/topic-10/explore/7', 'pl/topic-9/explore/8'] as const;

async function prepare(page: Page, style: (typeof STYLES)[number], scheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: scheme });
  await page.addInitScript((s) => localStorage.setItem('geo-coords:map-style', s), style);
}

for (const style of STYLES) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`WCAG AA on every map route: ${style}, ${scheme}`, async ({ page }) => {
      test.setTimeout(120_000);
      await prepare(page, style, scheme);
      for (const hash of ROUTES) {
        await openPage(page, hash, '?test');
        if (style === 'physical' || style === 'satellite') await waitForTexture(page, (await page.locator('.view-flat').count()) ? 'flat' : 'globe');
        await expect(page.locator('.frame').first()).toHaveAttribute('data-map-style', style);
        await expectNoAxeViolations(page, `${hash} ${style} ${scheme}`);
      }
      expect(pageErrors(page)).toEqual([]);
    });
  }

  test(`AAA in presenter mode: ${style}`, async ({ page }) => {
    await prepare(page, style, 'light');
    await openPage(page, 'en/lab', '?test');
    if (style === 'physical' || style === 'satellite') await waitForTexture(page, 'flat');
    await page.locator('body').press('p');
    await expect(page.locator('html')).toHaveAttribute('data-presenter', 'true');
    const r = await new AxeBuilder({ page }).withRules(['color-contrast-enhanced']).analyze();
    expect(r.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([]);
  });

  test(`class quiz run in ${style}: the map, the answer and the controls fit, axe clean`, async ({ page }) => {
    await openPage(page, 'en/class-quiz', '?test');
    await page.getByRole('group', { name: 'Map style for the class' }).getByRole('radio', { name: new RegExp(`^${style[0]!.toUpperCase()}${style.slice(1)}$`) }).check();
    await page.getByRole('button', { name: 'Start the quiz' }).click();
    await page.locator('body').press('Space');
    await expect(page.getByText(/^Answer:/)).toBeVisible();
    await expectNoAxeViolations(page, `class quiz ${style}`);
  });
}

for (const width of [320, 375, 480, 768, 1024, 1366]) {
  test(`no horizontal scroll at ${width} px in every style`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 800 });
    for (const style of STYLES) {
      await page.addInitScript((s) => localStorage.setItem('geo-coords:map-style', s), style);
      for (const hash of ['uk/lab', 'pl/topic-10/explore/6', 'en/topic-3/practice']) {
        await openPage(page, hash);
        expect(await page.evaluate(() => document.documentElement.scrollWidth), `${hash} ${style} ${width}`).toBeLessThanOrEqual(width);
      }
    }
  });
}

/*
 * Spec §3 "Readability": a name a style writes must not be written through another name. Boxes that merely graze are
 * allowed (a 1–2 px touch of two halos is invisible), and only the names these styles add are judged — the Atlas
 * layout, which "Noon 12:00" already crosses on a zoomed-in world map, is not this work's to change.
 */
test('the country and physical names are never written through another name', async ({ page }) => {
  test.setTimeout(120_000);
  for (const style of ['physical', 'political'] as const) {
    for (const [lat, lon, zoom] of [[0, 0, 1], [0, 20, 3], [50.5, 19, 7], [43, 20, 8], [50, 14, 10]] as const) {
      await openPage(page, 'en/lab', '?test');
      await setMapStyle(page, style);
      if (style === 'physical') await waitForTexture(page, 'flat');
      await page.evaluate(([la, lo, z]) => (window as unknown as { __mapState: { setFlatView(c: { lat: number; lon: number }, z: number): void } }).__mapState.setFlatView({ lat: la, lon: lo }, z), [lat, lon, zoom] as const);
      await page.waitForTimeout(400);
      const clashes = await page.evaluate(() => {
        const out: string[] = [];
        for (const view of ['.view-flat', '.view-globe']) {
          const root = document.querySelector(`${view} .frame > svg`);
          if (!root) continue;
          const boxes = [...root.querySelectorAll('text')]
            .filter((t) => (t.textContent ?? '').trim() && t.getClientRects().length)
            .map((t) => ({ text: (t.textContent ?? '').trim(), own: /country-name|physical-name/.test(t.getAttribute('class') ?? ''), r: t.getBoundingClientRect() }));
          for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
            const a = boxes[i]!, b = boxes[j]!;
            if (!a.own && !b.own) continue;
            const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
            const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
            if (ox > 2 && oy > 2) out.push(`${view} "${a.text}" × "${b.text}" (${Math.round(ox)}×${Math.round(oy)} px)`);
          }
        }
        return out;
      });
      expect(clashes, `${style} at ${lat},${lon} zoom ${zoom}`).toEqual([]);
    }
  }
});

// The compact panel is `position: fixed`, so anything below the fold cannot be scrolled to — by mouse or by keyboard.
test('the compact style menu opens fully on screen on a phone, in both views', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openPage(page, 'en/lab');
  for (const view of ['Map', 'Globe']) {
    await page.getByRole('group', { name: 'Choose view' }).getByRole('button', { name: view }).click();
    await page.getByRole('button', { name: /^Map style:/ }).click();
    const panel = page.getByRole('group', { name: 'Map style' });
    const box = (await panel.boundingBox())!;
    expect(box.y, `${view}: panel top`).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height, `${view}: panel bottom`).toBeLessThanOrEqual(667);
    expect(box.x, `${view}: panel left`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${view}: panel right`).toBeLessThanOrEqual(375);
    for (const style of ['Atlas', 'Physical', 'Satellite', 'Political']) {
      const b = (await panel.getByRole('button', { name: style }).boundingBox())!;
      expect(b.y + b.height, `${view}: ${style} is on screen`).toBeLessThanOrEqual(667);
    }
    await page.keyboard.press('Escape');
  }
});

test('touch targets of the new controls are at least 44 × 44 px on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await openPage(page, 'en/lab');
  await page.getByRole('button', { name: 'Seasons mode' }).click();
  const targets = page.locator('.style-menu, .real-sun .btn, .seasons-toggle, .view-flat .toolbar .btn');
  for (const box of await targets.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.width, r.height, e.textContent?.trim()]; }))) {
    expect(Math.min(box[0] as number, box[1] as number), String(box[2])).toBeGreaterThanOrEqual(44);
  }
});
