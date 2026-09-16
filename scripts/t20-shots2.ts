/*
 * Task 20 review shots, second set: answered practice questions and a revealed class-quiz answer, where the
 * markers, brackets and answer inks sit on the new styles. Throw-away tooling for the design pass.
 *   node --experimental-strip-types scripts/t20-shots2.ts [filter] [out-dir]
 */
import { chromium, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const file = 'file://' + resolve('dist/geo-coordinates.html');
const filter = process.argv[2] ?? '';
const out = process.argv[3] ?? 'shots/t20';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
for (const style of ['physical', 'satellite', 'political'] as const) {
  for (const theme of ['light', 'dark'] as const) {
    for (const [name, hash, after] of [
      ['practice', 'en/topic-3/practice', answer],
      ['quiz', 'en/class-quiz', quiz],
      ['t7-deep', 'en/topic-4/explore/4', null],
    ] as [string, string, ((p: Page) => Promise<void>) | null][]) {
      const label = `${name}-${style}-${theme}`;
      if (filter && !label.includes(filter)) continue;
      const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, colorScheme: theme });
      await page.addInitScript((s) => localStorage.setItem('geo-coords:map-style', s), style);
      await page.goto(`${file}#${hash}`);
      await page.waitForSelector('#main');
      if (after) await after(page);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${out}/${label}.png`, fullPage: true });
      await page.close();
      console.log(label);
    }
  }
}
await browser.close();

async function answer(p: Page) {
  // Answer the first question however it asks, then reveal: the answer marker and the brackets appear on the map.
  await p.waitForTimeout(500);
  const check = p.getByRole('button', { name: /^(Check|Show me)/ });
  const choice = p.getByRole('radio').first();
  if (await choice.count()) await choice.check().catch(() => {});
  if (await check.count()) await check.first().click().catch(() => {});
  await p.waitForTimeout(400);
}
async function quiz(p: Page) {
  await p.getByRole('button', { name: 'Start the quiz' }).click();
  await p.locator('body').press('Space');
  await p.waitForTimeout(600);
}
