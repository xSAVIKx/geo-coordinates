import { describe, expect, test } from 'vitest';
import { LANGS } from '../../src/geo/types';
import { COUNTRY_NAME_OVERRIDES, countryLabels, countryName } from '../../src/map/political';

/*
 * Task 20's readability pass over the Political style's country names (planning ruling R22). `Intl.DisplayNames`
 * gives a handful of names a school map should not show — the disambiguated Congos, the brackets of
 * "Myanmar (Burma)", "Hong Kong SAR China", "Côte d’Ivoire" in English and Polish, and the full-length Polish and
 * Ukrainian names of South Africa. Every one of them belongs to a country that is labelled from zoom 4 or below,
 * so a pupil meets it on the first world map they open.
 */
describe('country names on the Political map', () => {
  const byA2 = new Map(countryLabels().map((l) => [l.a2, l]));

  test('every override replaces the Intl name, in the language it is written for', () => {
    const cases: [string, string, string][] = [
      ['en', 'CD', 'DR Congo'], ['en', 'CG', 'Congo'], ['en', 'MM', 'Myanmar'], ['en', 'HK', 'Hong Kong'], ['en', 'CI', 'Ivory Coast'],
      ['pl', 'CD', 'DR Konga'], ['pl', 'MM', 'Mjanma'], ['pl', 'HK', 'Hongkong'], ['pl', 'CI', 'Wybrzeże Kości Słoniowej'], ['pl', 'ZA', 'RPA'],
      ['uk', 'CD', 'ДР Конго'], ['uk', 'CG', 'Конго'], ['uk', 'MM', 'Мʼянма'], ['uk', 'HK', 'Гонконг'], ['uk', 'ZA', 'ПАР'],
    ];
    for (const [lang, a2, name] of cases) {
      expect(countryName(a2, lang as 'en' | 'pl' | 'uk'), `${lang} ${a2}`).toBe(name);
      expect(new Intl.DisplayNames([lang], { type: 'region' }).of(a2), `${lang} ${a2} still needs the override`).not.toBe(name);
    }
    // The table holds these and nothing else: anything else Intl names well enough is left to Intl.
    expect(cases.length).toBe(LANGS.reduce((n, l) => n + Object.keys(COUNTRY_NAME_OVERRIDES[l] ?? {}).length, 0));
  });

  test('every country the table names is one a pupil meets at world zoom', () => {
    for (const lang of LANGS) {
      for (const a2 of Object.keys(COUNTRY_NAME_OVERRIDES[lang] ?? {})) {
        expect(byA2.get(a2)?.minZoom, `${lang} ${a2}`).toBeLessThanOrEqual(4);
      }
    }
  });

  test('no name on a world map reads as a note, a bracket or an unlocalised exonym', () => {
    for (const lang of LANGS) {
      for (const l of countryLabels()) {
        if (l.minZoom > 4) continue;
        const name = countryName(l.a2, lang);
        expect(name, `${lang} ${l.a2}`).not.toMatch(/[(–]|\bSAR\b|Côte d’Ivoire/);
      }
    }
  });
});
