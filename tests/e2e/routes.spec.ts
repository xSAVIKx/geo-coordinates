import { expect, test } from '@playwright/test';
import { DIST_FILE, expectNoAxeViolations, openPage, pageErrors } from './helpers';

// Full route sweep: every route the router knows about, in every language, in both colour
// schemes — axe clean and no console/page errors. Explore steps are covered step-by-step
// (light theme only) in explore.spec.ts already; here we only check step 1 and the last step
// per topic (per the controller: axe on every step in every scheme would be too slow), which
// still exercises dark mode across the app.
const TOPICS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const SIMPLE_ROUTES = ['', 'lab', 'rehearsal', 'class-quiz', 'cheatsheet', 'worksheet'];

test.describe.configure({ mode: 'parallel' });

for (const scheme of ['light', 'dark'] as const) {
  for (const lang of ['en', 'pl', 'uk'] as const) {
    test(`all routes · ${lang} · ${scheme}: no axe violations, no console errors`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.emulateMedia({ colorScheme: scheme });
      await openPage(page, `${lang}/`);

      const goTo = async (hash: string) => {
        await page.evaluate((h) => { location.hash = h; }, `${lang}/${hash}`);
        await expect(page.locator('h1')).toBeVisible();
        await page.waitForTimeout(150);
      };

      for (const r of SIMPLE_ROUTES) {
        await goTo(r);
        await expectNoAxeViolations(page, `${lang}/${r} ${scheme}`);
      }

      for (const topic of TOPICS) {
        await goTo(`topic-${topic}/explore`);
        await expectNoAxeViolations(page, `${lang}/topic-${topic}/explore step 1 ${scheme}`);
        const total = await page.locator('.dots li').count();
        if (total > 1) {
          await goTo(`topic-${topic}/explore/${total}`);
          await expectNoAxeViolations(page, `${lang}/topic-${topic}/explore step ${total} (last) ${scheme}`);
        }
        if (topic !== 9) {
          await goTo(`topic-${topic}/practice`);
          await expectNoAxeViolations(page, `${lang}/topic-${topic}/practice ${scheme}`);
        }
      }
      // Topic 9 has no question types: its practice address redirects to Explore (functional
      // behaviour checked in explore.spec.ts). Confirm the redirected page is itself clean.
      await goTo('topic-9/practice');
      await expectNoAxeViolations(page, `${lang}/topic-9/practice (redirects to explore) ${scheme}`);

      expect(pageErrors(page)).toEqual([]);
    });
  }
}

test('size budget: dist/geo-coordinates.html stays under 1 MiB', async () => {
  const { statSync } = await import('node:fs');
  expect(statSync(DIST_FILE).size).toBeLessThan(1_048_576);
});

test('first visit with reduced-motion preference turns the setting on', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPage(page, 'en/');
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
});

test('Polish browser gets Polish on first visit; the language choice is remembered', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'pl-PL' });
  const page = await context.newPage();
  await openPage(page, '');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  await page.getByRole('button', { name: /УК/ }).click();
  await page.reload();
  // The hash already carries #uk/ after reload, which proves persistence via the URL. To prove
  // it also persists in localStorage (not only the hash), load the bare file with no hash next.
  await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  await page.goto(`file://${DIST_FILE}`);
  await page.waitForSelector('#main');
  await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  await context.close();
});
