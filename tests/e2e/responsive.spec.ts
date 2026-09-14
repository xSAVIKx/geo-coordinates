import { expect, test } from '@playwright/test';
import { openPage } from './helpers';
import { card, current } from './practiceHelpers';

const SIZES = [[320, 640], [375, 667], [768, 1024], [1024, 768], [1366, 768]] as const;
const KEY_ROUTES = [
  'en/', 'pl/topic-1/explore/4', 'uk/topic-3/practice', 'en/topic-6/explore/5',
  'pl/lab', 'uk/rehearsal', 'en/class-quiz', 'en/cheatsheet', 'uk/worksheet',
];

test.describe.configure({ mode: 'parallel' });

for (const [w, h] of SIZES) {
  test(`no horizontal page scroll at ${w}×${h}; screenshots`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: w, height: h });
    await openPage(page, 'en/');
    for (const r of KEY_ROUTES) {
      await page.evaluate((hash) => { location.hash = hash; }, r);
      await page.waitForTimeout(250);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${r} at ${w}px`).toBeLessThanOrEqual(0);
      if (w !== 320) await page.screenshot({ path: `shots/responsive-${w}x${h}-${r.replace(/[/#?=]/g, '_')}.png`, fullPage: true });
    }
  });
}

test('touch targets are at least 44×44 across key screens on a phone', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 375, height: 667 });
  const ROUTES = [
    'en/', 'en/topic-4/explore/5', 'en/topic-2/practice', 'en/lab',
    'en/cheatsheet', 'en/worksheet', 'en/rehearsal', 'en/class-quiz',
  ];
  const audit = () => page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('button, a[href], input[type=radio], input[type=checkbox], [role=slider], summary')]
      .filter((el) => el.offsetParent !== null && !el.closest('.visually-hidden'))
      // Inline text links inside paragraphs are exempt under WCAG 2.5.8.
      .filter((el) => !(el.tagName === 'A' && el.closest('p')))
      .map((el) => {
        // Card links (Home.svelte) stretch their real hit area over the whole card with a
        // `::after { position: absolute; inset: 0 }` pseudo-element instead of resizing the
        // visible text link — measure the card, not the small link, when that pattern is used.
        const after = getComputedStyle(el, '::after');
        const stretched = after.content !== 'none' && after.position === 'absolute'
          && after.top === '0px' && after.right === '0px' && after.bottom === '0px' && after.left === '0px';
        const target = stretched ? (el.closest('.card') ?? el) : (el.closest('label') ?? el);
        const r = target.getBoundingClientRect();
        return { html: el.outerHTML.slice(0, 80), w: r.width, h: r.height };
      })
      .filter((r) => r.w < 44 || r.h < 44)
      .filter((r) => !/role="slider"/.test(r.html))); // slider thumbs sit on a 44px-high track
  for (const r of ROUTES) {
    await openPage(page, r);
    await page.waitForTimeout(150);
    const small = await audit();
    expect(small, r).toEqual([]);
  }
});

for (const type of ['protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'] as const) {
  test(`vision deficiency screenshots: ${type}`, async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setEmulatedVisionDeficiency', { type });
    for (const r of ['en/topic-1/explore/6', 'en/topic-2/explore/1', 'en/topic-6/explore/5', 'en/lab']) {
      await openPage(page, r);
      await page.waitForTimeout(250);
      await page.screenshot({ path: `shots/vision-${type}-${r.replace(/[/#?=]/g, '_')}.png` });
    }
    // Practice feedback (topic 3 is coords-only, so the answer shape is predictable): submit a
    // wrong answer and capture the feedback state (correct/wrong markers, icon and text).
    await openPage(page, 'en/topic-3/practice', '?test');
    const { question } = await current(page);
    const v = question.answer.value as { lat: number; lon: number };
    const inputs = card(page).getByRole('textbox');
    await inputs.nth(0).fill(`${Math.abs(v.lat)}${v.lat > 0 ? 'S' : 'N'}`);
    await inputs.nth(1).fill(`${Math.abs(v.lon)}${v.lon > 0 ? 'E' : 'W'}`);
    await page.getByRole('button', { name: 'Check' }).click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: `shots/vision-${type}-practice-feedback.png` });
  });
}
