import type { Page } from '@playwright/test';

export type Practice = { question: { type: string; input: { kind: string; precision?: 'degree' | 'minute' }; answer: { kind: string; index?: number; value?: { lat: number; lon: number } | number; minutes?: number } } };
export const current = (page: Page) => page.evaluate(() => (window as unknown as { __practice: Practice }).__practice);

// The question lives inside the QuestionCard <form class="card">; the Difficulty fieldset
// above it also renders <input type="radio"> elements, so a page-wide getByRole('radio')
// would pick those up instead of the question's own choices. Scope to the card.
export const card = (page: Page) => page.locator('form.card');

export async function answerCorrectlyWithKeyboard(page: Page) {
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
