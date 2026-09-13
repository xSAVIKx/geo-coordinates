import { expect, test } from '@playwright/test';
import { openPage, pageErrors } from './helpers';

test('built single file renders offline with no network requests', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) external.push(r.url()); });
  await openPage(page, 'en/');
  await expect(page.locator('#main')).toBeVisible();
  expect(external).toEqual([]);
  expect(pageErrors(page)).toEqual([]);
});
