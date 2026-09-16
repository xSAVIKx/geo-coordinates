import { expect, test } from '@playwright/test';
import manifest from '../../src/map/data/textures/manifest.json' with { type: 'json' };
import { openPage, pageErrors } from './helpers';

test('the built file embeds the five map textures and each decodes to its manifest size, with no requests', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => { if (!r.url().startsWith('file:')) external.push(r.url()); });
  await openPage(page, 'en/');
  const sizes = await page.evaluate(async () => Promise.all([...document.querySelectorAll<HTMLScriptElement>('script[type="application/x-geo-texture"]')].map(async (s) => {
    const bin = atob(s.textContent!.trim());
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/webp' }));
    return [s.id.replace('geo-texture-', ''), bmp.width, bmp.height] as const;
  })));
  expect(Object.fromEntries(sizes.map(([id, w, h]) => [id, [w, h]])))
    .toEqual(Object.fromEntries(Object.entries(manifest.textures).map(([id, t]) => [id, [t.width, t.height]])));
  expect(external).toEqual([]);
  expect(pageErrors(page)).toEqual([]);
});
