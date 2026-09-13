import { describe, expect, test } from 'vitest';
import en from '../../src/i18n/en.json';
import pl from '../../src/i18n/pl.json';
import uk from '../../src/i18n/uk.json';
import { detectLang, i18n, t, tn } from '../../src/i18n/i18n.svelte';
import { renderText } from '../../src/i18n/text';
import { spokenLat, spokenLon } from '../../src/i18n/spoken';

const files = { en, pl, uk } as Record<string, Record<string, string>>;
const REQUIRED_FORMS: Record<string, string[]> = { en: ['one', 'other'], pl: ['one', 'few', 'many', 'other'], uk: ['one', 'few', 'many', 'other'] };
const base = (k: string) => k.split('#')[0]!;
const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

describe('message files', () => {
  test('same base keys in every language', () => {
    const sets = Object.values(files).map((f) => [...new Set(Object.keys(f).map(base))].sort());
    expect(sets[1]).toEqual(sets[0]);
    expect(sets[2]).toEqual(sets[0]);
  });
  test('plural keys have all forms required by the language', () => {
    for (const [lang, f] of Object.entries(files)) {
      const plurals = new Set(Object.keys(f).filter((k) => k.includes('#')).map(base));
      for (const b of plurals) for (const form of REQUIRED_FORMS[lang]!) expect(f, `${lang}:${b}#${form}`).toHaveProperty(`${b}#${form}`);
    }
  });
  test('same parameters across languages', () => {
    for (const key of Object.keys(en)) {
      if (key.includes('#')) continue;
      expect(params(pl[key as keyof typeof pl] ?? ''), `pl:${key}`).toBe(params(en[key as keyof typeof en]));
      expect(params(uk[key as keyof typeof uk] ?? ''), `uk:${key}`).toBe(params(en[key as keyof typeof en]));
    }
  });
  test('no empty strings', () => {
    for (const [lang, f] of Object.entries(files)) for (const [k, v] of Object.entries(f)) expect(v.trim(), `${lang}:${k}`).not.toBe('');
  });
});

describe('runtime', () => {
  test('detectLang', () => {
    expect(detectLang(['uk-UA', 'en'])).toBe('uk');
    expect(detectLang(['pl-PL'])).toBe('pl');
    expect(detectLang(['ru-RU'])).toBe('uk');
    expect(detectLang(['de-DE', 'pl'])).toBe('pl');
    expect(detectLang(['fr'])).toBe('en');
  });
  test('t and tn', () => {
    i18n.lang = 'pl';
    expect(tn('unit.degree', 1)).toBe('1 stopień');
    expect(tn('unit.degree', 3)).toBe('3 stopnie');
    expect(tn('unit.degree', 5)).toBe('5 stopni');
    expect(tn('unit.degree', 22)).toBe('22 stopnie');
    expect(tn('unit.degree', 1.5)).toBe('1.5 stopnia');
    i18n.lang = 'uk';
    expect(tn('unit.degree', 21)).toBe('21 градус');
    expect(tn('unit.degree', 11)).toBe('11 градусів');
    i18n.lang = 'en';
    expect(t('missing.key')).toBe('missing.key');
  });
  test('renderText with coord params', () => {
    expect(renderText({ key: 'spoken.zero', params: { amount: { coord: { lat: 52, lon: 21 } } } }, 'uk')).toBe('52° пн. ш., 21° сх. д.');
    expect(renderText({ key: 'spoken.zero', params: { amount: { coord: { lat: 52, lon: 21 }, axis: 'lon' } } }, 'en')).toBe('21°E');
    expect(renderText({ key: 'spoken.zero', params: { amount: 333.6 } }, 'pl')).toBe('333,6');
    expect(renderText({ key: 'spoken.zero', params: { amount: 2224 } }, 'uk')).toBe('2224');
    expect(renderText({ key: 'spoken.zero', params: { amount: 333.6 } }, 'en')).toBe('333.6');
  });
  test('spoken', () => {
    expect(spokenLat(52, 'en')).toBe('52 degrees north');
    expect(spokenLat(0, 'en')).toBe('0 degrees');
    expect(spokenLon(-1, 'pl')).toBe('1 stopień na zachód');
    expect(spokenLat(52 + 14 / 60, 'uk', 'minute')).toBe('52 градуси 14 хвилин північної широти');
  });
});
