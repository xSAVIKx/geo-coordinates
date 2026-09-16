/*
 * Task 20 review shots, third set: the checks in the brief's Step 4 that need a particular state — the compact style
 * menu and its focus ring on a phone, the loading note under a throttled CPU, the "this device can't draw it" note in
 * all three languages, a Poland zoom in Physical, a Balkans zoom in Political, and the orbit in both themes.
 * Throw-away tooling for the design pass.  node --experimental-strip-types scripts/t20-shots3.ts [filter]
 */
import { chromium, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const file = 'file://' + resolve('dist/geo-coordinates.html');
const out = 'shots/t20';
const filter = process.argv[2] ?? '';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();

const setView = (p: Page, lat: number, lon: number, zoom: number) =>
  p.evaluate(([la, lo, z]) => (window as unknown as { __mapState: { setFlatView(c: { lat: number; lon: number }, z: number): void } }).__mapState.setFlatView({ lat: la!, lon: lo! }, z!), [lat, lon, zoom]);

async function shot(name: string, opts: { hash: string; style?: string; theme?: 'light' | 'dark'; w?: number; h?: number; query?: string; reduceMotion?: boolean; after?: (p: Page) => Promise<void> }) {
  if (filter && !name.includes(filter)) return;
  const page = await browser.newPage({ viewport: { width: opts.w ?? 1366, height: opts.h ?? 768 }, colorScheme: opts.theme ?? 'light', reducedMotion: opts.reduceMotion ? 'reduce' : 'no-preference' });
  if (opts.style) await page.addInitScript((s) => localStorage.setItem('geo-coords:map-style', s), opts.style);
  await page.goto(`${file}${opts.query ?? ''}#${opts.hash}`);
  await page.waitForSelector('#main');
  if (opts.after) await opts.after(page);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: !opts.after });
  await page.close();
  console.log(name);
}

// 3. The compact style menu on a phone: open, fully on screen, and the focus ring on the pressed style.
for (const style of ['atlas', 'physical', 'satellite', 'political'] as const) {
  await shot(`menu-375-${style}`, {
    hash: 'en/lab', style, w: 375, h: 667,
    after: async (p) => { await p.getByRole('button', { name: /^Map style:/ }).first().click(); await p.waitForTimeout(400); },
  });
}
// 4. Loading on a slow CPU: Atlas stays drawn, "Loading map…" shows, no blank frame.
await shot('loading-cpu6', {
  hash: 'en/lab', query: '?test',
  after: async (p) => {
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
    await p.evaluate(() => (window as unknown as { __mapState: { chooseMapStyle(s: string): void } }).__mapState.chooseMapStyle('satellite'));
    await p.waitForTimeout(120);
  },
});
// 5. The note when the device can draw neither path, in all three languages.
for (const lang of ['en', 'pl', 'uk'] as const) {
  await shot(`fallback-note-${lang}`, { hash: `${lang}/lab`, style: 'satellite', query: '?test&gl=off&canvas=off' });
}
// 8. Physical at a Poland zoom: the Tatras and the Sudetes, rivers that must not read as borders, italic seas.
await shot('physical-poland', { hash: 'en/lab', style: 'physical', query: '?test', after: (p) => setView(p, 50.5, 19, 7) });
await shot('physical-poland-dark', { hash: 'en/lab', style: 'physical', theme: 'dark', query: '?test', after: (p) => setView(p, 50.5, 19, 7) });
// 7. Political at a Balkans zoom: Kosovo labelled, neighbours apart.
await shot('political-balkans', { hash: 'en/lab', style: 'political', query: '?test', after: (p) => setView(p, 43, 20, 8) });
await shot('political-balkans-dark', { hash: 'en/lab', style: 'political', theme: 'dark', query: '?test', after: (p) => setView(p, 43, 20, 8) });
// 9. Topic 10's globe steps, where the text describes the polar day and night.
for (const step of [3, 6]) {
  for (const theme of ['light', 'dark'] as const) {
    await shot(`t10-step${step}-${theme}`, { hash: `en/topic-10/explore/${step}`, style: 'political', theme });
  }
}
await browser.close();
