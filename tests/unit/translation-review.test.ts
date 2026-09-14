import { expect, test } from 'vitest';
import en from '../../src/i18n/en.json';
import pl from '../../src/i18n/pl.json';
import uk from '../../src/i18n/uk.json';
import { buildReviewHtml, findSuspicious } from '../../scripts/translation-review-lib';

test('flags suspicious strings', () => {
  const found = findSuspicious({
    en: { 'a.one': 'Hello', 'a.two': 'North', 'place.oslo': 'Oslo' },
    pl: { 'a.one': 'Hello', 'a.two': 'Północ', 'place.oslo': 'Oslo' },
    uk: { 'a.one': 'Привіт', 'a.two': 'North пн', 'place.oslo': 'Осло' },
  });
  expect(found).toEqual([
    { key: 'a.one', lang: 'pl', reason: 'same-as-en' },
    { key: 'a.two', lang: 'uk', reason: 'latin-in-uk' },
  ]);
});

test('real message files have no suspicious strings', () => {
  expect(findSuspicious({ en, pl, uk })).toEqual([]);
});

test('review page lists every key with lang attributes', () => {
  const html = buildReviewHtml({ en, pl, uk });
  for (const key of Object.keys(en)) expect(html).toContain(`data-key="${key}"`);
  expect(html).toContain('lang="uk"');
  expect(html).toContain('<title>');
});
