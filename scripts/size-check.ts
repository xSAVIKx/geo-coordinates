import { readFileSync, statSync } from 'node:fs';
import { formatBreakdown, sizeBreakdown, SIZE_LIMIT_BYTES } from './size-report.ts';

const LIMIT = SIZE_LIMIT_BYTES;
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
const head = html.slice(0, 40_000);
const missing = [/^<!doctype html>\n<!--\nThird-party licences\n/i, /^svelte \d+\.\d+\.\d+ \(MIT\)/m, /^d3-geo \d+\.\d+\.\d+ \(ISC\)/m, /^topojson-client \d+\.\d+\.\d+ \(ISC\)/m,
  /^world-atlas \d+\.\d+\.\d+ \(ISC\)/m, /Permission to use, copy, modify, and\/or distribute this software/, /^Natural Earth map data \(Public domain\)/m,
  /^NASA Earth Observatory images \(Public domain\)/m,
  /^Copernicus Sentinel-2 imagery \(Free, full and open\)/m,
  /^OpenStreetMap \(ODbL 1\.0\)/m,
  /^GUGiK ORTOFOTOMAPA \(Geoportal regulations\)/m,
  /^IGN BD ORTHO \(Licence Ouverte Etalab 2\.0\)/m,
  /^GSI seamlessphoto \(GSI tile terms\)/m,
  /^USDA-FSA NAIP \(Public domain\)/m]
  .filter((re) => !re.test(head));
if (missing.length) { console.error(`Licence notices missing from ${FILE}: ${missing.join(', ')}`); process.exit(1); }
console.log(`${FILE}: third-party licence notices present`);
