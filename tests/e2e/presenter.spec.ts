import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openPage, pageErrors } from './helpers';

const rootPx = (page: Page) => page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));

/** Rendered size (CSS px) of the smallest and the line-name map text in the flat maps and globes. */
const mapText = (page: Page) => page.evaluate(() => {
  const sizes = [...document.querySelectorAll<SVGTextElement>('.frame svg text[font-size]')].map((t) => {
    const m = t.ownerSVGElement?.getScreenCTM();
    return m ? parseFloat(t.getAttribute('font-size')!) * m.a : 0;
  }).filter((s) => s > 0);
  const lines = [...document.querySelectorAll<SVGTextElement>('.frame svg text.label[font-size]')].map((t) => parseFloat(t.getAttribute('font-size')!) * t.ownerSVGElement!.getScreenCTM()!.a);
  return { min: Math.min(...sizes), line: Math.max(0, ...lines) };
});

async function enhancedContrast(page: Page): Promise<string[]> {
  await expect(page.locator('html')).toHaveAttribute('data-presenter', 'true');
  const results = await new AxeBuilder({ page }).withRules(['color-contrast-enhanced']).analyze();
  return results.violations.flatMap((v) => v.nodes.map((n) => `${n.target.join(' ')}: ${n.any.map((a) => a.message).join('; ')}`));
}

const press = (page: Page, key: string) => page.locator('body').press(key);

/**
 * axe does not measure SVG text, so map text inks are checked here: each presenter map-text token against the
 * label halo and the bare ocean and land fills (the halo is what the text sits on; the fills are the worst case
 * where a halo gap lets them show through).
 */
const mapInkContrast = (page: Page) => page.evaluate(() => {
  const style = getComputedStyle(document.documentElement);
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true })!;
  const rgb = (c: string) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); return [...cx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
  const lum = (c: string) => { const [r, g, b] = rgb(c).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
  const ratio = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi! + 0.05) / (lo! + 0.05); };
  const tok = (n: string) => style.getPropertyValue(n).trim();
  const inks = ['--text', '--map-label', '--ocean-label', '--equator-text', '--prime-text', '--antimeridian-text', '--tropics-text', '--river-label', '--school-text', '--marker-c'];
  const out: Record<string, number> = {};
  for (const ink of inks) for (const ground of ['--halo', '--ocean', '--land']) {
    if (ink === '--ocean-label' && ground === '--land') continue; // ocean names never sit on land
    out[`${ink} on ${ground}`] = Math.round(ratio(tok(ink), tok(ground)) * 100) / 100;
  }
  return out;
});

for (const scheme of ['light', 'dark'] as const) {
  test(`presenter mode (${scheme}): bigger type and map text, no footer, AAA contrast on the main screens`, async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.emulateMedia({ colorScheme: scheme });
    await openPage(page, 'en/topic-1/explore/4');
    const before = await rootPx(page);
    const mapBefore = await mapText(page);
    await expect(page.getByRole('contentinfo')).toBeVisible();

    await press(page, 'p');
    await expect(page.locator('html')).toHaveAttribute('data-presenter', 'true');
    await expect(page.getByRole('button', { name: 'Presenter mode' })).toHaveAttribute('aria-pressed', 'true');
    expect(await rootPx(page)).toBeGreaterThan(before * 1.4);
    await expect.poll(async () => (await mapText(page)).line).toBeGreaterThan(mapBefore.line * 1.4);
    await expect(page.getByRole('contentinfo')).toHaveCount(0);
    expect(await enhancedContrast(page), 'topic 1 step 4').toEqual([]);
    const inks = await mapInkContrast(page);
    expect(Object.entries(inks).filter(([, r]) => r < 7), JSON.stringify(inks)).toEqual([]);

    // ← → still walk the steps while presenting.
    await press(page, 'ArrowRight');
    await expect(page).toHaveURL(/topic-1\/explore\/5$/);

    await page.goto(page.url().replace(/#.*/, '#en/topic-6/explore/5'));
    await expect(page.locator('.diff .total')).toBeVisible();
    expect(await enhancedContrast(page), 'topic 6 step 5').toEqual([]);

    await page.goto(page.url().replace(/#.*/, '#en/lab'));
    await page.getByRole('button', { name: 'Maple Bear schools' }).first().click();
    await expect(page.locator('.school-badge').first()).toBeVisible();
    expect(await enhancedContrast(page), 'lab with schools').toEqual([]);

    await page.goto(page.url().replace(/#.*/, '#en/class-quiz?seed=5b'));
    await page.getByRole('button', { name: 'Start the quiz' }).click();
    await press(page, 'Space');
    await expect(page.getByText(/^Answer:/)).toBeVisible();
    await page.waitForTimeout(600); // let the reveal animation settle before measuring colours
    expect(await enhancedContrast(page), 'class quiz revealed').toEqual([]);

    expect(pageErrors(page)).toEqual([]);
  });
}

test('presenter mode on a 3840px screen: headline and map labels readable from the back', async ({ page }) => {
  await page.setViewportSize({ width: 3840, height: 2160 });
  await openPage(page, 'en/topic-1/explore/4');
  await press(page, 'p');
  await expect(page.locator('html')).toHaveAttribute('data-presenter', 'true');
  const h1 = await page.locator('h1').evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(h1).toBeGreaterThanOrEqual(60);
  await expect.poll(async () => (await mapText(page)).min).toBeGreaterThanOrEqual(24);
  // Map lines get thicker with the same factor.
  const stroke = await page.locator('path.equator').first().evaluate((el) => parseFloat(getComputedStyle(el).strokeWidth));
  expect(stroke).toBeGreaterThanOrEqual(3 * 2.5);

  // The skip link stays off screen until focused, then shows.
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to main content' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
});

test('pointer highlight follows the pointer, only while presenting, and never takes clicks', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openPage(page, 'en/topic-1/explore/4');
  await press(page, 'l');
  await expect(page.locator('.laser')).toHaveCount(0);
  await press(page, 'p');
  await press(page, 'l');
  await page.mouse.move(700, 420);
  const laser = page.locator('.laser');
  await expect(laser).toBeVisible();
  await expect(laser).toHaveAttribute('aria-hidden', 'true');
  expect(await laser.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none');
  const box = (await laser.boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - 700)).toBeLessThan(2);
  expect(Math.abs(box.y + box.height / 2 - 420)).toBeLessThan(2);
  await expect(page.getByRole('button', { name: 'Pointer highlight' })).toHaveAttribute('aria-pressed', 'true');
  // Leaving presenter mode also puts the pointer away.
  await press(page, 'p');
  await expect(page.locator('html')).toHaveAttribute('data-presenter', 'false');
  await expect(laser).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pointer highlight' })).toHaveCount(0);
});

test('P and L are ignored while typing, in sliders and in the Settings dialog', async ({ page }) => {
  await openPage(page, 'en/class-quiz');
  const seed = page.getByLabel(/Quiz code/);
  await seed.fill('');
  await seed.press('p');
  await expect(seed).toHaveValue('p');
  await expect(page.locator('html')).toHaveAttribute('data-presenter', 'false');

  await openPage(page, 'en/topic-1/explore/4');
  await page.getByRole('slider').first().focus();
  await page.keyboard.press('p');
  await expect(page.locator('html')).toHaveAttribute('data-presenter', 'false');

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('dialog').getByRole('checkbox').first().focus();
  await page.keyboard.press('p');
  await expect(page.locator('html')).toHaveAttribute('data-presenter', 'false');
});

test('Esc leaves presenter mode first; the class quiz ends only on a second Esc', async ({ page }) => {
  await openPage(page, 'en/class-quiz?seed=5b');
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  await press(page, 'p');
  await expect(page.locator('html')).toHaveAttribute('data-presenter', 'true');
  await press(page, 'Escape');
  await expect(page.locator('html')).toHaveAttribute('data-presenter', 'false');
  await expect(page.locator('#cq-prompt')).toBeVisible();
  await press(page, 'Escape');
  await expect(page.getByRole('button', { name: 'Start the quiz' })).toBeVisible();
});

test('the Ukrainian page names the presenter keys and a Cyrillic layout still reaches them', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openPage(page, 'uk/topic-1/explore/4');
  // «з» is what a Ukrainian layout types on the P key.
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'з', code: 'KeyP', bubbles: true })));
  await expect(page.locator('html')).toHaveAttribute('data-presenter', 'true');
  await expect(page.getByText('P: режим презентації · L: указка · Esc: вийти з режиму презентації')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Режим презентації' })).toHaveAttribute('aria-pressed', 'true');
});

test('presenter mode on a phone and a tablet keeps the page within the screen, with a way out', async ({ page }) => {
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 700 });
    await openPage(page, 'uk/topic-2/explore/2');
    await press(page, 'p');
    await expect(page.locator('html')).toHaveAttribute('data-presenter', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${width}px`).toBeLessThanOrEqual(width);
    await expect(page.getByRole('button', { name: 'Режим презентації' })).toBeVisible();
    await page.getByRole('button', { name: 'Режим презентації' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-presenter', 'false');
  }
});

/**
 * A stand-in Fullscreen API the test controls: whether a request is refused, how long requests take, and whether the
 * user leaves fullscreen (Esc, the browser's own UI) the moment it is granted — before our request has settled.
 */
async function fakeFullscreen(page: Page, opts: { refuse?: boolean; delay?: number; exitRightAfterGrant?: boolean }) {
  await page.addInitScript((o) => {
    let el: Element | null = null;
    const change = () => document.dispatchEvent(new Event('fullscreenchange'));
    Object.defineProperty(Document.prototype, 'fullscreenElement', { configurable: true, get: () => el });
    Object.defineProperty(Document.prototype, 'fullscreenEnabled', { configurable: true, get: () => true });
    Element.prototype.requestFullscreen = function (this: Element) {
      if (o.refuse) return Promise.reject(new TypeError('Permissions check failed'));
      return new Promise<void>((resolve) => setTimeout(() => {
        el = this; change(); resolve();
        if (o.exitRightAfterGrant) { el = null; change(); }
      }, o.delay ?? 0));
    };
    Document.prototype.exitFullscreen = () => new Promise<void>((resolve) => setTimeout(() => { el = null; change(); resolve(); }, o.delay ?? 0));
  }, opts);
}

test('a refused fullscreen request keeps presenter mode on (without fullscreen) until Esc', async ({ page }) => {
  await fakeFullscreen(page, { refuse: true });
  await openPage(page, 'en/topic-1/explore');
  await press(page, 'p');
  await expect(page.locator('html')).toHaveAttribute('data-presenter', 'true');
  await page.waitForTimeout(300);
  await expect(page.locator('html')).toHaveAttribute('data-presenter', 'true');
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  await press(page, 'Escape');
  await expect(page.locator('html')).toHaveAttribute('data-presenter', 'false');
  expect(pageErrors(page)).toEqual([]);
});

test('leaving fullscreen while our request is still settling ends presenter mode', async ({ page }) => {
  await fakeFullscreen(page, { delay: 120, exitRightAfterGrant: true });
  await openPage(page, 'en/topic-1/explore');
  await press(page, 'p');
  await expect(page.locator('html')).toHaveAttribute('data-presenter', 'true');
  // Granted, then left at once (before the request settled): presenter mode follows fullscreen out.
  await expect(page.locator('html')).toHaveAttribute('data-presenter', 'false');
  await expect(page.getByRole('button', { name: 'Presenter mode' })).toHaveAttribute('aria-pressed', 'false');
  expect(pageErrors(page)).toEqual([]);
});

test('P pressed off and on quickly ends in presenter mode and fullscreen, in step', async ({ page }) => {
  await fakeFullscreen(page, { delay: 80 });
  await openPage(page, 'en/topic-1/explore');
  await press(page, 'p');
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await press(page, 'p');
  await press(page, 'p');
  await page.waitForTimeout(500);
  await expect(page.locator('html')).toHaveAttribute('data-presenter', 'true');
  expect(await page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  // The browser's own way out (no key reaches the page) still ends presenter mode.
  await page.evaluate(() => document.exitFullscreen());
  await expect(page.locator('html')).toHaveAttribute('data-presenter', 'false');
});
