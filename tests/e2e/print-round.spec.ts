import { expect, test } from '@playwright/test';
import { openPage } from './helpers';

// Print fixes from the final design, UX and accessibility round (Task D3).

for (const lang of ['en', 'pl', 'uk'] as const) {
  test(`cheat sheet (${lang}): the prime meridian's name in the grid diagram keeps inside its frame, on screen and in print`, async ({ page }) => {
    await openPage(page, `${lang}/cheatsheet`);
    const label = page.locator('.prime-label');
    await expect(label).toBeVisible();
    for (const media of ['screen', 'print'] as const) {
      await page.emulateMedia({ media });
      // The frame's left edge is at x = 4 and the meridian at x = 75 (viewBox units); the name keeps 2 units off the frame.
      await expect.poll(() => label.evaluate((e) => (e as SVGTextElement).getBBox().x), { message: `${lang} ${media} left` }).toBeGreaterThanOrEqual(6);
      const right = await label.evaluate((e) => { const b = (e as SVGTextElement).getBBox(); return b.x + b.width; });
      expect(right, `${lang} ${media} right`).toBeLessThanOrEqual(73);
    }
  });
}
