import en from '../../src/i18n/en.json';
import pl from '../../src/i18n/pl.json';
import uk from '../../src/i18n/uk.json';
import type { Text } from '../../src/i18n/text';

const FILES = { en, pl, uk } as Record<string, Record<string, string>>;

export function collectKeys(text: Text, out: string[] = []): string[] {
  out.push(text.key);
  for (const p of Object.values(text.params ?? {})) {
    if (typeof p === 'object' && p !== null) {
      if ('text' in p) collectKeys(p.text, out);
      if ('place' in p) out.push(`place.${p.place}`);
    }
  }
  return out;
}

export function missingKeys(texts: Text[]): string[] {
  const missing: string[] = [];
  for (const t of texts) for (const key of collectKeys(t)) for (const [lang, f] of Object.entries(FILES)) {
    if (!(key in f) && !(`${key}#other` in f)) missing.push(`${lang}:${key}`);
  }
  return missing;
}
