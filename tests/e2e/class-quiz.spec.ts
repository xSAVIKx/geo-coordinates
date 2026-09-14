import { expect, test } from '@playwright/test';
import { expectNoAxeViolations, openPage } from './helpers';

test('class quiz: same code gives same questions; keyboard reveals and navigates', async ({ page }) => {
  await openPage(page, 'en/class-quiz');
  await page.getByLabel(/Quiz code/).fill('5b');
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  await expect(page).toHaveURL(/class-quiz\?seed=5b$/);
  const first = await page.locator('#cq-prompt').textContent();
  await page.locator('body').press('Space');
  await expect(page.getByText(/^Answer:/)).toBeVisible();
  await expectNoAxeViolations(page, 'class quiz revealed');
  await page.locator('body').press('ArrowRight');
  // "Question 2 of 10" is also announced via the live region on a question change, so scope to
  // the visible progress line to avoid a strict-mode double match.
  await expect(page.locator('p.progress')).toHaveText('Question 2 of 10');
  await expect(page.locator('#cq-prompt')).toBeFocused();
  await expect(page.getByText(/^Answer:/)).toHaveCount(0);
  await page.locator('body').press('Escape');

  await openPage(page, 'en/class-quiz?seed=5b');
  await expect(page.getByLabel(/Quiz code/)).toHaveValue('5b');
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  await expect(page.locator('#cq-prompt')).toHaveText(first!);
});

test('class quiz timer counts down and says time is up', async ({ page }) => {
  test.setTimeout(40_000);
  await openPage(page, 'uk/class-quiz');
  await page.getByLabel('15 с').check();
  await page.getByRole('button', { name: 'Почати вікторину' }).click();
  await expect(page.getByText('Час вийшов!').first()).toBeVisible({ timeout: 20_000 });
});

test('class quiz: a language switch keeps the revealed answer of a later question, now in the new language', async ({ page }) => {
  await openPage(page, 'en/class-quiz');
  await page.getByLabel(/Quiz code/).fill('5b');
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  await page.locator('body').press('ArrowRight');
  await expect(page.locator('p.progress')).toHaveText('Question 2 of 10');
  await page.locator('body').press('Space');
  await expect(page.getByText(/^Answer:/)).toBeVisible();
  const why = await page.locator('.reveal .why').textContent();

  await page.getByRole('button', { name: /PL/ }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  await expect(page.locator('p.progress')).toHaveText('Pytanie 2 z 10');
  await expect(page.getByText(/^Odpowiedź:/)).toBeVisible();
  await expect(page.locator('.reveal .why')).toBeVisible();
  await expect(page.locator('.reveal .why')).not.toHaveText(why!);
  await expect(page.getByRole('button', { name: 'Pokaż odpowiedź' })).toBeDisabled();
  // The language switch leaves focus where it was (on the switch), not back on the question.
  await expect(page.locator('#cq-prompt')).not.toBeFocused();
  // A moment later (after any re-run would have happened) the answer is still shown.
  await page.waitForTimeout(300);
  await expect(page.getByText(/^Odpowiedź:/)).toBeVisible();
});

test('class quiz: the same code gives the same questions whatever order the topics were ticked in', async ({ page }) => {
  const prompts = async () => {
    const out: string[] = [];
    for (let n = 1; n <= 10; n++) {
      out.push((await page.locator('#cq-prompt').textContent())!);
      if (n < 10) await page.locator('body').press('ArrowRight');
    }
    return out;
  };
  await openPage(page, 'en/class-quiz');
  await page.getByLabel(/Quiz code/).fill('order1');
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  const inOrder = await prompts();

  await page.goto('about:blank');
  await openPage(page, 'en/class-quiz');
  await page.getByLabel(/Quiz code/).fill('order1');
  // Untick and tick topics 1 and 2 again: they are now last in tick order.
  for (const id of ['1', '2']) {
    const box = page.locator(`form.setup input[type="checkbox"][value="${id}"]`);
    await box.uncheck();
    await box.check();
  }
  await page.getByRole('button', { name: 'Start the quiz' }).click();
  expect(await prompts()).toEqual(inOrder);
});
