import { expect, test, type Page } from '@playwright/test';
import { openPage, pageErrors } from './helpers';

// The lesson is also shown inside hosts (e.g. an artifact viewer) that wrap it in their own
// skeleton: a reset that paints <body> with the host's ground and declares a light
// color-scheme, plus a data-theme stamp on <html> for the viewer's theme choice. These tests
// check that text stays readable against the background it is actually painted on.

const HOST_RESET = ':root{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif;background:#faf9f5}';

/** Runs before any page script: stamps <html data-theme> and puts a host-style reset first in <head>. */
async function emulateHost(page: Page, stamp: 'dark' | 'light', hostGround = '#faf9f5'): Promise<void> {
  await page.addInitScript(({ stamp, css }) => {
    let stamped = false; let styled = false;
    const run = (): boolean => {
      const root = document.documentElement;
      if (root && !stamped) { root.setAttribute('data-theme', stamp); stamped = true; }
      if (document.head && !styled) {
        const s = document.createElement('style'); s.textContent = css; document.head.prepend(s); styled = true;
      }
      return stamped && styled;
    };
    if (!run()) new MutationObserver((_, o) => { if (run()) o.disconnect(); }).observe(document, { childList: true, subtree: true });
  }, { stamp, css: HOST_RESET.replace('#faf9f5', hostGround) });
}

interface Pair { what: string; fg: string; bg: string; ratio: number }

/** WCAG contrast of an element's text against the composited background it sits on (up to the canvas). */
async function contrast(page: Page, selector: string): Promise<Pair> {
  const el = page.locator(selector).first();
  await expect(el).toBeVisible();
  return el.evaluate((node, what) => {
    type RGBA = [number, number, number, number];
    const cv = document.createElement('canvas'); cv.width = cv.height = 1;
    const cx = cv.getContext('2d', { willReadFrequently: true })!;
    const rgba = (c: string): RGBA => {
      cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1);
      const [r = 0, g = 0, b = 0, a = 0] = cx.getImageData(0, 0, 1, 1).data; return [r, g, b, a / 255];
    };
    const over = ([r, g, b, a]: RGBA, [R, G, B]: RGBA): RGBA => [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a), 1];
    const layers: RGBA[] = [];
    for (let e: Element | null = node; e; e = e.parentElement) {
      const c = rgba(getComputedStyle(e).backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] === 1) break;
    }
    const bg = layers.reduceRight<RGBA>((below, layer) => over(layer, below), [255, 255, 255, 1]);
    const fg = over(rgba(getComputedStyle(node).color), bg);
    const lum = ([r, g, b]: RGBA): number => {
      const f = (v: number): number => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const hi = Math.max(lum(fg), lum(bg)); const lo = Math.min(lum(fg), lum(bg));
    const hex = (c: RGBA): string => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    return { what: `${what}: ${hex(fg)} on ${hex(bg)}`, fg: hex(fg), bg: hex(bg), ratio: (hi + 0.05) / (lo + 0.05) };
  }, selector);
}

async function expectReadableDark(page: Page): Promise<void> {
  // A theme switch starts colour transitions (even 0.01 ms ones); sample only once they settle.
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a instanceof CSSTransition).map((a) => a.finished.catch(() => undefined))));
  // h1 and the step text sit straight on the page ground; the buttons have their own surface.
  const h1 = await contrast(page, 'main h1');
  const pairs = [h1, await contrast(page, 'main p'), await contrast(page, 'main .btn.primary'), await contrast(page, 'main .btn:not(.primary)')];
  for (const p of pairs) expect(p.ratio, p.what).toBeGreaterThanOrEqual(4.5);
  // Dark theme really applied: the h1 ground is dark.
  expect(parseInt(h1.bg.slice(1, 3), 16), h1.what).toBeLessThan(0x40);
}

const ROUTE = 'en/topic-1/explore/2';

test('dark OS preference without a stamp is readable', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await openPage(page, ROUTE);
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./);
  await expectReadableDark(page);
  expect(pageErrors(page)).toEqual([]);
});

test('dark OS preference inside a light-ground host without a stamp is readable', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.addInitScript((css) => {
    const add = (): boolean => { if (!document.head) return false; const s = document.createElement('style'); s.textContent = css; document.head.prepend(s); return true; };
    if (!add()) new MutationObserver((_, o) => { if (add()) o.disconnect(); }).observe(document, { childList: true, subtree: true });
  }, HOST_RESET);
  await openPage(page, ROUTE);
  await expectReadableDark(page);
});

test('an external data-theme="dark" stamp is honoured with a light OS', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await emulateHost(page, 'dark', '#262624');
  await openPage(page, ROUTE);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expectReadableDark(page);
  expect(pageErrors(page)).toEqual([]);
});

test('an external stamp survives choosing Dark and then Same as device again', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await emulateHost(page, 'light');
  await openPage(page, ROUTE);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Dark').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByLabel('Same as device').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('the in-app Dark setting is readable', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await openPage(page, ROUTE);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByLabel('Dark').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expectReadableDark(page);
  expect(pageErrors(page)).toEqual([]);
});
