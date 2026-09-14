import { describe, expect, test } from 'vitest';
import en from '../../src/i18n/en.json';
import pl from '../../src/i18n/pl.json';
import uk from '../../src/i18n/uk.json';
import { MODULES } from '../../src/quiz/registry';

const FILES = { en, pl, uk } as Record<string, Record<string, string>>;

describe('practice hints', () => {
  test('every question type has a hint in every language', () => {
    for (const mod of MODULES) {
      for (const [lang, f] of Object.entries(FILES)) expect(f[`q.hint.${mod.type}`], `${lang}: q.hint.${mod.type}`).toBeTruthy();
    }
  });
  test('no hint key without a question type', () => {
    const types = new Set(MODULES.map((m) => m.type));
    const extra = Object.keys(en).filter((k) => k.startsWith('q.hint.') && !types.has(k.slice('q.hint.'.length) as never));
    expect(extra).toEqual([]);
  });
  test('hints carry no parameters, so they cannot reveal a question’s numbers', () => {
    for (const [lang, f] of Object.entries(FILES)) {
      for (const [k, v] of Object.entries(f)) if (k.startsWith('q.hint.')) expect(v, `${lang}:${k}`).not.toMatch(/\{\w+\}/);
    }
  });
});
