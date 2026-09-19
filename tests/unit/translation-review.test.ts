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

/*
 * Punctuation and look-alikes: the class of drift the sheet could not see before. Six Ukrainian values were
 * carrying a straight apostrophe (U+0027) where the other eleven used U+2019 — invisible in a table read for
 * meaning, audible in a screen reader and visible on paper.
 */
test('each language keeps its own apostrophes and quotation marks', () => {
  const found = findSuspicious({
    en: { 'a.ok': "It doesn't move.", 'a.bad': 'It doesn’t move.', 'b.ok': 'He said “north”.', 'b.bad': 'He said "north".' },
    pl: { 'a.ok': 'To się nie rusza.', 'a.bad': 'To się nie rusza.', 'b.ok': 'Powiedział „połnoc”.', 'b.bad': 'Powiedział «północ».' },
    uk: { 'a.ok': 'З’єднує.', 'a.bad': "З'єднує.", 'b.ok': '«північ»', 'b.bad': '“північ”' },
  });
  expect(found).toEqual([
    { key: 'a.bad', lang: 'en', reason: 'punctuation' },
    { key: 'a.bad', lang: 'uk', reason: 'punctuation' },
    { key: 'b.bad', lang: 'en', reason: 'punctuation' },
    { key: 'b.bad', lang: 'pl', reason: 'punctuation' },
    { key: 'b.bad', lang: 'uk', reason: 'punctuation' },
  ]);
});

test('a word written in two alphabets at once is flagged in every file, English included', () => {
  // Cyrillic К in "Kraków", Cyrillic о in "Oslo", Latin i in "Київ" — identical on screen, nonsense underneath.
  const found = findSuspicious({
    en: { 'c.one': 'Кraków', 'c.two': 'Oslo' },
    pl: { 'c.one': 'Kraków', 'c.two': 'Оslo' },
    uk: { 'c.one': 'Краків', 'c.two': 'Киiв' },
  });
  expect(found).toEqual([
    { key: 'c.one', lang: 'en', reason: 'mixed-script' },
    { key: 'c.two', lang: 'pl', reason: 'cyrillic-in-pl' },
    { key: 'c.two', lang: 'uk', reason: 'latin-in-uk' },
    { key: 'c.two', lang: 'pl', reason: 'mixed-script' },
    { key: 'c.two', lang: 'uk', reason: 'mixed-script' },
  ]);
});

test('a Latin brand beside Cyrillic words is not a look-alike', () => {
  expect(findSuspicious({
    en: { 'd.one': 'Open Google Maps', 'd.two': 'GPS receiver' },
    pl: { 'd.one': 'Otwórz Google Mapy', 'd.two': 'Odbiornik GPS' },
    uk: { 'd.one': 'Відкрий Google Карти', 'd.two': 'GPS-приймач' },
  })).toEqual([]);
});

test('the CC BY licence words are allowed in the licence line only', () => {
  const found = findSuspicious({
    en: { 'cheat.foot': 'Licence: CC BY 4.0', 'other.key': 'Licence: CC BY 4.0' },
    pl: { 'cheat.foot': 'Licencja: CC BY 4.0', 'other.key': 'Licencja: CC BY 4.0' },
    uk: { 'cheat.foot': 'Ліцензія: CC BY 4.0', 'other.key': 'Ліцензія: CC BY 4.0' },
  });
  expect(found).toEqual([{ key: 'other.key', lang: 'uk', reason: 'latin-in-uk' }]);
});
