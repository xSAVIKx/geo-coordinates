// The README screenshots: docs/screenshots/{home,lesson,lab}.png, each the first 1366×768 screen (the viewport, not the
// whole page) of the built file in English, light theme. PNGs are then reduced to a 256-colour palette with Python and
// Pillow when they are installed (about a third of the size, no visible change); without them the full-colour PNGs are
// kept and a note says so.
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
] as const;

const outFlag = process.argv.indexOf('--out');
const outDir = resolve(outFlag >= 0 ? process.argv[outFlag + 1]! : 'docs/screenshots');
const file = 'file://' + resolve('dist/geo-coordinates.html');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const paths: string[] = [];
for (const shot of SHOTS) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, colorScheme: 'light' });
  await page.goto(`${file}#${shot.hash}`);
  await page.waitForSelector('#main');
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
