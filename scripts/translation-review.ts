import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildReviewHtml } from './translation-review-lib.ts';

const load = (l: string) => JSON.parse(readFileSync(`src/i18n/${l}.json`, 'utf8')) as Record<string, string>;
mkdirSync('dist', { recursive: true });
writeFileSync('dist/translation-review.html', buildReviewHtml({ en: load('en'), pl: load('pl'), uk: load('uk') }));
console.log('wrote dist/translation-review.html');
