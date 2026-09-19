import { expect, test, type Page } from '@playwright/test';
import boxesJson from '../../src/map/data/city/boxes.json' with { type: 'json' };
import { expectNoAxeViolations, openPage, pageErrors, setMapStyle, waitForTexture } from './helpers';

/*
 * The design, UX and accessibility gate across the twelve close-up boxes (Places up close, Task 8): box × style ×
 * theme × width, plus the two layout guarantees the close-up work rests on — that a street name never leaves the
 * box it belongs to (ruling R19's reservation model), and that the list is reachable and tappable on a phone.
 */
const STYLES = ['atlas', 'physical', 'satellite', 'political'] as const;
const go = (page: Page, id: string) =>
  page.evaluate((i) => (window as unknown as { __mapState: { showCityBox(id: string): unknown } }).__mapState.showCityBox(i), id);

for (const style of STYLES) {
  for (const scheme of ['light', 'dark'] as const) {
    test(`WCAG AA inside a close-up box: ${style}, ${scheme}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.emulateMedia({ colorScheme: scheme });
      await openPage(page, 'en/lab', '?test');
      await setMapStyle(page, style);
      if (style === 'physical' || style === 'satellite') await waitForTexture(page, 'flat');
      for (const id of ['katowice', 'greenwich', 'manhattan']) {
        await go(page, id);
        await expect(page.locator(`.view-flat g.streets[data-city-box="${id}"]`)).toHaveCount(1);
        await expectNoAxeViolations(page, `${id} ${style} ${scheme}`);
      }
      expect(pageErrors(page)).toEqual([]);
    });
  }
}

test('AAA in presenter mode inside a box', async ({ page }) => {
  const AxeBuilder = (await import('@axe-core/playwright')).default;
  await openPage(page, 'en/lab', '?test');
  await setMapStyle(page, 'satellite');
  await waitForTexture(page, 'flat');
  await go(page, 'katowice');
  await page.locator('body').press('p');
  await expect(page.locator('html')).toHaveAttribute('data-presenter', 'true');
  const r = await new AxeBuilder({ page }).withRules(['color-contrast-enhanced']).analyze();
  expect(r.violations.flatMap((v) => v.nodes.map((n) => n.target.join(' ')))).toEqual([]);
});

/*
 * Axe on a *scrolled* page with a close-up open, at the bottom of it — where the list, the teaching note and the
 * credit line are, and where a pupil who has just read them actually leaves the page.
 *
 * Two earlier runs (close-up-places.spec.ts, schools.spec.ts) were pinned to `scrollTo(0, 0)` because a 44 px map
 * toolbar button caught half under the sticky header is reported by axe's target-size rule as obscured. Task 8
 * swept the scroll positions and found three ~40 px windows on a 1 819 px page, then did the arithmetic: with an
 * obscuring band [a, b] and a target of height H, the larger unobscured strip is max(a - top, top + H - b), which
 * stays under 24 px for a window of scroll positions (b - a) + 48 - H px wide. The header's own widgets are
 * 44 px tall and so are the toolbar's, so that window is 48 px wherever the header puts them — flush to the top,
 * flush to the bottom or centred — and a taller header band only makes it wider. There is no header offset and
 * no scroll-margin that removes it; what a scroll-margin (and the `scroll-padding-top` base.css already has) does
 * remove is the case WCAG 2.4.11 is actually about, keyboard focus, which the next test holds.
 */
for (const width of [375, 1366]) {
  test(`axe on a scrolled page with a close-up open (${width} px)`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 768 });
    await openPage(page, 'en/lab', '?test');
    await go(page, 'rovaniemi');
    await page.locator('details.close-ups > summary').click();
    await expect(page.locator('.close-up-note')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    expect(await page.evaluate(() => window.scrollY), 'the page really is scrolled').toBeGreaterThan(0);
    await expectNoAxeViolations(page, `scrolled lab, close-up open, ${width} px`);
    expect(pageErrors(page)).toEqual([]);
  });
}

/*
 * WCAG 2.2 AA 2.4.11, Focus Not Obscured: the criterion the pinned runs above were filed under. It is about
 * keyboard focus, and `html { scroll-padding-top: calc(var(--header-h) + 0.5rem) }` in base.css is what keeps it:
 * every scroll the browser makes to bring a focused control into view stops below the sticky header. Measured
 * here on every button in both map toolbars, on a page long enough to scroll, so a change to the header's height
 * or to that padding cannot quietly break it.
 */
test('a focused map-toolbar button is never left under the sticky header', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await go(page, 'katowice');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const overlapping = await page.evaluate(() => {
    const out: string[] = [];
    const bar = document.querySelector('header.bar')!.getBoundingClientRect();
    for (const b of document.querySelectorAll<HTMLElement>('.view-globe .toolbar button, .view-flat .toolbar button')) {
      b.focus();
      const r = b.getBoundingClientRect();
      if (r.top < bar.bottom && r.bottom > bar.top) out.push(`${b.getAttribute('aria-label') ?? b.textContent?.trim()} at ${r.top.toFixed(1)}, header to ${bar.bottom.toFixed(1)}`);
    }
    return out;
  });
  expect(overlapping).toEqual([]);
});

for (const width of [320, 375, 768, 1366]) {
  test(`no horizontal scroll at ${width} px with a close-up open`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 800 });
    for (const lang of ['en', 'pl', 'uk'] as const) {
      await openPage(page, `${lang}/lab`, '?test');
      await go(page, 'mitaddelmundo');
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${lang} ${width}`).toBeLessThanOrEqual(width);
    }
  });
}

test('the close-up list is keyboard operable and its targets are 44 px on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  // `?test` only so the last assertion can read the map's zoom back; nothing on the way there uses it.
  await openPage(page, 'en/lab', '?test');
  const summary = page.locator('details.close-ups > summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  const buttons = page.getByRole('button', { name: /up close$/ });
  await expect(buttons).toHaveCount(12);
  for (const size of await buttons.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.width, r.height, e.textContent?.trim()]; }))) {
    expect(size[1] as number, String(size[2])).toBeGreaterThanOrEqual(44);
  }
  const summaryBox = (await summary.boundingBox())!;
  expect(summaryBox.height).toBeGreaterThanOrEqual(44);
  await buttons.first().focus();
  await page.keyboard.press('Enter');
  // Not merely "moved": the fit zooms of the twelve are 2 659 to 5 009, so a keyboard Enter really took the map
  // down to the streets rather than nudging it.
  expect(await page.evaluate(() => (window as unknown as { __mapState: { flat: { zoom: number } } }).__mapState?.flat.zoom ?? 0)).toBeGreaterThan(2000);
});

test('the twelve boxes all draw something in every style, with no page errors', async ({ page }) => {
  test.setTimeout(240_000);
  await openPage(page, 'en/lab', '?test');
  for (const style of STYLES) {
    await setMapStyle(page, style);
    if (style === 'physical' || style === 'satellite') await waitForTexture(page, 'flat');
    for (const b of boxesJson.boxes) {
      await go(page, b.id);
      await expect(page.locator('.view-flat g.streets path.road').first(), `${b.id} ${style}`).toBeVisible();
    }
  }
  expect(pageErrors(page)).toEqual([]);
});

/*
 * Ruling R19 — a street name never covers a lesson name — rests entirely on the width `streetLabelWidth` reserves
 * for a name, and that model charges 0.74 em to every character outside the square-body CJK ranges. It was fitted
 * against the scripts the twelve boxes carry. This measures the scripts a thirteenth box could bring, in the page,
 * at the street font, with the browser's own `getComputedTextLength`, so the bucket is a measured claim and not an
 * assumption. The numbers are in the comment above `streetLabelWidth`; the floor here is the claim itself.
 */
test('the label width model reserves at least the ink of every script a box could bring', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  const measured = await page.evaluate(() => {
    const svg = document.querySelector('.view-flat svg')!;
    const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    t.setAttribute('font-size', '10');
    t.setAttribute('font-family', getComputedStyle(document.documentElement).getPropertyValue('--font'));
    svg.appendChild(t);
    const samples: Record<string, string> = {
      latin: 'Sokolska', cyrillic: 'Хрещатик', greek: 'Λεωφόρος', arabic: 'شارع الهرم',
      devanagari: 'मार्ग', hebrew: 'רחוב הרצל', thai: 'ถนนสุขุมวิท', tibetan: 'ལྷ་ས་གྲོང་ལམ',
      khmer: 'ផ្លូវព្រះ', myanmar: 'လမ်းမကြီး', ethiopic: 'መንገድ', georgian: 'რუსთაველის',
      armenian: 'Մաշտոցի', hangul: '스트리트', japanese: '渋谷三丁目',
    };
    const out: Record<string, { text: string; ink: number }> = {};
    for (const [k, s] of Object.entries(samples)) { t.textContent = s; out[k] = { text: s, ink: t.getComputedTextLength() }; }
    t.remove();
    return out;
  });
  // The model's two buckets, restated here rather than imported: pulling styleLabels.ts into the Playwright
  // process drags src/i18n/i18n.svelte.ts and its JSON in with it. tests/unit/street-labels.test.ts holds
  // `streetLabelWidth` to these same two numbers, so the pair cannot drift apart.
  const GENERIC = 0.74, SQUARE = 1.05;
  const SQUARE_SCRIPTS = new Set(['hangul', 'japanese']);
  let drawn = 0;
  for (const [script, { text, ink }] of Object.entries(measured)) {
    // A script whose font is missing on the runner draws nothing at all; that measures nothing, so skip it
    // rather than pass on an empty box.
    if (ink <= 0) continue;
    drawn++;
    const emPerChar = ink / 10 / [...text].length;
    expect(emPerChar, `${script}: ${ink.toFixed(1)} px of ink over ${[...text].length} characters`)
      .toBeLessThanOrEqual(SQUARE_SCRIPTS.has(script) ? SQUARE : GENERIC);
  }
  expect(drawn, 'most of the scripts have to be drawable to be measured').toBeGreaterThanOrEqual(10);
});
