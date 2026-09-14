import { expect, test, type Page } from '@playwright/test';
import { openPage, pageErrors } from './helpers';

const START = { en: 'Start the quiz', pl: 'Rozpocznij quiz', uk: 'Почати вікторину' } as const;
type Lang = keyof typeof START;

/**
 * Starts a class quiz at 1920×1080 and reveals every question, returning each one whose explanation
 * ends below the first screen of the page (so the class would have to scroll to read it).
 */
async function overflowing(page: Page, lang: Lang, presenterOn: boolean, opts: { seed: string; difficulty: string; count: number; topic?: string }): Promise<string[]> {
  await page.goto('about:blank');
  await openPage(page, `${lang}/class-quiz?seed=${opts.seed}`);
  if (presenterOn) {
    await page.locator('body').press('p');
    await expect(page.locator('html')).toHaveAttribute('data-presenter', 'true');
  }
  await page.locator(`input[name="cq-difficulty"][value="${opts.difficulty}"]`).check();
  await page.locator(`input[name="cq-count"][value="${opts.count}"]`).check();
  if (opts.topic) {
    const boxes = page.locator('form.setup input[type="checkbox"]');
    for (let i = 0; i < await boxes.count(); i++) {
      if (await boxes.nth(i).getAttribute('value') !== opts.topic) await boxes.nth(i).uncheck();
    }
  }
  await page.getByRole('button', { name: START[lang] }).click();
  const out: string[] = [];
  for (let n = 1; n <= opts.count; n++) {
    await page.locator('body').press('Space');
    await expect(page.locator('.reveal .why')).toBeVisible();
    // Measured while the reveal still rises into place (8px low), so the check errs on the safe side.
    const below = await page.evaluate(() => Math.ceil(document.querySelector('.reveal .why')!.getBoundingClientRect().bottom + window.scrollY - window.innerHeight));
    if (below > 0) out.push(`${lang} ${opts.seed} q${n} "${await page.locator('#cq-prompt').textContent()}": ${below}px below the screen`);
    if (n < opts.count) await page.locator('body').press('ArrowRight');
  }
  return out;
}

for (const presenterOn of [false, true]) {
  test(`class quiz at 1920×1080 (presenter ${presenterOn ? 'on' : 'off'}): a revealed explanation fits the first screen in EN/PL/UK`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const report: string[] = [];
    for (const lang of Object.keys(START) as Lang[]) {
      // Every topic, and the longest explanations there are: hard solar-time questions across the 180° meridian.
      report.push(...await overflowing(page, lang, presenterOn, { seed: 'fit1', difficulty: 'medium', count: 10 }));
      report.push(...await overflowing(page, lang, presenterOn, { seed: 'a1', difficulty: 'hard', count: 15, topic: '8' }));
    }
    expect(report).toEqual([]);
    expect(pageErrors(page)).toEqual([]);
  });
}
