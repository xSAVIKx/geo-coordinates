// The README screenshots: docs/screenshots/{home,lesson,lab,satellite}.png, each the first 1366×768 screen (the
// viewport, not the whole page) of the built file in English, light theme; the satellite shot forces the
// Satellite map style and a night-side Sun position. PNGs are then reduced to a 256-colour palette with Python
// and Pillow when they are installed (about a third of the size, no visible change); without them the
// full-colour PNGs are kept and a note says so.
//
//   npm run build && npm run shots:readme [-- --out <dir>]
import { chromium } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SHOTS = [
  { name: 'home', hash: 'en/' },
  { name: 'lesson', hash: 'en/topic-6/explore/5' },
  { name: 'lab', hash: 'en/lab' },
  { name: 'satellite', hash: 'en/lab', style: 'satellite', sun: { utcMinutes: 1020, dayOfYear: 266 } },
] as const;

const outFlag = process.argv.indexOf('--out');
const outDir = resolve(outFlag >= 0 ? process.argv[outFlag + 1]! : 'docs/screenshots');
const file = 'file://' + resolve('dist/geo-coordinates.html');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const paths: string[] = [];
for (const shot of SHOTS) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, colorScheme: 'light' });
  if ('style' in shot) await page.addInitScript((s) => localStorage.setItem('geo-coords:map-style', s), shot.style);
  const suffix = 'style' in shot ? '?test' : '';
  await page.goto(`${file}${suffix}#${shot.hash}`);
  await page.waitForSelector('#main');
  if ('sun' in shot) {
    // The style (set before goto) and the Sun (set here, before the layer's first paint) both land inside the
    // texture layer's very first draw, so the WebGL tier never needs a second frame: wait for that one frame
    // (>= 1, matching tests/e2e/helpers.ts's waitForTexture) rather than a redraw an already-correct picture
    // never produces. This condition alone doesn't guarantee THIS is that frame — under host contention a
    // stale draw from before the Sun was set could already satisfy >= 1 — so don't drop the fixed 600ms wait
    // below: it, not this poll, is what gives the correct (Sun-including) frame time to land on screen.
    await page.evaluate((sun) => { (window as any).__mapState.sun = { ...sun, year: 2026 }; }, shot.sun);
    await page.waitForFunction(() => (window as any).__mapTextures.drawCount('flat') >= 1, null, { timeout: 15_000 });
  }
  await page.waitForTimeout(600);
  const path = join(outDir, `${shot.name}.png`);
  await page.screenshot({ path });
  paths.push(path);
  await page.close();
}
await browser.close();

const QUANTIZE = `
import sys
from PIL import Image
for p in sys.argv[1:]:
    Image.open(p).convert('RGB').quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(p, optimize=True)
`;
const q = spawnSync('python3', ['-c', QUANTIZE, ...paths], { stdio: 'inherit' });
if (q.status !== 0) console.warn('Not quantized (needs python3 with Pillow): the screenshots are full-colour PNGs.');
for (const p of paths) console.log(`${p}: ${(statSync(p).size / 1024).toFixed(0)} KiB`);
