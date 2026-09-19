import { expect, test } from '@playwright/test';
import boxesJson from '../../src/map/data/city/boxes.json' with { type: 'json' };
import { openPage, pageErrors } from './helpers';

const ids = boxesJson.boxes.map((b) => b.id);

test('every close-up photo and street topology is in the file, and none of it is parsed at load', async ({ page }) => {
  await openPage(page, 'en/lab');
  const found = await page.evaluate(() => ({
    photos: [...document.querySelectorAll('script[type="application/x-geo-photo"]')].map((e) => e.id),
    streets: [...document.querySelectorAll('script[type="application/x-geo-city"]')].map((e) => e.id),
  }));
  expect(found.photos).toEqual(ids.map((id) => `geo-photo-${id}`));
  expect(found.streets).toEqual(ids.map((id) => `geo-city-${id}`));
  // A data block is text, never code: nothing in it may have run.
  expect(pageErrors(page)).toEqual([]);
  const sample = await page.evaluate(async () => {
    const t = document.getElementById('geo-city-katowice')!.textContent!;
    const p = document.getElementById('geo-photo-katowice')!.textContent!;
    // The street block is base64 of a gzipped TopoJSON (Task 2 / src/map/cityStreets.ts), not raw text.
    const binary = atob(t.replace(/\s+/g, ''));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const inflated = new Response(bytes).body!.pipeThrough(new DecompressionStream('gzip'));
    const topology: { objects: Record<string, unknown> } = JSON.parse(await new Response(inflated).text());
    return { hasRoads: topology.objects.roads !== undefined, base64: /^[A-Za-z0-9+/=]+$/.test(p), photoLen: p.length, streetBase64: /^[A-Za-z0-9+/=]+$/.test(t) };
  });
  expect(sample.hasRoads).toBe(true);
  expect(sample.base64).toBe(true);
  expect(sample.streetBase64).toBe(true);
  expect(sample.photoLen).toBeGreaterThan(100_000);
});
