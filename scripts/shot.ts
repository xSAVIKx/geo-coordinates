import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const [hash = 'en/', name = 'shot', theme = 'light'] = process.argv.slice(2);
const file = 'file://' + resolve('dist/geo-coordinates.html');
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch();
for (const [w, h] of [[375, 667], [1366, 768]] as const) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: theme === 'dark' ? 'dark' : 'light' });
  await page.goto(`${file}#${hash}`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `shots/${name}-${w}x${h}.png`, fullPage: true });
  await page.close();
}
await browser.close();
console.log(`saved shots/${name}-*.png`);
