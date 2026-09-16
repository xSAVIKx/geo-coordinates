import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

test('lab Seasons mode: the orbit sets the date by keyboard; globe, map and readout follow', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await page.evaluate(() => { (window as unknown as { __mapState: { sun: unknown } }).__mapState.sun = { utcMinutes: 720, dayOfYear: 80, year: 2026 }; });
  const toggle = page.getByRole('button', { name: 'Seasons mode' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  const earth = page.getByRole('slider', { name: 'Date on the Earth\'s orbit' });
  // English dates keep the app's own `Intl.DateTimeFormat('en', …)` order (month first), the same as the lab's date slider.
  await expect(earth).toHaveAttribute('aria-valuetext', 'March 21');
  await earth.focus();
  for (let i = 0; i < 3; i++) await page.keyboard.press('PageUp');
  await expect(earth).toHaveAttribute('aria-valuetext', 'June 21, June solstice');
  await expect(page.getByRole('slider', { name: 'Day of the year' })).toHaveAttribute('aria-valuetext', /June 21/);
  const readout = page.getByRole('region', { name: 'Seasons at the point' });
  // The lab's point is Katowice snapped to whole degrees (50°N): 16 h 09 min on 21 June.
  await expect(readout).toContainText(/Day length\s*16 h 09 min/);
  await expect(readout).toContainText('Sun overhead at 23°26′N');
  await expect(readout).toContainText('Polar day north of 66°34′N');
  await expect(readout).toContainText('Polar night south of 66°34′S');
  await page.keyboard.press('End');
  await expect(earth).toHaveAttribute('aria-valuetext', 'December 31');
  await page.keyboard.press('Home');
  await expect(earth).toHaveAttribute('aria-valuetext', 'January 1');
  await page.keyboard.press('ArrowLeft');
  await expect(earth).toHaveAttribute('aria-valuenow', '1');
  await expectNoAxeViolations(page, 'lab seasons');
  await toggle.click();
  await expect(earth).toHaveCount(0);
  expect(pageErrors(page)).toEqual([]);
});

test('dragging the Earth to the left of the Sun gives June; a point in the Arctic reads polar day', async ({ page }) => {
  await openPage(page, 'en/lab', '?test');
  await page.evaluate(() => { const s = (window as unknown as { __mapState: { sun: unknown; setPoint(p: object): void; pointEditable: boolean } }).__mapState; s.sun = { utcMinutes: 720, dayOfYear: 80, year: 2026 }; s.setPoint({ lat: 75, lon: 20 }); });
  await page.getByRole('button', { name: 'Seasons mode' }).click();
  const svg = page.locator('.view-orbit svg');
  const box = (await svg.boundingBox())!;
  // The orbit's left end (June) in view units is (320 − 250, 196) of a 640 × 350 viewBox.
  await page.mouse.move(box.x + box.width * (70 / 640), box.y + box.height * (196 / 350));
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByRole('slider', { name: 'Date on the Earth\'s orbit' })).toHaveAttribute('aria-valuetext', /June/);
  await expect(page.getByRole('region', { name: 'Seasons at the point' })).toContainText('Polar day: the Sun does not set');
});

test('the Seasons readout in Polish and Ukrainian notation', async ({ page }) => {
  await openPage(page, 'uk/lab', '?test');
  await page.evaluate(() => { (window as unknown as { __mapState: { sun: unknown } }).__mapState.sun = { utcMinutes: 720, dayOfYear: 355, year: 2026 }; });
  await page.getByRole('button', { name: 'Режим пір року' }).click();
  const readout = page.getByRole('region', { name: 'Пори року в точці' });
  await expect(readout).toContainText(/Сонце в зеніті над 23°26′\s?пд\.\s?ш\./);
  await expect(readout).toContainText(/7 год 51 хв/); // 50°N on 21 December
});

// Near an equinox the polar circles shrink onto the poles, and "Polar day south of 89°57′S" tells a pupil nothing:
// SeasonsReadout prints seasons.equinoxNoPolar instead while |declination| < 1°. In 2026 that is day 79 (20 March,
// declination −0.04°, the lab's own key date); day 82 (23 March) is 1.14° — the first day back outside the threshold.
const EQUINOX_TEXT = {
  en: { readout: 'Seasons at the point', equinox: 'No polar day or night: the Sun is over the equator', polar: /Polar day north of 88°\d\d′N/, notPolar: /Polar day north of/ },
  pl: { readout: 'Pory roku w punkcie', equinox: 'Nie ma dnia ani nocy polarnej: Słońce jest nad równikiem', polar: /Dzień polarny na północ od 88°\d\d′N/, notPolar: /Dzień polarny na północ od/ },
  uk: { readout: 'Пори року в точці', equinox: 'Немає полярного дня чи ночі: Сонце над екватором', polar: /Полярний день на північ від 88°\d\d′\s?пн\.\s?ш\./, notPolar: /Полярний день на північ від/ },
} as const;

for (const [lang, text] of Object.entries(EQUINOX_TEXT)) {
  test(`at an equinox the readout says the Sun is over the equator, not a polar circle at the pole (${lang})`, async ({ page }) => {
    await openPage(page, `${lang}/lab`, '?test');
    const setDay = (d: number) => page.evaluate((day) => { const s = (window as unknown as { __mapState: { sun: { utcMinutes: number; dayOfYear: number; year: number } | null } }).__mapState; s.sun = { utcMinutes: 720, dayOfYear: day, year: 2026 }; }, d);
    await setDay(79);
    await page.locator('.seasons-toggle').click();
    const readout = page.getByRole('region', { name: text.readout });
    await expect(readout).toContainText(text.equinox);
    await expect(readout).not.toContainText(text.notPolar);
    await setDay(82);
    await expect(readout).toContainText(text.polar);
    await expect(readout).not.toContainText(text.equinox);
    expect(pageErrors(page)).toEqual([]);
  });
}

test('on a phone the orbit is one of the views, and nothing scrolls sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await openPage(page, 'pl/lab');
  await page.getByRole('button', { name: 'Tryb pór roku' }).click();
  await page.getByRole('button', { name: 'Orbita' }).click();
  await expect(page.getByRole('slider', { name: 'Data na orbicie Ziemi' })).toBeVisible();
  const hit = await page.locator('.view-orbit .earth .hit').boundingBox();
  expect(Math.min(hit!.width, hit!.height)).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await expectNoAxeViolations(page, 'lab seasons phone');
});
