import { expect, test, type Page } from '@playwright/test';
import { openPage } from './helpers';

// Map styles spec §7: "Atlas pixel-identical to today". These screenshots were taken from the released code before the
// map styles work began (Task 5) and are never regenerated: a difference means an Atlas rendering change.
type MS = { sun: unknown; rotate: [number, number]; globeZoom: number; setFlatView(c: { lat: number; lon: number }, z: number): void };
const settle = async (page: Page, fn?: (s: MS) => void) => {
  await page.evaluate((src) => {
    const s = (window as unknown as { __mapState: MS }).__mapState;
    if (s.sun) s.sun = { utcMinutes: 720, dayOfYear: 80, year: 2026 };
    if (src) new Function('s', src)(s);
  }, fn ? `(${fn.toString()})(s)` : null);
  await page.waitForTimeout(300);
};
const shoot = async (page: Page, name: string) => {
  for (const view of ['flat', 'globe'] as const) {
    const frame = page.locator(`.view-${view} .frame`);
    if (await frame.count()) await expect(frame, `${name} ${view}`).toHaveScreenshot(`${name}-${view}.png`, { maxDiffPixels: 0, animations: 'disabled', caret: 'hide' });
  }
};

const SCENES: { name: string; hash: string; scheme?: 'dark'; fn?: (s: MS) => void }[] = [
  { name: 'lab', hash: 'en/lab' },
  { name: 'lab-katowice-zoom12', hash: 'en/lab', fn: (s) => s.setFlatView({ lat: 50.26, lon: 19.02 }, 12) },
  { name: 't1-ball', hash: 'en/topic-1/explore' },
  { name: 't1-projections', hash: 'en/topic-1/explore/7' },
  { name: 't6-step5', hash: 'en/topic-6/explore/5' },
  { name: 't9-signs-mercator', hash: 'pl/topic-9/explore/3' },
  { name: 't8-seasons-dark', hash: 'en/topic-8/explore/7', scheme: 'dark' },
];

for (const scene of SCENES) {
  test(`Atlas is pixel-identical: ${scene.name}`, async ({ page }) => {
    if (scene.scheme) await page.emulateMedia({ colorScheme: scene.scheme });
    await openPage(page, scene.hash, '?test');
    await settle(page, scene.fn);
    await shoot(page, scene.name);
  });
}
