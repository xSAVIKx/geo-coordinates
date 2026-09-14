import en from './en.json';
import pl from './pl.json';
import uk from './uk.json';
import { LANGS, type LangCode } from '../geo/types';
import { readString, writeString } from '../app/storage';

export const messages: Record<LangCode, Record<string, string>> = { en, pl, uk };
export const i18n = $state<{ lang: LangCode }>({ lang: 'en' });

const warned = new Set<string>();
const pluralRules = new Map<LangCode, Intl.PluralRules>();

export function detectLang(languages: readonly string[]): LangCode {
  for (const l of languages) {
    const primary = l.toLowerCase().split('-')[0];
    if (primary === 'ru' || primary === 'be') return 'uk';
    if ((LANGS as readonly string[]).includes(primary!)) return primary as LangCode;
  }
  return 'en';
}

export function initialLang(): LangCode {
  const stored = readString('geo-coords:lang');
  if (stored && (LANGS as readonly string[]).includes(stored)) return stored as LangCode;
  return detectLang(typeof navigator === 'undefined' ? [] : navigator.languages);
}

export function setLang(lang: LangCode): void {
  i18n.lang = lang;
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  writeString('geo-coords:lang', lang);
}

/**
 * A sum in running text never breaks at its operator ("140 + 158 = 298°" never leaves "140" alone at the end of a line):
 * no-break spaces round + − × ÷ = ≈, and round the colon Polish and Ukrainian divide with ("556 : 111,2"). The same rule
 * in every language, applied to the finished text so numbers filled in from parameters are covered too.
 */
export function keepSumsTogether(s: string): string {
  return s.replace(/ ([+−×÷=≈]) /g, '\u00a0$1\u00a0').replace(/(\d) : (?=\d)/g, '$1\u00a0:\u00a0');
}

function interpolate(s: string, params?: Record<string, string | number>): string {
  if (!params) return keepSumsTogether(s);
  return keepSumsTogether(s.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m)));
}

// `lang` defaults to the current language. Passing it explicitly never mutates state,
// so t/tn/renderText are safe to call inside templates and $derived.
export function t(key: string, params?: Record<string, string | number>, lang: LangCode = i18n.lang): string {
  const msg = messages[lang][key] ?? messages.en[key];
  if (msg === undefined) {
    if (import.meta.env?.DEV && !warned.has(key)) { warned.add(key); console.warn(`i18n: missing key ${key}`); }
    return key;
  }
  return interpolate(msg, params);
}

export function tn(key: string, count: number, params?: Record<string, string | number>, lang: LangCode = i18n.lang): string {
  let rules = pluralRules.get(lang);
  if (!rules) { rules = new Intl.PluralRules(lang); pluralRules.set(lang, rules); }
  const form = rules.select(count);
  const table = messages[lang];
  const msg = table[`${key}#${form}`] ?? table[`${key}#other`];
  if (msg === undefined) return t(key, { ...params, count }, lang);
  return interpolate(msg, { ...params, count });
}
