import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors, setMapStyle, waitForTexture } from './helpers';

type S = { setFlatPreset(p: string): void; setFlatView(c: object, z: number): void };
const view = (page: import('@playwright/test').Page, fn: string) => page.evaluate((f) => new Function('s', f)((window as unknown as { __mapState: S }).__mapState), fn);

test('Physical: rivers and lakes over the relief, names that follow the zoom, no continent names', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'physical');
  await waitForTexture(page, 'flat');
  await expect(page.locator('.view-flat g.physical-water path.river').first()).toHaveAttribute('d', /M/);
  await expect(page.locator('.view-flat g.physical-water path.lake').first()).toHaveAttribute('d', /M/);
  await expect(page.locator('.view-flat text.map-label')).toHaveCount(0);
  await expect(page.locator('.view-flat text.physical-name[data-physical="himalayas"]')).toHaveText('Himalayas');
  // The Sahara sits beside the prime meridian, whose name is written down the whole map on the world view: the
  // lesson's own line name wins there, so the desert is read on a view of its own instead.
  await view(page, 's.setFlatView({ lat: 20, lon: 5 }, 2)');
  await expect(page.locator('.view-flat text.physical-name[data-physical="sahara"]')).toHaveText('Sahara');
  await expect(page.locator('.view-flat text.physical-name[data-physical="sahara"]')).toHaveCSS('font-style', 'italic');

  await view(page, "s.setFlatPreset('europe')");
  await expect(page.locator('.view-flat text.physical-name[data-physical="alps"]')).toHaveText('Alps');
  await expect(page.locator('.view-flat text.physical-name[data-physical="tatra"]')).toHaveCount(0);

  await view(page, 's.setFlatView({ lat: 49.6, lon: 20 }, 12)');
  await expect(page.locator('.view-flat text.physical-name[data-physical="tatra"]')).toHaveText('Tatra Mountains');
  await expect(page.locator('.view-flat g.physical-water path.river[data-river="vistula"]')).toHaveCount(1);
  await expectNoAxeViolations(page, 'lab physical tatras');

  // Physical names never cover a place name. The glyph box a browser reports spans the font's full ascent and
  // descent — a few units taller than the line box the layout reserves — so two names on neighbouring lines
  // report a couple of units of contact with no ink anywhere near touching; a real collision overlaps by most
  // of a line, so each box is trimmed by a tenth of its height top and bottom before the comparison.
  const boxes = await page.locator('.view-flat svg').first().evaluate((svg) => {
    const r = (sel: string) => [...svg.querySelectorAll<SVGTextElement>(sel)].map((t) => {
      const b = t.getBBox();
      return { text: t.textContent ?? '', left: b.x, right: b.x + b.width, top: b.y + b.height * 0.1, bottom: b.y + b.height * 0.9 };
    });
    return { names: r('text.physical-name'), places: r('text.place-name') };
  });
  expect(boxes.names.length).toBeGreaterThan(0);
  expect(boxes.places.length).toBeGreaterThan(0);
  for (const a of boxes.names) {
    for (const b of boxes.places) {
      expect(a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom, `${a.text} over ${b.text}`).toBe(false);
    }
  }
  expect(pageErrors(page)).toEqual([]);
});

test('Physical names in Polish and Ukrainian', async ({ page }) => {
  for (const [lang, alps] of [['pl', 'ALPY'], ['uk', 'АЛЬПИ']] as const) {
    await page.addInitScript(() => localStorage.setItem('geo-coords:map-style', 'physical'));
    await openPage(page, `${lang}/lab`, '?test');
    await waitForTexture(page, 'flat');
    await view(page, "s.setFlatPreset('europe')");
    await expect(page.locator('.view-flat text.physical-name[data-physical="alps"]')).toHaveText(new RegExp(alps, 'i'));
  }
});

// The relief image has no theme, so these two inks and their halo are fixed: AA against that halo in both themes,
// AAA in presenter mode. Measured from the frame's own computed tokens, the same way map-style-readability.spec.ts
// measures the ambient map inks (which this style leaves alone).
for (const scheme of ['light', 'dark'] as const) {
  test(`Physical names (${scheme}): AA over the relief, AAA in presenter mode`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await openPage(page, 'en/lab', '?test');
    await setMapStyle(page, 'physical');
    await expect(page.locator('.view-flat .frame')).toHaveAttribute('data-map-style', 'physical');
    const inks = () => page.locator('.view-flat .frame').evaluate((frame) => {
      const cs = getComputedStyle(frame);
      const rgb = (v: string) => { const c = document.createElement('canvas').getContext('2d')!; c.fillStyle = v.trim(); const h = c.fillStyle as string; return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); };
      const lum = (v: string) => { const [r, g, b] = rgb(v).map((x) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!; };
      const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x! + 0.05) / (y! + 0.05); };
      const halo = cs.getPropertyValue('--relief-halo');
      return Object.fromEntries(['--relief-label', '--sea-label'].map((t) => [t, ratio(cs.getPropertyValue(t), halo)]));
    });
    for (const [token, r] of Object.entries(await inks())) expect(r, `${scheme} ${token}`).toBeGreaterThanOrEqual(4.5);
    await page.locator('body').press('p');
    await expect(page.locator('html')).toHaveAttribute('data-presenter', 'true');
    for (const [token, r] of Object.entries(await inks())) expect(r, `presenter ${scheme} ${token}`).toBeGreaterThanOrEqual(7);
    expect(pageErrors(page)).toEqual([]);
  });
}

test('an exception in the Physical water layer shows Atlas with the note', async ({ page }) => {
  await openPage(page, 'en/lab', '?test&vector=fail');
  await setMapStyle(page, 'physical');
  await expect(page.getByRole('status').filter({ hasText: "This device can't draw this style; showing Atlas." })).toBeVisible();
  await expect(page.locator('.view-flat path.land')).toHaveCount(1);
});
