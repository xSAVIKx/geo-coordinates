import { readFileSync, statSync } from 'node:fs';
import { formatBreakdown, sizeBreakdown } from './size-report.ts';

// Map styles spec §7: the single file stays under 5 MiB (textures included).
const LIMIT = 5_242_880;
const FILE = 'dist/geo-coordinates.html';
const size = statSync(FILE).size;
const html = readFileSync(FILE, 'utf8');
console.log(`${FILE}: ${(size / 1024).toFixed(1)} KiB of ${(LIMIT / 1024).toFixed(0)} KiB`);
if (size >= LIMIT) {
  console.error(`Size budget exceeded (${size} >= ${LIMIT}):\n${formatBreakdown(sizeBreakdown(html), size)}`);
  process.exit(1);
}
console.log(formatBreakdown(sizeBreakdown(html), size));

// The third-party licence notices (scripts/licence-notices.ts) travel with the file: the Svelte (MIT) and ISC notices
// and the Natural Earth and NASA Earth Observatory notes, in a comment at the top.
const head = html.slice(0, 20_000);
const missing = [/^<!doctype html>\n<!--\nThird-party licences\n/i, /^svelte \d+\.\d+\.\d+ \(MIT\)/m, /^d3-geo \d+\.\d+\.\d+ \(ISC\)/m, /^topojson-client \d+\.\d+\.\d+ \(ISC\)/m,
  /^world-atlas \d+\.\d+\.\d+ \(ISC\)/m, /Permission to use, copy, modify, and\/or distribute this software/, /^Natural Earth map data \(Public domain\)/m,
  /^NASA Earth Observatory images \(Public domain\)/m]
  .filter((re) => !re.test(head));
if (missing.length) { console.error(`Licence notices missing from ${FILE}: ${missing.join(', ')}`); process.exit(1); }
console.log(`${FILE}: third-party licence notices present`);
