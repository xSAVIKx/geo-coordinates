# Part 1 — Foundation (Tasks 1–5)

Read `README.md` (Global Constraints, Shared contracts) first.

---

### Task 1: Project scaffold and single-file build

**Files:**
- Create: `package.json`, `tsconfig.json`, `svelte.config.js`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `geo-coordinates.html`, `.gitignore`, `src/main.ts`, `src/app/App.svelte`, `src/styles/tokens.css`, `src/styles/base.css`, `scripts/shot.ts`, `tests/unit/smoke.test.ts`, `tests/e2e/helpers.ts`, `tests/e2e/offline.spec.ts`

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `check`, `test`, `e2e`, `shot`; `tests/e2e/helpers.ts` exports `openPage(page, hash): Promise<void>` (opens built file offline) and `DIST_FILE` constant.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "geo-coordinates-viz",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build && node --experimental-strip-types scripts/size-check.ts",
    "check": "svelte-check --tsconfig ./tsconfig.json --fail-on-warnings",
    "test": "vitest run",
    "e2e": "playwright test",
    "shot": "node --experimental-strip-types scripts/shot.ts"
  }
}
```

Then install exact major lines:

```bash
npm i -D vite@^8.0.0 svelte@^5.57.0 @sveltejs/vite-plugin-svelte@^7.0.0 typescript@~6.0.3 svelte-check@^4.7.0 \
  vite-plugin-singlefile@^2.3.0 vitest@^5.0.0 @playwright/test@1.63.0 @axe-core/playwright@^4.11.0 @types/node@^24
npm i d3-geo@^3.1.1 topojson-client@^3.1.0 world-atlas@^2.0.2
npm i -D @types/d3-geo@^3.1.0 @types/topojson-client@^3.1.5 @types/geojson
```

Playwright's Chromium 1243 is already installed in `~/.cache/ms-playwright`; do not run `playwright install`.

- [ ] **Step 2: Config files**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "types": ["node", "vite/client"],
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src", "tests", "scripts", "*.ts"]
}
```

`svelte.config.js`:
```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
export default { preprocess: vitePreprocess() };
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [svelte(), viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: { input: 'geo-coordinates.html' },
  },
});
```
(`emptyOutDir: false` keeps `dist/translation-review.html` from Task 19.)

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  test: { include: ['tests/unit/**/*.test.ts'], environment: 'node' },
});
```

`playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
});
```

`.gitignore`:
```
node_modules/
test-results/
playwright-report/
shots/
.vite/
```
(`dist/` is intentionally **not** ignored.)

- [ ] **Step 3: Entry HTML, main, App, base styles**

`geo-coordinates.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>Coordinates · Współrzędne · Координати</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts`:
```ts
import { mount } from 'svelte';
import './styles/tokens.css';
import './styles/base.css';
import App from './app/App.svelte';

mount(App, { target: document.getElementById('app')! });
```

`src/app/App.svelte` (temporary; replaced in Task 6):
```svelte
<main id="main"><h1>Coordinates</h1></main>
```

`src/styles/tokens.css` — the full design token set; later tasks only add tokens here:
```css
:root {
  --font: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Ubuntu, sans-serif;
  --fs-base: 1rem;
  --fs-scale: 1;
  --space-1: 0.25rem; --space-2: 0.5rem; --space-3: 0.75rem; --space-4: 1rem; --space-6: 1.5rem; --space-8: 2rem;
  --radius: 0.75rem;
  --tap: 44px;

  --bg: #f7f5ef;
  --surface: #ffffff;
  --surface-2: #eef2f6;
  --text: #1b2430;
  --text-muted: #4a5666;
  --border: #c9d1db;
  --focus: #0b57d0;
  --accent: #0b57d0;
  --accent-contrast: #ffffff;
  --ok: #1a7f37;
  --bad: #b3261e;

  --ocean: #d8e9f5;
  --land: #e9dfc7;
  --land-stroke: #9a8b6a;
  --grid: #7d93a8;
  --equator: #c2410c;
  --prime: #6d28d9;
  --antimeridian: #0f766e;
  --tropics: #a16207;
  --hemi-a: rgb(11 87 208 / 0.14);
  --hemi-b: rgb(194 65 12 / 0.14);
  --marker-a: #0b57d0;
  --marker-b: #c2410c;
  --marker-c: #6d28d9;
  --marker-d: #0f766e;
  --marker-answer: #1a7f37;
  --marker-wrong: #b3261e;
  --night: rgb(8 16 40 / 0.55);
  --twilight: rgb(8 16 40 / 0.28);
  --sun: #f59e0b;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #10151c; --surface: #18202a; --surface-2: #222c38; --text: #eef2f6; --text-muted: #b6c2d0;
    --border: #3a4756; --focus: #8ab4f8; --accent: #8ab4f8; --accent-contrast: #0b1320;
    --ok: #6fdd8b; --bad: #ff8a80;
    --ocean: #16324a; --land: #3b3a2e; --land-stroke: #a59d7c; --grid: #8aa2b8;
    --equator: #fb923c; --prime: #c4b5fd; --antimeridian: #5eead4; --tropics: #facc15;
    --hemi-a: rgb(138 180 248 / 0.18); --hemi-b: rgb(251 146 60 / 0.18);
    --marker-a: #8ab4f8; --marker-b: #fb923c; --marker-c: #c4b5fd; --marker-d: #5eead4;
    --marker-answer: #6fdd8b; --marker-wrong: #ff8a80;
  }
}
:root[data-theme="dark"] {
  --bg: #10151c; --surface: #18202a; --surface-2: #222c38; --text: #eef2f6; --text-muted: #b6c2d0;
  --border: #3a4756; --focus: #8ab4f8; --accent: #8ab4f8; --accent-contrast: #0b1320;
  --ok: #6fdd8b; --bad: #ff8a80;
  --ocean: #16324a; --land: #3b3a2e; --land-stroke: #a59d7c; --grid: #8aa2b8;
  --equator: #fb923c; --prime: #c4b5fd; --antimeridian: #5eead4; --tropics: #facc15;
  --hemi-a: rgb(138 180 248 / 0.18); --hemi-b: rgb(251 146 60 / 0.18);
  --marker-a: #8ab4f8; --marker-b: #fb923c; --marker-c: #c4b5fd; --marker-d: #5eead4;
  --marker-answer: #6fdd8b; --marker-wrong: #ff8a80;
}
:root[data-large-text="true"] { --fs-scale: 1.25; }
```

`src/styles/base.css`:
```css
*, *::before, *::after { box-sizing: border-box; }
html { font-family: var(--font); font-size: calc(100% * var(--fs-scale)); color: var(--text); background: var(--bg); -webkit-text-size-adjust: 100%; }
body { margin: 0; min-height: 100dvh; line-height: 1.5; }
button, input, select { font: inherit; color: inherit; }
button { min-height: var(--tap); min-width: var(--tap); cursor: pointer; }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
.visually-hidden { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }
:root[data-reduced-motion="true"] *, :root[data-reduced-motion="true"] *::before, :root[data-reduced-motion="true"] *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
```

- [ ] **Step 4: Size check and screenshot scripts**

`scripts/size-check.ts`:
```ts
import { statSync } from 'node:fs';
const LIMIT = 1_048_576;
const size = statSync('dist/geo-coordinates.html').size;
console.log(`dist/geo-coordinates.html: ${(size / 1024).toFixed(1)} KiB`);
if (size >= LIMIT) { console.error(`Size budget exceeded (${size} >= ${LIMIT})`); process.exit(1); }
```

`scripts/shot.ts` — usage `npm run shot -- "<hash>" <name> [theme]`, writes `shots/<name>-<w>x<h>.png` at 375×667 and 1366×768:
```ts
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const [hash = 'en/', name = 'shot', theme = 'light'] = process.argv.slice(2);
const file = 'file://' + resolve('dist/geo-coordinates.html');
mkdirSync('shots', { recursive: true });
const browser = await chromium.launch();
for (const [w, h] of [[375, 667], [1366, 768]] as const) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: theme === 'dark' ? 'dark' : 'light' });
  await page.goto(`${file}#${hash}`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `shots/${name}-${w}x${h}.png`, fullPage: true });
  await page.close();
}
await browser.close();
console.log(`saved shots/${name}-*.png`);
```

- [ ] **Step 5: Smoke tests**

`tests/unit/smoke.test.ts`:
```ts
import { expect, test } from 'vitest';
test('toolchain runs', () => { expect(1 + 1).toBe(2); });
```

`tests/e2e/helpers.ts`:
```ts
import type { Page } from '@playwright/test';
import { resolve } from 'node:path';

export const DIST_FILE = resolve('dist/geo-coordinates.html');

export async function openPage(page: Page, hash = 'en/'): Promise<void> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.context().route('**/*', (route) =>
    route.request().url().startsWith('file:') ? route.continue() : route.abort());
  await page.goto(`file://${DIST_FILE}#${hash}`);
  await page.waitForSelector('#main');
  (page as Page & { __errors?: string[] }).__errors = errors;
}

export function pageErrors(page: Page): string[] {
  return (page as Page & { __errors?: string[] }).__errors ?? [];
}
```

`tests/e2e/offline.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { openPage, pageErrors } from './helpers';

test('built single file renders offline with no network requests', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) external.push(r.url()); });
  await openPage(page, 'en/');
  await expect(page.locator('#main')).toBeVisible();
  expect(external).toEqual([]);
  expect(pageErrors(page)).toEqual([]);
});
```

- [ ] **Step 6: Run everything**

Run: `npm run check && npm test && npm run build && npm run e2e`
Expected: svelte-check 0 errors 0 warnings; 1 unit test passes; build prints size (a few KiB) and `dist/geo-coordinates.html` exists; 1 e2e test passes.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Svelte + Vite single-file build with unit and e2e harness"
```

---

### Task 2: Coordinate types, formatting and parsing

**Files:**
- Create: `src/geo/types.ts`, `src/geo/format.ts`
- Test: `tests/unit/format.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `LangCode`, `LANGS`, `LatLon`, `Precision`, `Axis` (verbatim from README).
  - `normalizeLon(lon: number): number` → (−180, 180]
  - `clampLat(lat: number): number` → [−90, 90]
  - `roundTo(value: number, precision: Precision): number` — whole degree or whole minute (1/60)
  - `toDegMin(value: number): { deg: number; min: number }` — absolute value, minutes rounded, 60′ carried
  - `formatLat(lat: number, lang: LangCode, precision?: Precision): string`
  - `formatLon(lon: number, lang: LangCode, precision?: Precision): string`
  - `formatLatLon(p: LatLon, lang: LangCode, precision?: Precision): string` — joined with `", "`
  - `parseAngle(input: string, axis: Axis): number | null`

- [ ] **Step 1: Write `src/geo/types.ts`** (copy the block from README "Shared contracts").

- [ ] **Step 2: Write the failing tests** `tests/unit/format.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { clampLat, formatLat, formatLatLon, formatLon, normalizeLon, parseAngle, roundTo, toDegMin } from '../../src/geo/format';

describe('normalize', () => {
  test.each([[0, 0], [180, 180], [-180, 180], [190, -170], [-190, 170], [360, 0], [540, 180], [-45, -45]])('normalizeLon(%d) = %d', (i, o) => {
    expect(normalizeLon(i)).toBe(o);
  });
  test('clampLat', () => { expect(clampLat(95)).toBe(90); expect(clampLat(-91)).toBe(-90); expect(clampLat(12.5)).toBe(12.5); });
  test('roundTo', () => { expect(roundTo(52.26, 'degree')).toBe(52); expect(roundTo(52.2334, 'minute')).toBeCloseTo(52 + 14 / 60, 9); });
  test('toDegMin carries 60 minutes', () => {
    expect(toDegMin(52.2334)).toEqual({ deg: 52, min: 14 });
    expect(toDegMin(-21.9999)).toEqual({ deg: 22, min: 0 });
  });
});

describe('format', () => {
  test('en/pl degrees', () => {
    for (const lang of ['en', 'pl'] as const) {
      expect(formatLat(52, lang)).toBe('52°N');
      expect(formatLat(-34, lang)).toBe('34°S');
      expect(formatLon(21, lang)).toBe('21°E');
      expect(formatLon(-58, lang)).toBe('58°W');
    }
  });
  test('uk degrees', () => {
    expect(formatLat(52, 'uk')).toBe('52° пн. ш.');
    expect(formatLat(-34, 'uk')).toBe('34° пд. ш.');
    expect(formatLon(21, 'uk')).toBe('21° сх. д.');
    expect(formatLon(-58, 'uk')).toBe('58° зх. д.');
  });
  test('boundaries have no letter', () => {
    expect(formatLat(0, 'en')).toBe('0°');
    expect(formatLon(0, 'uk')).toBe('0°');
    expect(formatLon(180, 'pl')).toBe('180°');
    expect(formatLon(-180, 'en')).toBe('180°');
    expect(formatLat(90, 'en')).toBe('90°N');
    expect(formatLat(-90, 'uk')).toBe('90° пд. ш.');
  });
  test('minutes', () => {
    expect(formatLat(52 + 14 / 60, 'en', 'minute')).toBe('52°14′N');
    expect(formatLon(-(21 + 5 / 60), 'uk', 'minute')).toBe('21°05′ зх. д.');
    expect(formatLat(0.2, 'pl', 'minute')).toBe('0°12′N');
  });
  test('degree precision rounds', () => { expect(formatLat(51.6, 'en')).toBe('52°N'); });
  test('formatLatLon', () => {
    expect(formatLatLon({ lat: 52, lon: 21 }, 'en')).toBe('52°N, 21°E');
    expect(formatLatLon({ lat: 50, lon: 30 }, 'uk')).toBe('50° пн. ш., 30° сх. д.');
  });
});

describe('parseAngle', () => {
  test.each([
    ['52N', 'lat', 52], ['52 N', 'lat', 52], ['52°N', 'lat', 52], ['52° N', 'lat', 52], ['52°s', 'lat', -52],
    ['52° пн. ш.', 'lat', 52], ['52 пд', 'lat', -52], ['21° сх. д.', 'lon', 21], ['21 зх', 'lon', -21],
    ['52°14′N', 'lat', 52 + 14 / 60], ["52°14'N", 'lat', 52 + 14 / 60], ['52 14 N', 'lat', 52 + 14 / 60],
    ['0', 'lat', 0], ['0°', 'lon', 0], ['180', 'lon', 180], ['180°E', 'lon', 180], ['180°W', 'lon', 180],
    ['-21', 'lon', -21], ['21e', 'lon', 21], ['  21 , E ', 'lon', 21], ['52,5N', 'lat', 52.5],
  ] as const)('%s (%s) -> %d', (input, axis, expected) => {
    expect(parseAngle(input, axis)).toBeCloseTo(expected, 9);
  });
  test.each([
    ['52E', 'lat'], ['21N', 'lon'], ['91N', 'lat'], ['181E', 'lon'], ['52°60′N', 'lat'], ['abc', 'lat'], ['', 'lon'],
    ['52', 'lat'], ['21', 'lon'], ['-5N', 'lat'],
  ] as const)('rejects %s (%s)', (input, axis) => {
    expect(parseAngle(input, axis)).toBeNull();
  });
});
```

Note on the last group: a non-zero value **without** a direction letter and without a minus sign is rejected (`'52'`), because on the test the letter is required. `'-21'` is accepted as a signed decimal.

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run tests/unit/format.test.ts`
Expected: FAIL — cannot resolve `../../src/geo/format`.

- [ ] **Step 4: Implement `src/geo/format.ts`**

```ts
import type { Axis, LangCode, LatLon, Precision } from './types';

const EPS = 1e-9;

export function normalizeLon(lon: number): number {
  let l = ((lon % 360) + 360) % 360; // [0, 360)
  if (l > 180) l -= 360;                // (-180, 180]
  return l === 0 ? 0 : l;               // turn -0 into 0
}

export function clampLat(lat: number): number {
  return Math.max(-90, Math.min(90, lat));
}

export function roundTo(value: number, precision: Precision): number {
  return precision === 'degree' ? Math.round(value) : Math.round(value * 60) / 60;
}

export function toDegMin(value: number): { deg: number; min: number } {
  const totalMin = Math.round(Math.abs(value) * 60);
  return { deg: Math.floor(totalMin / 60), min: totalMin % 60 };
}

const LETTERS: Record<LangCode, { N: string; S: string; E: string; W: string; sep: string }> = {
  en: { N: 'N', S: 'S', E: 'E', W: 'W', sep: '' },
  pl: { N: 'N', S: 'S', E: 'E', W: 'W', sep: '' },
  uk: { N: 'пн. ш.', S: 'пд. ш.', E: 'сх. д.', W: 'зх. д.', sep: ' ' },
};

function body(value: number, precision: Precision): { text: string; isZero: boolean; deg: number; min: number } {
  if (precision === 'degree') {
    const deg = Math.round(Math.abs(value));
    return { text: `${deg}°`, isZero: deg === 0, deg, min: 0 };
  }
  const { deg, min } = toDegMin(value);
  return { text: `${deg}°${String(min).padStart(2, '0')}′`, isZero: deg === 0 && min === 0, deg, min };
}

export function formatLat(lat: number, lang: LangCode, precision: Precision = 'degree'): string {
  const b = body(clampLat(lat), precision);
  if (b.isZero) return b.text;
  const L = LETTERS[lang];
  return `${b.text}${L.sep}${lat > 0 ? L.N : L.S}`;
}

export function formatLon(lon: number, lang: LangCode, precision: Precision = 'degree'): string {
  const n = normalizeLon(lon);
  const b = body(n, precision);
  if (b.isZero || (b.deg === 180 && b.min === 0)) return b.text;
  const L = LETTERS[lang];
  return `${b.text}${L.sep}${n > 0 ? L.E : L.W}`;
}

export function formatLatLon(p: LatLon, lang: LangCode, precision: Precision = 'degree'): string {
  return `${formatLat(p.lat, lang, precision)}, ${formatLon(p.lon, lang, precision)}`;
}

// Direction tokens, lower-cased, matched at the end of the input.
const DIRS: { re: RegExp; axis: Axis; sign: 1 | -1 }[] = [
  { re: /(?:пн|півн)[.\s]*(?:ш[.\s]*)?$/u, axis: 'lat', sign: 1 },
  { re: /(?:пд|півд)[.\s]*(?:ш[.\s]*)?$/u, axis: 'lat', sign: -1 },
  { re: /(?:сх)[.\s]*(?:д[.\s]*)?$/u, axis: 'lon', sign: 1 },
  { re: /(?:зх)[.\s]*(?:д[.\s]*)?$/u, axis: 'lon', sign: -1 },
  { re: /n$/u, axis: 'lat', sign: 1 },
  { re: /s$/u, axis: 'lat', sign: -1 },
  { re: /e$/u, axis: 'lon', sign: 1 },
  { re: /w$/u, axis: 'lon', sign: -1 },
];

export function parseAngle(input: string, axis: Axis): number | null {
  let s = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;
  let sign: 1 | -1 | 0 = 0;
  for (const d of DIRS) {
    if (d.re.test(s)) {
      if (d.axis !== axis) return null;
      sign = d.sign;
      s = s.replace(d.re, '').trim().replace(/[,\s]+$/, '');
      break;
    }
  }
  const m = /^(-)?\s*(\d+(?:[.,]\d+)?)\s*°?\s*(?:(\d+(?:[.,]\d+)?)\s*[′']?)?$/u.exec(s);
  if (!m) return null;
  const negative = m[1] === '-';
  if (negative && sign !== 0) return null;
  const deg = Number(m[2]!.replace(',', '.'));
  const min = m[3] ? Number(m[3].replace(',', '.')) : 0;
  if (min >= 60) return null;
  const abs = deg + min / 60;
  const max = axis === 'lat' ? 90 : 180;
  if (abs > max + EPS) return null;
  if (sign === 0 && !negative && abs > EPS && !(axis === 'lon' && Math.abs(abs - 180) < EPS)) return null;
  if (axis === 'lon' && Math.abs(abs - 180) < EPS) return 180;
  const signed = (negative || sign === -1 ? -1 : 1) * abs;
  return signed === 0 ? 0 : signed;
}
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run tests/unit/format.test.ts`
Expected: PASS. If a case fails, fix the implementation, not the test — the tests encode spec §4.3 and §5.3. (Watch `'  21 , E '`: the trailing comma/space strip after removing the direction handles it; `'52,5N'` uses a decimal comma, the Polish/Ukrainian convention.)

- [ ] **Step 6: Check and commit**

```bash
npm run check && npm test
git add src/geo tests/unit/format.test.ts
git commit -m "feat(geo): coordinate formatting and parsing for en/pl/uk"
```

---

### Task 3: Relative position, differences, distance and solar time

**Files:**
- Create: `src/geo/compare.ts`, `src/geo/distance.ts`, `src/geo/time.ts`
- Test: `tests/unit/compare.test.ts`, `tests/unit/distance-time.test.ts`

**Interfaces:**
- Consumes: `normalizeLon` from `src/geo/format.ts`; `LatLon` from `src/geo/types.ts`.
- Produces:
  - `hemisphereLat(lat: number): 'N' | 'S' | null`, `hemisphereLon(lon: number): 'E' | 'W' | null` (null on 0°, and on 180° for lon)
  - `relativeToParallel(lat: number, parallel: number): 'north' | 'south' | 'on'`
  - `relativeToMeridian(lon: number, meridian: number): 'east' | 'west' | 'on' | 'opposite'`
  - `latDifference(a: number, b: number): number`
  - `lonDifference(a: number, b: number): number` — ≤ 180
  - `lonDifferenceMethod(a: number, b: number): 'same-subtract' | 'opposite-add' | 'opposite-over-180' | 'zero-line'`
  - `latDifferenceMethod(a: number, b: number): 'same-subtract' | 'opposite-add' | 'zero-line'`
  - `extremeIndex(points: readonly LatLon[], dir: 'N' | 'S' | 'E' | 'W'): number` — index of the furthest point; E/W compares raw longitude values (callers guarantee no 180° span)
  - `spansAntimeridian(lons: readonly number[]): boolean` — true when the smallest arc containing all points crosses 180°
  - `KM_PER_DEGREE = 111.2`, `meridianDistanceKm(latA: number, latB: number, kmPerDegree?: number): number`, `degreesForDistance(km: number, kmPerDegree?: number): number`
  - `MINUTES_PER_DEGREE = 4`, `MINUTES_PER_DAY = 1440`, `wrapDayMinutes(m: number): number`, `solarOffsetMinutes(fromLon: number, toLon: number): number` (signed, uses the shorter way, east positive), `localSolarMinutes(utcMinutes: number, lon: number): number`, `formatClock(minutes: number): string` (`"HH:MM"`), `lonDifferenceForMinutes(minutes: number): number`

- [ ] **Step 1: Write the failing tests**

`tests/unit/compare.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { extremeIndex, hemisphereLat, hemisphereLon, latDifference, latDifferenceMethod, lonDifference, lonDifferenceMethod, relativeToMeridian, relativeToParallel, spansAntimeridian } from '../../src/geo/compare';

describe('hemispheres', () => {
  test('lat', () => { expect(hemisphereLat(10)).toBe('N'); expect(hemisphereLat(-1)).toBe('S'); expect(hemisphereLat(0)).toBeNull(); });
  test('lon', () => { expect(hemisphereLon(10)).toBe('E'); expect(hemisphereLon(-170)).toBe('W'); expect(hemisphereLon(0)).toBeNull(); expect(hemisphereLon(180)).toBeNull(); expect(hemisphereLon(-180)).toBeNull(); });
});

describe('relative position', () => {
  test('parallel', () => { expect(relativeToParallel(52, 50)).toBe('north'); expect(relativeToParallel(-10, 0)).toBe('south'); expect(relativeToParallel(20, 20)).toBe('on'); });
  test('meridian', () => {
    expect(relativeToMeridian(21, 20)).toBe('east');
    expect(relativeToMeridian(-10, 20)).toBe('west');
    expect(relativeToMeridian(20, 20)).toBe('on');
    expect(relativeToMeridian(170, -170)).toBe('west');   // shorter way crosses 180°
    expect(relativeToMeridian(-160, 0)).toBe('west');
    expect(relativeToMeridian(180, 0)).toBe('opposite');
  });
});

describe('differences', () => {
  test('latitude', () => {
    expect(latDifference(52, 20)).toBe(32); expect(latDifferenceMethod(52, 20)).toBe('same-subtract');
    expect(latDifference(30, -20)).toBe(50); expect(latDifferenceMethod(30, -20)).toBe('opposite-add');
    expect(latDifference(0, -20)).toBe(20); expect(latDifferenceMethod(0, -20)).toBe('zero-line');
  });
  test('longitude', () => {
    expect(lonDifference(21, 30)).toBe(9); expect(lonDifferenceMethod(21, 30)).toBe('same-subtract');
    expect(lonDifference(-10, 15)).toBe(25); expect(lonDifferenceMethod(-10, 15)).toBe('opposite-add');
    expect(lonDifference(170, -150)).toBe(40); expect(lonDifferenceMethod(170, -150)).toBe('opposite-over-180');
    expect(lonDifference(90, -90)).toBe(180); expect(lonDifferenceMethod(90, -90)).toBe('opposite-add');
    expect(lonDifference(0, -75)).toBe(75); expect(lonDifferenceMethod(0, -75)).toBe('zero-line');
    expect(lonDifference(180, 20)).toBe(160); expect(lonDifferenceMethod(180, 20)).toBe('zero-line');
  });
});

describe('extremes', () => {
  const pts = [{ lat: 10, lon: -20 }, { lat: 50, lon: 30 }, { lat: -40, lon: 5 }];
  test('N/S/E/W', () => {
    expect(extremeIndex(pts, 'N')).toBe(1); expect(extremeIndex(pts, 'S')).toBe(2);
    expect(extremeIndex(pts, 'E')).toBe(1); expect(extremeIndex(pts, 'W')).toBe(0);
  });
  test('spansAntimeridian', () => {
    expect(spansAntimeridian([-20, 30, 5])).toBe(false);
    expect(spansAntimeridian([170, -175])).toBe(true);
    expect(spansAntimeridian([-100, 100])).toBe(true); // smallest covering arc is 160° through 180°
  });
});
```

Definition: `spansAntimeridian` returns true when the largest gap between sorted longitudes (including the wrap-around gap) does **not** contain 180°, i.e. the smallest arc covering all points crosses 180°.

`tests/unit/distance-time.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import { KM_PER_DEGREE, degreesForDistance, meridianDistanceKm } from '../../src/geo/distance';
import { formatClock, localSolarMinutes, lonDifferenceForMinutes, solarOffsetMinutes, wrapDayMinutes } from '../../src/geo/time';

describe('distance', () => {
  test('constant', () => { expect(KM_PER_DEGREE).toBe(111.2); });
  test('same and opposite hemispheres', () => {
    expect(meridianDistanceKm(52, 50)).toBeCloseTo(222.4, 6);
    expect(meridianDistanceKm(10, -10)).toBeCloseTo(2224, 6);
    expect(meridianDistanceKm(10, -10, 111)).toBe(2220);
  });
  test('reverse', () => { expect(degreesForDistance(1112)).toBeCloseTo(10, 9); });
});

describe('time', () => {
  test('wrap', () => { expect(wrapDayMinutes(-60)).toBe(1380); expect(wrapDayMinutes(1500)).toBe(60); });
  test('offset: east is later, shorter way', () => {
    expect(solarOffsetMinutes(0, 15)).toBe(60);
    expect(solarOffsetMinutes(21, 30)).toBe(36);
    expect(solarOffsetMinutes(30, -45)).toBe(-300);
    expect(solarOffsetMinutes(170, -170)).toBe(80);
  });
  test('local solar time', () => { expect(localSolarMinutes(12 * 60, 15)).toBe(13 * 60); expect(localSolarMinutes(60, -30)).toBe(1380); });
  test('clock', () => { expect(formatClock(0)).toBe('00:00'); expect(formatClock(13 * 60 + 5)).toBe('13:05'); expect(formatClock(1440 + 30)).toBe('00:30'); });
  test('lon from minutes', () => { expect(lonDifferenceForMinutes(36)).toBe(9); expect(lonDifferenceForMinutes(90)).toBe(22.5); });
});
```
(01:00 UTC at 30°W is 2 h earlier = 23:00 = 1380 minutes.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/unit/compare.test.ts tests/unit/distance-time.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/geo/compare.ts`:
```ts
import { normalizeLon } from './format';
import type { LatLon } from './types';

export function hemisphereLat(lat: number): 'N' | 'S' | null {
  return lat > 0 ? 'N' : lat < 0 ? 'S' : null;
}

export function hemisphereLon(lon: number): 'E' | 'W' | null {
  const n = normalizeLon(lon);
  if (n === 0 || n === 180) return null;
  return n > 0 ? 'E' : 'W';
}

export function relativeToParallel(lat: number, parallel: number): 'north' | 'south' | 'on' {
  return lat > parallel ? 'north' : lat < parallel ? 'south' : 'on';
}

export function relativeToMeridian(lon: number, meridian: number): 'east' | 'west' | 'on' | 'opposite' {
  const d = normalizeLon(lon - meridian);
  if (d === 0) return 'on';
  if (d === 180) return 'opposite';
  return d > 0 ? 'east' : 'west';
}

export function latDifference(a: number, b: number): number {
  return Math.abs(a - b);
}

export function lonDifference(a: number, b: number): number {
  const d = Math.abs(normalizeLon(a) - normalizeLon(b));
  return d > 180 ? 360 - d : d;
}

export function latDifferenceMethod(a: number, b: number): 'same-subtract' | 'opposite-add' | 'zero-line' {
  if (a === 0 || b === 0) return 'zero-line';
  return Math.sign(a) === Math.sign(b) ? 'same-subtract' : 'opposite-add';
}

export function lonDifferenceMethod(a: number, b: number): 'same-subtract' | 'opposite-add' | 'opposite-over-180' | 'zero-line' {
  const ha = hemisphereLon(a);
  const hb = hemisphereLon(b);
  if (ha === null || hb === null) return 'zero-line';
  if (ha === hb) return 'same-subtract';
  return Math.abs(normalizeLon(a)) + Math.abs(normalizeLon(b)) > 180 ? 'opposite-over-180' : 'opposite-add';
}

export function extremeIndex(points: readonly LatLon[], dir: 'N' | 'S' | 'E' | 'W'): number {
  const key = (p: LatLon) => (dir === 'N' ? p.lat : dir === 'S' ? -p.lat : dir === 'E' ? normalizeLon(p.lon) : -normalizeLon(p.lon));
  let best = 0;
  points.forEach((p, i) => { if (key(p) > key(points[best]!)) best = i; });
  return best;
}

export function spansAntimeridian(lons: readonly number[]): boolean {
  const sorted = [...new Set(lons.map(normalizeLon))].sort((x, y) => x - y);
  if (sorted.length < 2) return false;
  // Largest empty gap; the points' smallest covering arc is the complement of that gap.
  let gapStart = sorted[sorted.length - 1]!;
  let gap = sorted[0]! + 360 - gapStart;
  for (let i = 1; i < sorted.length; i++) {
    const g = sorted[i]! - sorted[i - 1]!;
    if (g > gap) { gap = g; gapStart = sorted[i - 1]!; }
  }
  const gapEnd = gapStart + gap;
  // The covering arc crosses 180° unless the gap itself contains 180° (or -180°).
  const contains180 = (gapStart < 180 && gapEnd > 180) || (gapStart < -180 && gapEnd > -180);
  return !contains180;
}
```

`src/geo/distance.ts`:
```ts
import { latDifference } from './compare';

export const KM_PER_DEGREE = 111.2;

export function meridianDistanceKm(latA: number, latB: number, kmPerDegree = KM_PER_DEGREE): number {
  return latDifference(latA, latB) * kmPerDegree;
}

export function degreesForDistance(km: number, kmPerDegree = KM_PER_DEGREE): number {
  return km / kmPerDegree;
}
```

`src/geo/time.ts`:
```ts
import { normalizeLon } from './format';

export const MINUTES_PER_DEGREE = 4;
export const MINUTES_PER_DAY = 1440;

export function wrapDayMinutes(m: number): number {
  return ((Math.round(m) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

export function solarOffsetMinutes(fromLon: number, toLon: number): number {
  return normalizeLon(toLon - fromLon) * MINUTES_PER_DEGREE;
}

export function localSolarMinutes(utcMinutes: number, lon: number): number {
  return wrapDayMinutes(utcMinutes + normalizeLon(lon) * MINUTES_PER_DEGREE);
}

export function formatClock(minutes: number): string {
  const m = wrapDayMinutes(minutes);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function lonDifferenceForMinutes(minutes: number): number {
  return minutes / MINUTES_PER_DEGREE;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/compare.test.ts tests/unit/distance-time.test.ts`
Expected: PASS.

- [ ] **Step 5: Check and commit**

```bash
npm run check && npm test
git add src/geo tests/unit
git commit -m "feat(geo): relative position, degree differences, meridian distance, solar time"
```

---

### Task 4: Sun position

**Files:**
- Create: `src/geo/sun.ts`
- Test: `tests/unit/sun.test.ts`

**Interfaces:**
- Produces:
  - `subsolarPoint(date: Date): LatLon`
  - `antisolarPoint(date: Date): LatLon`
  - `solarElevationDeg(date: Date, p: LatLon): number`
  - `dateFromDayAndMinutes(year: number, dayOfYear: number, utcMinutes: number): Date` (dayOfYear 1-based)
  - `dayOfYear(date: Date): number` (UTC, 1-based)

- [ ] **Step 1: Failing tests** `tests/unit/sun.test.ts`:

```ts
import { describe, expect, test } from 'vitest';
import { antisolarPoint, dateFromDayAndMinutes, dayOfYear, solarElevationDeg, subsolarPoint } from '../../src/geo/sun';

const close = (a: number, b: number, tol: number) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

describe('subsolar point (NOAA approximation)', () => {
  test('June solstice declination ≈ +23.44', () => { close(subsolarPoint(new Date('2024-06-20T20:51:00Z')).lat, 23.44, 0.05); });
  test('December solstice ≈ −23.44', () => { close(subsolarPoint(new Date('2024-12-21T09:20:00Z')).lat, -23.44, 0.05); });
  test('March equinox ≈ 0', () => { close(subsolarPoint(new Date('2024-03-20T03:06:00Z')).lat, 0, 0.1); });
  test('equation of time: early November sun is west of Greenwich at 12:00 UTC', () => {
    close(subsolarPoint(new Date('2024-11-03T12:00:00Z')).lon, -4.1, 0.5);
  });
  test('equation of time: mid February sun is east of Greenwich at 12:00 UTC', () => {
    close(subsolarPoint(new Date('2024-02-11T12:00:00Z')).lon, 3.55, 0.5);
  });
  test('longitude normalized', () => {
    const lon = subsolarPoint(new Date('2024-06-01T00:00:00Z')).lon;
    expect(lon).toBeGreaterThan(-180); expect(lon).toBeLessThanOrEqual(180);
  });
});

describe('derived', () => {
  test('antisolar is opposite', () => {
    const d = new Date('2024-06-01T10:00:00Z');
    const s = subsolarPoint(d); const a = antisolarPoint(d);
    close(a.lat, -s.lat, 1e-9);
    close(Math.abs(((a.lon - s.lon + 540) % 360) - 180), 180, 1e-9);
  });
  test('elevation is 90 at subsolar and -90 at antisolar', () => {
    const d = new Date('2024-06-01T10:00:00Z');
    close(solarElevationDeg(d, subsolarPoint(d)), 90, 1e-6);
    close(solarElevationDeg(d, antisolarPoint(d)), -90, 1e-6);
  });
  test('polar day at north pole in June, polar night in December', () => {
    expect(solarElevationDeg(new Date('2024-06-21T00:00:00Z'), { lat: 89, lon: 0 })).toBeGreaterThan(0);
    expect(solarElevationDeg(new Date('2024-12-21T12:00:00Z'), { lat: 89, lon: 0 })).toBeLessThan(0);
  });
  test('day of year helpers', () => {
    expect(dayOfYear(new Date('2024-01-01T00:00:00Z'))).toBe(1);
    expect(dayOfYear(new Date('2024-12-31T23:59:00Z'))).toBe(366);
    expect(dateFromDayAndMinutes(2024, 32, 90).toISOString()).toBe('2024-02-01T01:30:00.000Z');
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/unit/sun.test.ts` → FAIL, module not found.

- [ ] **Step 3: Implement `src/geo/sun.ts`**

```ts
import { normalizeLon } from './format';
import type { LatLon } from './types';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

function sunParams(date: Date): { declination: number; eqTimeMin: number } {
  const jd = date.getTime() / 86_400_000 + 2440587.5;
  const t = (jd - 2451545) / 36525;
  const L0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const M = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const C = Math.sin(M * RAD) * (1.914602 - t * (0.004817 + 0.000014 * t))
    + Math.sin(2 * M * RAD) * (0.019993 - 0.000101 * t)
    + Math.sin(3 * M * RAD) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * t;
  const appLong = trueLong - 0.00569 - 0.00478 * Math.sin(omega * RAD);
  const meanObliq = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliq = meanObliq + 0.00256 * Math.cos(omega * RAD);
  const declination = Math.asin(Math.sin(obliq * RAD) * Math.sin(appLong * RAD)) * DEG;
  const y = Math.tan((obliq / 2) * RAD) ** 2;
  const eqTimeMin = 4 * DEG * (
    y * Math.sin(2 * L0 * RAD)
    - 2 * e * Math.sin(M * RAD)
    + 4 * e * y * Math.sin(M * RAD) * Math.cos(2 * L0 * RAD)
    - 0.5 * y * y * Math.sin(4 * L0 * RAD)
    - 1.25 * e * e * Math.sin(2 * M * RAD)
  );
  return { declination, eqTimeMin };
}

export function subsolarPoint(date: Date): LatLon {
  const { declination, eqTimeMin } = sunParams(date);
  const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
  return { lat: declination, lon: normalizeLon(-15 * (utcHours - 12 + eqTimeMin / 60)) };
}

export function antisolarPoint(date: Date): LatLon {
  const s = subsolarPoint(date);
  return { lat: -s.lat, lon: normalizeLon(s.lon + 180) };
}

export function solarElevationDeg(date: Date, p: LatLon): number {
  const s = subsolarPoint(date);
  const v = Math.sin(p.lat * RAD) * Math.sin(s.lat * RAD)
    + Math.cos(p.lat * RAD) * Math.cos(s.lat * RAD) * Math.cos((p.lon - s.lon) * RAD);
  return Math.asin(Math.max(-1, Math.min(1, v))) * DEG;
}

export function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 1);
  return Math.floor((date.getTime() - start) / 86_400_000) + 1;
}

export function dateFromDayAndMinutes(year: number, day: number, utcMinutes: number): Date {
  return new Date(Date.UTC(year, 0, 1) + (day - 1) * 86_400_000 + utcMinutes * 60_000);
}
```

- [ ] **Step 4: Run tests** — `npx vitest run tests/unit/sun.test.ts` → PASS. If the equation-of-time cases miss by more than 0.5°, recheck the sign convention: true solar time at Greenwich = UTC + EoT, so the Sun is overhead at lon = −15·(UTC + EoT − 12).

- [ ] **Step 5: Commit**

```bash
npm run check && npm test
git add src/geo/sun.ts tests/unit/sun.test.ts
git commit -m "feat(geo): subsolar point and solar elevation (NOAA approximation)"
```

---

### Task 5: i18n core

**Files:**
- Create: `src/i18n/en.json`, `src/i18n/pl.json`, `src/i18n/uk.json`, `src/i18n/i18n.svelte.ts`, `src/i18n/text.ts`, `src/i18n/spoken.ts`
- Test: `tests/unit/i18n.test.ts`

**Interfaces:**
- Consumes: `LangCode`, `LANGS`, `LatLon`, `Axis`, `Precision`; `formatLat`, `formatLon`, `formatLatLon`, `toDegMin`, `normalizeLon`.
- Produces:
  - Message file format: flat object `{ "dotted.key": "text with {param}" }`. Plural messages use suffixed keys `key#one`, `key#few`, `key#many`, `key#other` (EN needs `one`/`other`; PL and UK need `one`/`few`/`many`/`other`).
  - `i18n.svelte.ts`: `export const i18n: { lang: LangCode }` (`$state`), `setLang(lang: LangCode): void` (sets state, `document.documentElement.lang`, persists `geo-coords:lang`), `detectLang(languages: readonly string[]): LangCode` (first of `uk`/`pl`/`en` by primary subtag; `ru` → `uk`; default `en`), `initialLang(): LangCode` (stored value else `detectLang(navigator.languages)`), `t(key: string, params?: Record<string, string | number>, lang?: LangCode): string`, `tn(key: string, count: number, params?: Record<string, string | number>, lang?: LangCode): string` (injects `{count}`), `hasKey(key: string, lang?: LangCode): boolean`. **None of these functions may write to `i18n` state** (they are called from templates and `$derived`, where Svelte forbids state mutation). `messages: Record<LangCode, Record<string, string>>`. Missing keys return the key itself and `console.warn` once in dev (`import.meta.env.DEV`).
  - `text.ts`: `Text`, `TextParam` (README), `formatNumber(n: number, lang?: LangCode): string` (locale decimal separator, max 2 decimals, no grouping: PL/UK `333,6`, EN `333.6`), `renderText(text: Text, lang?: LangCode): string` — numbers via `formatNumber`, `{coord}` via `formatLat/Lon/LatLon`, `{place}` via `t('place.<id>')`, `{text}` recursively; uses `tn` when `count` is set.
  - `spoken.ts`: `spokenLat(lat: number, lang: LangCode, precision?: Precision): string`, `spokenLon(lon: number, lang: LangCode, precision?: Precision): string` — used for `aria-valuetext`.
- Storage helper: this task also creates `src/app/storage.ts` (`readJSON<T>(key: string, fallback: T): T`, `writeJSON(key: string, value: unknown): void`, `readString(key: string): string | null`, `writeString(key: string, value: string): void`), all try/catch-guarded.

- [ ] **Step 1: Seed message files** with the keys needed so far. `src/i18n/en.json`:

```json
{
  "app.title": "Coordinates on the globe",
  "app.skip": "Skip to main content",
  "unit.degree#one": "{count} degree",
  "unit.degree#other": "{count} degrees",
  "unit.minute#one": "{count} minute",
  "unit.minute#other": "{count} minutes",
  "dir.north": "north",
  "dir.south": "south",
  "dir.east": "east",
  "dir.west": "west",
  "spoken.lat": "{amount} {dir}",
  "spoken.lon": "{amount} {dir}",
  "spoken.zero": "{amount}"
}
```

`src/i18n/pl.json` (grammar: "52 stopnie szerokości geograficznej północnej" is heavy; school-friendly short form "52 stopnie na północ" is used for screen readers):
```json
{
  "app.title": "Współrzędne na kuli ziemskiej",
  "app.skip": "Przejdź do treści",
  "unit.degree#one": "{count} stopień",
  "unit.degree#few": "{count} stopnie",
  "unit.degree#many": "{count} stopni",
  "unit.degree#other": "{count} stopnia",
  "unit.minute#one": "{count} minuta",
  "unit.minute#few": "{count} minuty",
  "unit.minute#many": "{count} minut",
  "unit.minute#other": "{count} minuty",
  "dir.north": "na północ",
  "dir.south": "na południe",
  "dir.east": "na wschód",
  "dir.west": "na zachód",
  "spoken.lat": "{amount} {dir}",
  "spoken.lon": "{amount} {dir}",
  "spoken.zero": "{amount}"
}
```

`src/i18n/uk.json`:
```json
{
  "app.title": "Координати на земній кулі",
  "app.skip": "Перейти до основного вмісту",
  "unit.degree#one": "{count} градус",
  "unit.degree#few": "{count} градуси",
  "unit.degree#many": "{count} градусів",
  "unit.degree#other": "{count} градуса",
  "unit.minute#one": "{count} хвилина",
  "unit.minute#few": "{count} хвилини",
  "unit.minute#many": "{count} хвилин",
  "unit.minute#other": "{count} хвилини",
  "dir.north": "північної широти",
  "dir.south": "південної широти",
  "dir.east": "східної довготи",
  "dir.west": "західної довготи",
  "spoken.lat": "{amount} {dir}",
  "spoken.lon": "{amount} {dir}",
  "spoken.zero": "{amount}"
}
```

- [ ] **Step 2: Failing tests** `tests/unit/i18n.test.ts`:

```ts
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
```
(Polish/Ukrainian decimal counts use the `other` form; `Intl.PluralRules('pl').select(1.5)` returns `other`. Numbers are rendered with `String(n)` — the spec does not require localized decimal separators in plural units.)

- [ ] **Step 3: Run to verify failure** — `npx vitest run tests/unit/i18n.test.ts` → FAIL.

- [ ] **Step 4: Implement**

`src/app/storage.ts`:
```ts
export function readString(key: string): string | null {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}
export function writeString(key: string, value: string): void {
  try { globalThis.localStorage?.setItem(key, value); } catch { /* storage unavailable */ }
}
export function readJSON<T>(key: string, fallback: T): T {
  const raw = readString(key);
  if (raw === null) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}
export function writeJSON(key: string, value: unknown): void {
  writeString(key, JSON.stringify(value));
}
```

`src/i18n/i18n.svelte.ts`:
```ts
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

function interpolate(s: string, params?: Record<string, string | number>): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

export function hasKey(key: string, lang: LangCode = i18n.lang): boolean {
  return key in messages[lang];
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
```

`src/i18n/text.ts`:
```ts
import type { Axis, LangCode, LatLon, Precision } from '../geo/types';
import { formatLat, formatLatLon, formatLon } from '../geo/format';
import { i18n, t, tn } from './i18n.svelte';

export type TextParam = string | number | { coord: LatLon; axis?: Axis | 'both'; precision?: Precision } | { place: string } | { text: Text };
export interface Text { key: string; params?: Record<string, TextParam>; count?: number }

const numberFormats = new Map<LangCode, Intl.NumberFormat>();

export function formatNumber(n: number, lang: LangCode = i18n.lang): string {
  let f = numberFormats.get(lang);
  if (!f) { f = new Intl.NumberFormat(lang, { maximumFractionDigits: 2, useGrouping: false }); numberFormats.set(lang, f); }
  return f.format(n);
}

export function renderText(text: Text, lang: LangCode = i18n.lang): string {
  const resolved: Record<string, string | number> = {};
  for (const [name, p] of Object.entries(text.params ?? {})) {
    if (typeof p === 'string') resolved[name] = p;
    else if (typeof p === 'number') resolved[name] = formatNumber(p, lang);
    else if ('coord' in p) {
      const axis = p.axis ?? 'both';
      resolved[name] = axis === 'lat' ? formatLat(p.coord.lat, lang, p.precision) : axis === 'lon' ? formatLon(p.coord.lon, lang, p.precision) : formatLatLon(p.coord, lang, p.precision);
    } else if ('place' in p) resolved[name] = t(`place.${p.place}`, undefined, lang);
    else resolved[name] = renderText(p.text, lang);
  }
  return text.count === undefined ? t(text.key, resolved, lang) : tn(text.key, text.count, resolved, lang);
}
```
(`renderText(x, 'pl')` renders in any language without touching state; the translation review script in Task 19 relies on this.)

`src/i18n/spoken.ts`:
```ts
import type { LangCode, Precision } from '../geo/types';
import { normalizeLon, toDegMin } from '../geo/format';
import { t, tn } from './i18n.svelte';

function amount(value: number, precision: Precision, lang: LangCode): string {
  if (precision === 'degree') return tn('unit.degree', Math.round(Math.abs(value)), undefined, lang);
  const { deg, min } = toDegMin(value);
  const d = tn('unit.degree', deg, undefined, lang);
  return min === 0 ? d : `${d} ${tn('unit.minute', min, undefined, lang)}`;
}

function spoken(value: number, lang: LangCode, precision: Precision, pos: string, neg: string, isZero: boolean): string {
  const a = amount(value, precision, lang);
  if (isZero) return t('spoken.zero', { amount: a }, lang);
  return t('spoken.lat', { amount: a, dir: t(value > 0 ? pos : neg, undefined, lang) }, lang);
}

export function spokenLat(lat: number, lang: LangCode, precision: Precision = 'degree'): string {
  const zero = precision === 'degree' ? Math.round(lat) === 0 : Math.round(lat * 60) === 0;
  return spoken(lat, lang, precision, 'dir.north', 'dir.south', zero);
}

export function spokenLon(lon: number, lang: LangCode, precision: Precision = 'degree'): string {
  const n = normalizeLon(lon);
  const r = precision === 'degree' ? Math.round(Math.abs(n)) : Math.round(Math.abs(n) * 60) / 60;
  return spoken(n, lang, precision, 'dir.east', 'dir.west', r === 0 || r === 180);
}
```

- [ ] **Step 5: Run tests** — `npx vitest run tests/unit/i18n.test.ts` → PASS. (If `tn('unit.degree', 22)` in PL fails, confirm `Intl.PluralRules('pl').select(22) === 'few'` in Node 24 — it is.)

- [ ] **Step 6: Commit**

```bash
npm run check && npm test
git add src/i18n src/app/storage.ts tests/unit/i18n.test.ts
git commit -m "feat(i18n): message files with parity tests, plural-aware t/tn, spoken coordinates"
```

**Rule for every later task:** whenever a task adds a key to `en.json`, it adds the same key (and plural forms) to `pl.json` and `uk.json` in the same commit; `tests/unit/i18n.test.ts` enforces it.
