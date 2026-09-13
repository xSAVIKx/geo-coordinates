import { expect, test, type Page } from '@playwright/test';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

type Practice = { question: { type: string; input: { kind: string; precision?: 'degree' | 'minute' }; answer: { kind: string; index?: number; value?: { lat: number; lon: number } | number; minutes?: number } } };
const current = (page: Page) => page.evaluate(() => (window as unknown as { __practice: Practice }).__practice);

// The question lives inside the QuestionCard <form class="card">; the Difficulty fieldset
// above it also renders <input type="radio"> elements, so a page-wide getByRole('radio')
// would pick those up instead of the question's own choices. Scope to the card.
const card = (page: Page) => page.locator('form.card');

async function answerCorrectlyWithKeyboard(page: Page) {
  const { question } = await current(page);
  const a = question.answer;
  if (a.kind === 'choice') {
    const radios = card(page).getByRole('radio');
    await radios.nth(0).focus();
    for (let i = 0; i < a.index!; i++) await page.keyboard.press('ArrowDown');
    if (a.index === 0) await page.keyboard.press('Space');
  } else if (a.kind === 'clock') {
    const m = a.minutes!;
    await card(page).getByRole('textbox').first().fill(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  } else if (a.kind === 'number') {
    await card(page).getByRole('textbox').focus();
    await page.keyboard.type(String(a.value));
  } else if (a.kind === 'coords' && question.input.kind === 'coords') {
    const v = a.value as { lat: number; lon: number };
    const text = (n: number, pos: string, neg: string) => {
      const abs = Math.abs(n);
      const d = Math.floor(abs + 1e-9);
      const m = Math.round((abs - d) * 60);
      const body = m ? `${d}°${String(m).padStart(2, '0')}′` : `${d}`;
      return n === 0 || abs === 180 ? body : `${body}${n > 0 ? pos : neg}`;
    };
    const inputs = card(page).getByRole('textbox');
    if (await inputs.count() > 0) {
      await inputs.nth(0).focus();
      await page.keyboard.type(text(v.lat, 'N', 'S'));
      await page.keyboard.press('Tab');
      await page.keyboard.type(text(v.lon, 'E', 'W'));
    } else {
      const lat = page.getByRole('slider', { name: 'Latitude' });
      const lon = page.getByRole('slider', { name: 'Longitude' });
      const now = await current(page);
      void now;
      const readPoint = () => page.evaluate(() => (window as unknown as { __mapState: { point: { lat: number; lon: number } } }).__mapState.point);
      // Shift+arrow is the big step: 1° with minute precision, 10° with degree precision.
      const big = question.input.precision === 'minute' ? 1 : 10;
      let p = await readPoint();
      await lat.focus();
      while (Math.abs(p.lat - v.lat) > 1e-6) {
        const gap = Math.abs(p.lat - v.lat);
        await page.keyboard.press(`${gap >= big ? 'Shift+' : ''}${p.lat < v.lat ? 'ArrowUp' : 'ArrowDown'}`);
        p = await readPoint();
      }
      await lon.focus();
      while (Math.abs(p.lon - v.lon) > 1e-6) {
        const gap = Math.abs(p.lon - v.lon);
        await page.keyboard.press(`${gap >= big ? 'Shift+' : ''}${p.lon < v.lon ? 'ArrowRight' : 'ArrowLeft'}`);
        p = await readPoint();
      }
    }
  }
  await page.keyboard.press('Enter');
}

for (const topic of [1, 2, 3, 4, 5, 6, 7, 8]) {
  test(`topic ${topic}: a full keyboard-only round scores 10/10`, async ({ page }) => {
    test.setTimeout(120_000);
    await openPage(page, `en/topic-${topic}/practice`, '?test');
    for (let i = 0; i < 10; i++) {
      await answerCorrectlyWithKeyboard(page);
      // "Correct!" also appears in the assertive live region announcement; scope to the
      // card's own feedback so the assertion targets the visible verdict, not the announcement.
      await expect(card(page).getByText('Correct!', { exact: true })).toBeVisible();
      if (i === 0) await expectNoAxeViolations(page, `topic ${topic} feedback`);
      await page.keyboard.press('Enter');
    }
    await expect(page.getByRole('heading', { name: 'Round complete' })).toBeFocused();
    await expect(page.getByText('You got 10 out of 10')).toBeVisible();
    expect(pageErrors(page)).toEqual([]);
  });
}

test('a wrong answer shows the mistake and the correct answer', async ({ page }) => {
  await openPage(page, 'en/topic-3/practice', '?test');
  const { question } = await current(page);
  const v = question.answer.value as { lat: number; lon: number };
  const inputs = card(page).getByRole('textbox');
  await inputs.nth(0).fill(`${Math.abs(v.lat)}${v.lat > 0 ? 'S' : 'N'}`);
  await inputs.nth(1).fill(`${Math.abs(v.lon)}${v.lon > 0 ? 'E' : 'W'}`);
  await page.getByRole('button', { name: 'Check' }).click();
  // "Not quite" (and the mistake/answer text) is also announced via the live region, so
  // scope to the card's own feedback to avoid a strict-mode double match.
  await expect(card(page).getByText('Not quite')).toBeVisible();
  await expect(card(page).getByText(/Check the letter: N means north/)).toBeVisible();
  await expect(card(page).getByText(/^Correct answer:/)).toBeVisible();
});

test('reduced motion: the solution overlays render without the reveal animation classes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openPage(page, 'en/topic-3/practice', '?test');
  const { question } = await current(page);
  const v = question.answer.value as { lat: number; lon: number };
  const inputs = card(page).getByRole('textbox');
  await inputs.nth(0).fill(`${Math.abs(v.lat)}${v.lat > 0 ? 'S' : 'N'}`);
  await inputs.nth(1).fill(`${Math.abs(v.lon)}${v.lon > 0 ? 'E' : 'W'}`);
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(card(page).getByText(/^Correct answer:/)).toBeVisible();
  // The correct-answer marker and the wrong-guess marker both land on the map.
  await expect(page.locator('.marker')).toHaveCount(2);
  await expect(page.locator('.marker .reveal')).toHaveCount(0);
  await expect(page.locator('path[pathLength]')).toHaveCount(0);
});

test('a wrong choice answer marks the correct option with a check and the chosen one with a cross', async ({ page }) => {
  await openPage(page, 'en/topic-1/practice', '?test');
  const { question } = await current(page);
  expect(question.answer.kind).toBe('choice');
  const correct = question.answer.index!;
  const options = card(page).locator('label.choice');
  const wrong = (correct + 1) % (await options.count());
  await card(page).getByRole('radio').nth(wrong).check();
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(options.nth(correct)).toHaveClass(/correct/);
  await expect(options.nth(correct).locator('.badge.ok')).toHaveText('✓');
  await expect(options.nth(correct).getByText('(correct)')).toBeAttached();
  await expect(options.nth(wrong)).toHaveClass(/wrong/);
  await expect(options.nth(wrong).locator('.badge.bad')).toHaveText('✗');
  await expect(options.nth(wrong).getByText('(wrong)')).toBeAttached();
  await expectNoAxeViolations(page, 'choice wrong answer badges');
});

test('topic 6: adding on the same side gets the "you added" hint and the bracket shows the difference', async ({ page }) => {
  await openPage(page, 'en/topic-6/practice', '?test');
  const q = await page.evaluate(() => (window as unknown as { __practice: { question: { answer: { value: number }; meta: { method: string; x: number; y: number } } } }).__practice.question);
  expect(q.meta.method).toBe('same-subtract'); // easy differences stay on one side of the line
  await card(page).getByRole('textbox').fill(String(q.meta.x + q.meta.y));
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(card(page).getByText(/^You added, but both points are on the same side/)).toBeVisible();
  await expect(card(page).getByText(`Correct answer: ${q.answer.value}°`)).toBeVisible();
  await expect(page.locator('.diff text.total').first()).toHaveText(`${q.answer.value}°`);
  expect(pageErrors(page)).toEqual([]);
});

test('topic 7: an answer using 111 km per degree is accepted with a note', async ({ page }) => {
  await openPage(page, 'pl/topic-7/practice', '?test');
  const q = await page.evaluate(() => (window as unknown as { __practice: { question: { meta: { deg: number } } } }).__practice.question);
  await card(page).getByRole('textbox').fill(String(q.meta.deg * 111));
  await page.getByRole('button', { name: 'Sprawdź' }).click();
  await expect(card(page).getByText('Dobrze!', { exact: true })).toBeVisible();
  await expect(card(page).getByText(/^Liczysz 111 km na stopień/)).toBeVisible();
  await expect(page.locator('.diff text.total').first()).toHaveText(new RegExp(`^${String(Math.round(q.meta.deg * 111.2 * 10) / 10).replace('.', ',')} km$`));
});

test('submitting without an answer asks for one', async ({ page }) => {
  await openPage(page, 'pl/topic-2/practice', '?test');
  await page.getByRole('button', { name: 'Sprawdź' }).click();
  await expect(page.getByRole('alert')).toHaveText('Najpierw wybierz lub wpisz odpowiedź.');
});

test('switching difficulty at question 1 does not leave a stale selection or feedback behind', async ({ page }) => {
  // Question ids repeat across seeds/difficulties (`${type}-${i}`), so this exercises the case
  // where question 1 of the new round happens to carry the same generator id as the old one —
  // the round must still reset because Practice/QuestionCard key on a per-round key, not on
  // `question.id`.
  await openPage(page, 'en/topic-1/practice', '?test');
  const options = card(page).locator('label.choice');
  await options.nth(1).click();
  await expect(card(page).getByRole('radio').nth(1)).toBeChecked();
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(card(page).getByText(/Correct!|Not quite/)).toBeVisible();

  await page.getByRole('radio', { name: 'Medium' }).check();

  const radiosAfter = card(page).getByRole('radio');
  const count = await radiosAfter.count();
  for (let i = 0; i < count; i++) await expect(radiosAfter.nth(i)).not.toBeChecked();
  await expect(card(page).getByText('Correct!', { exact: true })).toHaveCount(0);
  await expect(card(page).getByText('Not quite', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Check' })).toBeVisible();
});

test('the best score updates live and is still shown after starting a new round at the same difficulty', async ({ page }) => {
  await openPage(page, 'en/topic-1/practice', '?test');
  for (let i = 0; i < 10; i++) {
    await answerCorrectlyWithKeyboard(page);
    await expect(card(page).getByText('Correct!', { exact: true })).toBeVisible();
    await page.keyboard.press('Enter');
  }
  await expect(page.getByRole('heading', { name: 'Round complete' })).toBeFocused();
  await page.getByRole('button', { name: 'New round' }).click();
  await expect(page.getByText('Your best: 10 out of 10')).toBeVisible();
});

test('topic 8: a clock answer the wrong way round gets the direction hint, and the typed time survives a layout switch', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await openPage(page, 'en/topic-8/practice', '?test');
  type Q = { input: { kind: string }; answer: { minutes: number }; meta: { lonA: number; lonB: number; minutesA: number } };
  let q = await page.evaluate(() => (window as unknown as { __practice: { question: Q } }).__practice.question);
  // Easy rounds mix "later" choices and clocks; move on until a clock question comes up.
  for (let i = 0; i < 9 && q.input.kind !== 'clock'; i++) {
    await answerCorrectlyWithKeyboard(page);
    await page.keyboard.press('Enter');
    q = await page.evaluate(() => (window as unknown as { __practice: { question: Q } }).__practice.question);
  }
  expect(q.input.kind).toBe('clock');
  const offset = ((((q.meta.lonB - q.meta.lonA + 540) % 360) - 180) * 4);
  const wrong = (((q.meta.minutesA - offset) % 1440) + 1440) % 1440;
  const typed = `${Math.floor(wrong / 60)}.${String(wrong % 60).padStart(2, '0')}`; // a dot works too
  await card(page).getByRole('textbox').fill(typed);
  await page.setViewportSize({ width: 600, height: 900 });
  await expect(card(page).getByRole('textbox')).toHaveValue(typed);
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect(card(page).getByRole('textbox')).toHaveValue(typed);
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(card(page).getByText(/^Wrong direction!/)).toBeVisible();
  const m = q.answer.minutes;
  await expect(card(page).getByText(`Correct answer: ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`)).toBeVisible();
  await expect(page.locator('.diff text.total').first()).toHaveText(new RegExp(`^${Math.abs(offset) / 4}°$`));
  expect(pageErrors(page)).toEqual([]);
});
