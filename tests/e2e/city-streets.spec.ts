import { expect, test } from '@playwright/test';
import boxesJson from '../../src/map/data/city/boxes.json' with { type: 'json' };
import { expectNoAxeViolations, openPage, pageErrors, setFlatView, setMapStyle, waitForTexture } from './helpers';

/** Every count and every measurement here is taken at one size, so the numbers in the report can be reproduced. */
test.use({ viewport: { width: 1280, height: 720 } });

/*
 * The street layer inside a city close-up box (Places up close spec §5): roads by class, railways, water and green
 * areas over the photo, with the street names. Drawn in all four styles — in Atlas and Political without a photo
 * under them (planning ruling R14) — and dropped on its own if it ever fails, like the other vector layers.
 */
const STYLES = ['atlas', 'physical', 'satellite', 'political'] as const;
const fit = (b: { west: number; east: number; south: number; north: number }) =>
  Math.min(360 / (b.east - b.west), 180 / (b.north - b.south));

for (const style of STYLES) {
  test(`the street map is drawn in ${style}, with a photo only where the spec says`, async ({ page }) => {
    test.setTimeout(90_000);
    const b = boxesJson.boxes.find((x) => x.id === 'katowice')!;
    await openPage(page, 'en/lab', '?test');
    await setMapStyle(page, style);
    if (style === 'physical' || style === 'satellite') await waitForTexture(page, 'flat');
    await setFlatView(page, b.lat, b.lon, fit(b));
    const streets = page.locator('.view-flat g.streets[data-city-box="katowice"]');
    await expect(streets).toHaveCount(1);
    await expect(streets.locator('path.road.c0')).toHaveCount(1);
    // The main network at the fit zoom; the ordinary streets (class 4) are held back past it by the Task 8
    // ruling, so that the photograph shows through the view a pupil arrives at, and they come on zooming in.
    await expect(streets.locator('path.road.c3')).toHaveCount(1);
    await expect(streets.locator('path.road.c4')).toHaveCount(0);
    await setFlatView(page, b.lat, b.lon, 5300);
    await expect(streets.locator('path.road.c4')).toHaveCount(1);
    await setFlatView(page, b.lat, b.lon, fit(b));
    // Every road has a casing under it, so a junction reads as roads crossing rather than a pile of strokes.
    await expect(streets.locator('path.road-casing')).toHaveCount(await streets.locator('path.road').count());
    // Planning ruling R14: the photo layer only exists for the two texture styles.
    await expect(page.locator('.view-flat canvas.texture')).toHaveCount(style === 'physical' || style === 'satellite' ? 1 : 0);
    // Political paints its own country colours: the park and water washes are left out there.
    await expect(streets.locator('path.green')).toHaveCount(style === 'political' ? 0 : 1);
    await expect(page.locator('.view-flat text.street-name').first()).toBeVisible();
    expect(pageErrors(page)).toEqual([]);
  });
}

test('every one of the twelve boxes draws a street map at its fit zoom', async ({ page }) => {
  test.setTimeout(180_000);
  await openPage(page, 'en/lab', '?test');
  for (const b of boxesJson.boxes) {
    await setFlatView(page, b.lat, b.lon, fit(b));
    await expect(page.locator(`.view-flat g.streets[data-city-box="${b.id}"]`), b.id).toHaveCount(1);
    await expect(page.locator('.view-flat g.streets path.road'), b.id).not.toHaveCount(0);
    await expect(page.locator('.view-flat text.street-name').first(), b.id).toBeVisible();
  }
  expect(pageErrors(page)).toEqual([]);
});

test('outside a box, and zoomed out, there is no street layer at all', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await setFlatView(page, 50.26, 19.02, 12);           // the Atlas baseline scene's own view
  await expect(page.locator('.view-flat g.streets')).toHaveCount(0);
  await expect(page.locator('.view-flat text.street-name')).toHaveCount(0);
  await setFlatView(page, 12.5, 40.5, 4000);           // open desert
  await expect(page.locator('.view-flat g.streets')).toHaveCount(0);
});

test('a broken street layer drops only itself, and the map keeps working (spec §5)', async ({ page }) => {
  const b = boxesJson.boxes.find((x) => x.id === 'katowice')!;
  await openPage(page, 'en/lab', '?test&vector=fail');
  await setFlatView(page, b.lat, b.lon, fit(b));
  await expect(page.locator('.view-flat g.streets')).toHaveCount(0);
  await expect(page.locator('.view-flat text.street-name')).toHaveCount(0);
  await expect(page.locator('.view-flat svg[role="group"] .grid')).toHaveCount(1);
  await expect(page.locator('.view-flat [data-point-handle]')).toHaveCount(1);
});

/*
 * "A failure in the street layer disables that layer only." The street layer draws in all four styles, so it must
 * not raise the shared vector-fail health event: that one is Political's and Physical's, and it means "this device
 * cannot draw this style, showing Atlas". Satellite is the sharpest test of it — neither of those two layers is
 * even mounted there, so before this was separated, a close-up failing in Satellite switched the pupil to Atlas
 * the moment they chose Political, and told them their device was at fault.
 */
test('a street failure leaves Political and Physical alone, with no fallback note', async ({ page }) => {
  test.setTimeout(90_000);
  const b = boxesJson.boxes.find((x) => x.id === 'katowice')!;
  await openPage(page, 'en/lab', '?test&streets=fail');   // this layer alone, not all three
  await setMapStyle(page, 'satellite');
  await waitForTexture(page, 'flat');
  await setFlatView(page, b.lat, b.lon, fit(b));
  await expect(page.locator('.view-flat g.streets')).toHaveCount(0);
  const styles = () => page.evaluate(() => {
    const s = (window as unknown as { __mapState: { chosenMapStyle: string; mapStyle: string; drawnMapStyle: string } }).__mapState;
    return { chosen: s.chosenMapStyle, effective: s.mapStyle, drawn: s.drawnMapStyle };
  });
  for (const style of ['political', 'physical'] as const) {
    await setMapStyle(page, style);
    if (style === 'physical') await waitForTexture(page, 'flat');
    await expect.poll(styles, `${style} survives a street failure`).toEqual({ chosen: style, effective: style, drawn: style });
    await expect(page.locator('.view-flat .frame')).toHaveAttribute('data-map-style', style);
    await expect(page.locator('.style-note').first()).toHaveText('');
  }
  // …and the two layers that *are* allowed to raise it still draw.
  await setMapStyle(page, 'political');
  await expect(page.locator('.view-flat g.political')).toHaveCount(1);
});

/**
 * Every pair of drawn names that really share pixels, measured with `getBBox` — the letters themselves, in the
 * SVG's own units. Not `getBoundingClientRect`, which adds each name's halo stroke and so has two names "touching"
 * wherever their halos brush past one another. This is the only assertion in the suite that can catch a bad label
 * *width*: the unit tests compare each label's box against the same model that produced it, so a width the model
 * underestimates looks perfectly clear to them and only the drawn glyphs tell the truth.
 */
async function overlappingNames(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => {
    const svg = document.querySelector('.view-flat svg')!;
    const texts = [...svg.querySelectorAll<SVGTextElement>('text')]
      .map((t) => ({ text: t.textContent ?? '', street: t.classList.contains('street-name'), b: t.getBBox() }))
      .filter((t) => t.b.width > 0);
    const hits: string[] = [];
    for (let i = 0; i < texts.length; i++) {
      for (let j = i + 1; j < texts.length; j++) {
        const a = texts[i]!, c = texts[j]!;
        if (!a.street && !c.street) continue;      // two lesson labels are somebody else's layout
        if (a.b.x < c.b.x + c.b.width && c.b.x < a.b.x + a.b.width && a.b.y < c.b.y + c.b.height && c.b.y < a.b.y + a.b.height) {
          hits.push(`${a.text} / ${c.text}`);
        }
      }
    }
    return hits;
  });
}

// Katowice is Latin, Tokyo is Japanese and Arabic-free, Giza is Arabic: three width models in one assertion.
// A Japanese glyph is a full em wide where a Latin letter is about 0.62, and the label layout believed otherwise
// until this test was written — 12 of Tokyo's 47 names overlapped each other and one sat on an edge number.
const CROWDED = [
  { id: 'katowice', at: null },
  { id: 'tokyo', at: null },
  { id: 'tokyo', at: { lat: 35.6775, lon: 139.698, zoom: 7013 } },
  { id: 'giza', at: null },
] as const;

for (const scene of CROWDED) {
  const name = `${scene.id}${scene.at ? ` deep (zoom ${scene.at.zoom})` : ' at its fit zoom'}`;
  test(`no name overlaps another in ${name} — the lesson's own always win (ruling R19)`, async ({ page }) => {
    const b = boxesJson.boxes.find((x) => x.id === scene.id)!;
    await openPage(page, 'en/lab', '?test');
    if (scene.at) await setFlatView(page, scene.at.lat, scene.at.lon, scene.at.zoom);
    else await setFlatView(page, b.lat, b.lon, fit(b));
    await expect(page.locator('.view-flat text.street-name').first()).toBeVisible();
    expect(await overlappingNames(page)).toEqual([]);
    expect(pageErrors(page)).toEqual([]);
  });
}

test('the globe draws the street layer too, where it can reach it', async ({ page }) => {
  // The globe's ceiling is zoom 60, which `ViewCtx` reports as a flat-map 120: past CITY_STREET_ZOOM, so the box's
  // main roads are drawn, and short of PLACE_NAME_ZOOM, so no names — a smudge of motorways on the ball, which is
  // all that fits there. Every other assertion in this file queries the flat map; this one walks the globe's own
  // projection path through the same layer.
  const b = boxesJson.boxes.find((x) => x.id === 'katowice')!;
  await openPage(page, 'en/lab', '?test');
  await page.evaluate(([lat, lon]) => {
    const s = (window as unknown as { __mapState: { rotate: [number, number]; globeZoom: number } }).__mapState;
    s.rotate = [-lon, -lat];
    s.globeZoom = 60;
  }, [b.lat, b.lon] as const);
  await expect(page.locator(`.view-globe g.streets[data-city-box="${b.id}"]`)).toHaveCount(1);
  await expect(page.locator('.view-globe g.streets path.road.c0')).toHaveCount(1);
  await expect(page.locator('.view-globe text.street-name')).toHaveCount(0);
  expect(pageErrors(page)).toEqual([]);
});

test('axe is clean inside a box, in every style and both themes', async ({ page }) => {
  test.setTimeout(180_000);
  const b = boxesJson.boxes.find((x) => x.id === 'katowice')!;
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const style of STYLES) {
      await openPage(page, 'en/lab', '?test');
      await setMapStyle(page, style);
      if (style === 'physical' || style === 'satellite') await waitForTexture(page, 'flat');
      await setFlatView(page, b.lat, b.lon, fit(b));
      await expect(page.locator('.view-flat g.streets')).toHaveCount(1);
      await expectNoAxeViolations(page, `close-up ${style} ${scheme}`);
    }
  }
});
