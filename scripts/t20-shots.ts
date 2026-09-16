/*
 * Task 20 review shots: every named route × map style × theme × width, saved under shots/t20/.
 * Throw-away tooling for the design pass; not part of the build.
 *   node --experimental-strip-types scripts/t20-shots.ts [filter]
 */
import { chromium, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const file = 'file://' + resolve('dist/geo-coordinates.html');
const out = 'shots/t20';
mkdirSync(out, { recursive: true });
const filter = process.argv[2] ?? '';

type Shot = { name: string; hash: string; style: string; theme: 'light' | 'dark'; w: number; h: number; presenter?: boolean; after?: (p: Page) => Promise<void> };

const STYLES = ['physical', 'satellite', 'political'] as const;
const shots: Shot[] = [];
for (const style of STYLES) {
  for (const theme of ['light', 'dark'] as const) {
    shots.push({ name: `lab-${style}-${theme}-1366`, hash: 'en/lab', style, theme, w: 1366, h: 768 });
    shots.push({ name: `lab-${style}-${theme}-375`, hash: 'en/lab', style, theme, w: 375, h: 667 });
    shots.push({ name: `t1-${style}-${theme}-1366`, hash: 'en/topic-1/explore/9', style, theme, w: 1366, h: 768 });
    shots.push({ name: `t10-uk-${style}-${theme}-1366`, hash: 'uk/topic-10/explore/6', style, theme, w: 1366, h: 768 });
    shots.push({ name: `t9-pl-${style}-${theme}-1366`, hash: 'pl/topic-9/explore/3', style, theme, w: 1366, h: 768 });
    shots.push({ name: `lab-seasons-${style}-${theme}-1366`, hash: 'en/lab', style, theme, w: 1366, h: 768, after: seasons });
  }
  shots.push({ name: `lab-${style}-presenter-1920`, hash: 'en/lab', style, theme: 'light', w: 1920, h: 1080, presenter: true });
  shots.push({ name: `lab-${style}-presenter-dark-1920`, hash: 'en/lab', style, theme: 'dark', w: 1920, h: 1080, presenter: true });
  shots.push({ name: `quiz-${style}-1366`, hash: 'en/class-quiz', style, theme: 'light', w: 1366, h: 768, after: quiz });
  shots.push({ name: `lab-${style}-768`, hash: 'en/lab', style, theme: 'light', w: 1024, h: 768 });
}
shots.push({ name: 'lab-atlas-light-1366', hash: 'en/lab', style: 'atlas', theme: 'light', w: 1366, h: 768 });
shots.push({ name: 'lab-atlas-dark-1366', hash: 'en/lab', style: 'atlas', theme: 'dark', w: 1366, h: 768 });

async function seasons(p: Page) {
  await p.getByRole('button', { name: /Seasons mode/ }).click();
  await p.waitForTimeout(500);
}
async function quiz(p: Page) {
  await p.getByRole('button', { name: 'Start the quiz' }).click();
  await p.locator('body').press('Space');
  await p.waitForTimeout(600);
}

const browser = await chromium.launch();
for (const s of shots) {
  if (filter && !s.name.includes(filter)) continue;
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, colorScheme: s.theme });
  await page.addInitScript((style) => localStorage.setItem('geo-coords:map-style', style), s.style);
  await page.goto(`${file}#${s.hash}`);
  await page.waitForSelector('#main');
  if (s.presenter) await page.locator('body').press('p');
  if (s.after) await s.after(page);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${s.name}.png`, fullPage: true });
  await page.close();
  console.log(s.name);
}
await browser.close();
