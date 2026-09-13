import type { Page } from '@playwright/test';
import { resolve } from 'node:path';

export const DIST_FILE = resolve('dist/geo-coordinates.html');

export async function openPage(page: Page, hash = 'en/'): Promise<void> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.context().route('**/*', (route) =>
    route.request().url().startsWith('file:') ? route.continue() : route.abort());
  await page.goto(`file://${DIST_FILE}#${hash}`);
  await page.waitForSelector('#main');
  (page as Page & { __errors?: string[] }).__errors = errors;
}

export function pageErrors(page: Page): string[] {
  return (page as Page & { __errors?: string[] }).__errors ?? [];
}
