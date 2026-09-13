import { statSync } from 'node:fs';
const LIMIT = 1_048_576;
const size = statSync('dist/geo-coordinates.html').size;
console.log(`dist/geo-coordinates.html: ${(size / 1024).toFixed(1)} KiB`);
if (size >= LIMIT) { console.error(`Size budget exceeded (${size} >= ${LIMIT})`); process.exit(1); }
