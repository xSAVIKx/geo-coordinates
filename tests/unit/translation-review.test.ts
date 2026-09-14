import { expect, test } from 'vitest';
import en from '../../src/i18n/en.json';
import pl from '../../src/i18n/pl.json';
import uk from '../../src/i18n/uk.json';
import { buildReviewHtml, findInfoNotes, findSuspicious } from '../../scripts/translation-review-lib';

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

test('short Latin tokens are caught in Ukrainian, not just 3+ letter words', () => {
  const found = findSuspicious({
    en: { 'k.dist': '5 km to school', 'k.utc': 'at 12:00 UTC', 'k.pole': 'Point 52N' },
    pl: { 'k.dist': '5 km do szkoły', 'k.utc': 'o 12:00 UTC', 'k.pole': 'Punkt 52N' },
    uk: {
      'k.dist': '5 km до школи',
      'k.utc': 'о 12:00 UTC',
      'k.pole': 'Точка 52N',
    },
  });
  expect(found).toEqual([
    { key: 'k.dist', lang: 'uk', reason: 'latin-in-uk' },
    { key: 'k.pole', lang: 'uk', reason: 'latin-in-uk' },
  ]);
});

test('findInfoNotes flags allowed foreign terms without marking them suspicious, but not place names', () => {
  const messages = {
    en: { 'a.brand': 'Open Google Maps', 'map.projection.equal-earth': 'Equal Earth', 'place.oslo': 'Oslo' },
    pl: { 'a.brand': 'Otwórz Google Mapy', 'map.projection.equal-earth': 'Equal Earth', 'place.oslo': 'Oslo' },
    uk: { 'a.brand': 'Відкрий Google Карти', 'map.projection.equal-earth': 'Equal Earth', 'place.oslo': 'Осло' },
  };
  expect(findSuspicious(messages)).toEqual([]);
  const notes = findInfoNotes(messages);
  expect(notes).toContainEqual({ key: 'a.brand', lang: 'uk' });
  expect(notes).toContainEqual({ key: 'map.projection.equal-earth', lang: 'pl' });
  expect(notes).toContainEqual({ key: 'map.projection.equal-earth', lang: 'uk' });
  expect(notes.some((n) => n.key === 'place.oslo')).toBe(false);
});

test('GitHub brand name is allowed as info-note Latin text in Ukrainian', () => {
  const messages = {
    en: { 'footer.github': '{name} on GitHub' },
    pl: { 'footer.github': '{name} na GitHubie' },
    uk: { 'footer.github': '{name} на GitHub' },
  };
  expect(findSuspicious(messages)).toEqual([]);
  expect(findInfoNotes(messages)).toContainEqual({ key: 'footer.github', lang: 'uk' });
});

test('review page lists every key with lang attributes', () => {
  const html = buildReviewHtml({ en, pl, uk });
  for (const key of Object.keys(en)) expect(html).toContain(`data-key="${key}"`);
  expect(html).toContain('lang="uk"');
  expect(html).toContain('<title>');
});
