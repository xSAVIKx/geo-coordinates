import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';

export const DIST_FILE = resolve('dist/geo-coordinates.html');

export async function openPage(page: Page, hash = 'en/', query = ''): Promise<void> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.context().route('**/*', (route) =>
    route.request().url().startsWith('file:') ? route.continue() : route.abort());
  await page.goto(`file://${DIST_FILE}${query}#${hash}`);
  await page.waitForSelector('#main');
  (page as Page & { __errors?: string[] }).__errors = errors;
}

export function pageErrors(page: Page): string[] {
  return (page as Page & { __errors?: string[] }).__errors ?? [];
}

export async function expectNoAxeViolations(page: Page, context = ''): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')})`);
  expect(summary, `axe violations ${context}`).toEqual([]);
}
