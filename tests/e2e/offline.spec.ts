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
