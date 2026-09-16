/*
 * Task 20: measures the graticule's real weight over the rendered map. Shoots the flat map (and the globe) twice —
 * once as it is, once with .grid / .grid-casing hidden — so every pixel the grid actually paints is known, then
 * reports the composited line colour against the picture underneath it, split by how dark that picture is
 * (Satellite's night side vs its day side). Throw-away tooling for the design pass.
 *   node --experimental-strip-types scripts/t20-grid-contrast.ts <style> <theme> [out-name]
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from './t20-png.ts';

const [style = 'satellite', theme = 'light', out = `${style}-${theme}`] = process.argv.slice(2);
const file = 'file://' + resolve('dist/geo-coordinates.html');
mkdirSync('shots/t20/grid', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, colorScheme: theme === 'dark' ? 'dark' : 'light' });
await page.addInitScript((s) => localStorage.setItem('geo-coords:map-style', s), style);
await page.goto(`${file}#en/lab`);
await page.waitForSelector('#main');
await page.waitForTimeout(1500);

for (const view of ['flat', 'globe'] as const) {
  const frame = page.locator(`.view-${view} .frame`);
  await frame.screenshot({ path: `shots/t20/grid/${out}-${view}-with.png` });
  const tag = await page.addStyleTag({ content: '.grid, .grid-casing { display: none !important; }' });
  await page.waitForTimeout(250);
  await frame.screenshot({ path: `shots/t20/grid/${out}-${view}-without.png` });
  await tag.evaluate((n) => (n as unknown as Element).remove());
  await page.waitForTimeout(250);
  report(`${out} ${view}`, `shots/t20/grid/${out}-${view}-with.png`, `shots/t20/grid/${out}-${view}-without.png`);
}
await browser.close();

function lin(c: number): number { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
function lum(r: number, g: number, b: number): number { return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); }
function ratio(a: number, b: number): number { const [hi, lo] = a >= b ? [a, b] : [b, a]; return (hi + 0.05) / (lo + 0.05); }
function median(a: number[]): number { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; }

function report(label: string, withPath: string, withoutPath: string): void {
  const a = PNG.read(withPath), b = PNG.read(withoutPath);
  // Grid pixels: where hiding the grid changed the picture a lot, and the change is a *line* (the background under it
  // is what the "without" shot shows). Split by the background's own luminance: dark = Satellite's night side.
  const dark: number[] = [], bright: number[] = [];
  for (let i = 0; i < a.data.length; i += 4) {
    const dr = a.data[i]! - b.data[i]!, dg = a.data[i + 1]! - b.data[i + 1]!, db = a.data[i + 2]! - b.data[i + 2]!;
    if (Math.abs(dr) + Math.abs(dg) + Math.abs(db) < 90) continue;
    const bg = lum(b.data[i]!, b.data[i + 1]!, b.data[i + 2]!);
    const fg = lum(a.data[i]!, a.data[i + 1]!, a.data[i + 2]!);
    (bg < 0.06 ? dark : bright).push(ratio(fg, bg));
  }
  const pct = (v: number[], p: number) => { const s = [...v].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0; };
  const fmt = (v: number[]) => v.length ? `n=${v.length} p25=${pct(v, 0.25).toFixed(2)} p50=${median(v).toFixed(2)} p75=${pct(v, 0.75).toFixed(2)} p90=${pct(v, 0.9).toFixed(2)} max=${Math.max(...v).toFixed(2)}` : 'n=0';
  console.log(`${label}\n  over a dark picture (night side): ${fmt(dark)}\n  over a bright picture (day side): ${fmt(bright)}`);
}
