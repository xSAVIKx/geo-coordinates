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

type Win = { __mapState: { chooseMapStyle(s: string): void; mapStyle: string; drawnMapStyle: string }; __mapTextures: { tier(): string; health(): unknown; drawCount(v: string): number; probe(v: string, lat: number, lon: number, r?: number): { avg: [number, number, number]; maxSum: number } | null; debugCoords(v: string, p: [number, number][]): ({ x: number; y: number; lon: number; lat: number } | null)[]; loseContext(v: string, ms: number | null): void } };

/** Chooses a map style through MapState (the page must be opened with ?test). */
export async function setMapStyle(page: Page, style: 'atlas' | 'physical' | 'satellite' | 'political'): Promise<void> {
  await page.evaluate((s) => (window as unknown as Win).__mapState.chooseMapStyle(s), style);
}

/** Waits until a view's texture layer has drawn at least `draws` frames of the chosen texture style. */
export async function waitForTexture(page: Page, view: 'flat' | 'globe', draws = 1): Promise<void> {
  await expect.poll(() => page.evaluate((v) => (window as unknown as Win).__mapTextures.drawCount(v), view), { timeout: 15_000 }).toBeGreaterThanOrEqual(draws);
}

export function probe(page: Page, view: 'flat' | 'globe', lat: number, lon: number, radius = 2) {
  return page.evaluate(([v, la, lo, r]) => (window as unknown as Win).__mapTextures.probe(v as string, la as number, lo as number, r as number), [view, lat, lon, radius] as const);
}

export function textureHooks(page: Page) {
  return {
    tier: () => page.evaluate(() => (window as unknown as Win).__mapTextures.tier()),
    health: () => page.evaluate(() => (window as unknown as Win).__mapTextures.health()),
    debugCoords: (view: 'flat' | 'globe', points: [number, number][]) => page.evaluate(([v, p]) => (window as unknown as Win).__mapTextures.debugCoords(v, p), [view, points] as const),
    loseContext: (view: 'flat' | 'globe', ms: number | null) => page.evaluate(([v, m]) => (window as unknown as Win).__mapTextures.loseContext(v, m), [view, ms] as const),
  };
}
