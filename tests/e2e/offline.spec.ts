import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { DIST_FILE, openPage, pageErrors } from './helpers';

test('built single file renders offline with no network requests', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) external.push(r.url()); });
  await openPage(page, 'en/');
  await expect(page.locator('#main')).toBeVisible();
  expect(external).toEqual([]);
  expect(pageErrors(page)).toEqual([]);
});

test('the built file carries its third-party licence notices and still renders in standards mode', async ({ page }) => {
  const html = readFileSync(DIST_FILE, 'utf8');
  expect(html.startsWith('<!doctype html>\n<!--\nThird-party licences')).toBe(true);
  const notices = html.slice(0, html.indexOf('-->'));
  for (const line of [/^svelte [\d.]+ \(MIT\)/m, /^d3-geo [\d.]+ \(ISC\)/m, /^d3-array [\d.]+ \(ISC\)/m, /^topojson-client [\d.]+ \(ISC\)/m, /^world-atlas [\d.]+ \(ISC\)/m, /^Natural Earth map data \(Public domain\)/m]) {
    expect(notices).toMatch(line);
  }
  await openPage(page, 'en/');
  expect(await page.evaluate(() => document.compatMode)).toBe('CSS1Compat');
});

test('the built file carries its icons inline, links no manifest offline, and describes itself in the chosen language', async ({ page }) => {
  await openPage(page, 'en/');
  const head = await page.evaluate(() => ({
    icons: [...document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]')].map((l) => l.href.slice(0, 22)),
    manifest: document.querySelector('link[rel="manifest"]'),
    ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
  }));
  expect(head.icons).toEqual(['data:image/svg+xml,%3C', 'data:image/png;base64,', 'data:image/png;base64,']);
  expect(head.manifest).toBeNull();
  expect(head.ogImage).toBe('https://xsavikx.github.io/geo-coordinates/og-image.png');
  const description = () => page.locator('meta[name="description"]').getAttribute('content');
  expect(await description()).toMatch(/^Learn latitude and longitude/);
  await openPage(page, 'uk/');
  await expect.poll(description).toMatch(/^Вивчай широту й довготу/);
});
