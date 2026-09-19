# Part 6 — The list, the notes, topic 9 and every string (spec §9.6)

Task 7 makes the feature reachable and gives it its words. Every user-facing string in this task is written out in
full in English, Polish and Ukrainian: **copy them, do not invent replacements**. Read spec §6 and planning
rulings R9 (own storage key), R10 (scene flag), R18 (key names) and R20 (attribution) first.

---

### Task 7: The settings switch, the close-up list, the three notes, topic 9's sentence, EN/PL/UK

**Files:**
- Create: `src/map/closeUps.svelte.ts`, `src/map/CloseUpList.svelte`, `src/map/CloseUpNote.svelte`
- Modify: `src/map/mapState.svelte.ts`, `src/map/MapStage.svelte`, `src/map/FlatMap.svelte`,
  `src/app/SettingsDialog.svelte`, `src/app/App.svelte`, `src/app/Footer.svelte`, `src/app/credits.ts`,
  `src/app/Explore.svelte`, `src/topics/types.ts`, `src/topics/t9-phone.ts`,
  `src/i18n/en.json`, `src/i18n/pl.json`, `src/i18n/uk.json`, `scripts/translation-review-lib.ts`
- Test: `tests/unit/close-ups.test.ts`, `tests/e2e/close-ups-switch.spec.ts`, `tests/e2e/close-up-places.spec.ts`

**Interfaces:**
- Consumes (Tasks 1, 4, 5, 6): `CITY_BOXES`, `CityBox { id, lat, lon, bounds, fitZoom, note }`, `CityBoxId`,
  `cityBoxById`, `cityBoxAt(p, zoom)`, `visibleCityBox(view, zoom)`; `MapState.closeUps` (the scene flag from
  Task 4, renamed here); `CITY_PHOTOS` from `src/map/texture/cityAssets.ts` (for the per-box credit);
  `src/app/storage.ts`'s `readString` / `writeString`.
- Produces:
  ```ts
  // src/map/closeUps.svelte.ts
  export const CLOSE_UPS_KEY = 'geo-coords:close-ups';
  export const closeUpSetting: { on: boolean };            // $state rune, default on
  export function parseCloseUps(v: unknown): boolean;      // anything but the exact string 'off' is on
  export function initCloseUps(): void;
  export function setCloseUps(on: boolean): void;
  // src/map/mapState.svelte.ts
  // MapState: closeUpsScene: boolean (was `closeUps` in Task 4); get closeUps(): boolean — the scene AND the switch
  // MapState: showCityBox(id: string): CityBox | null
  // src/app/credits.ts
  export interface CloseUpSource { key: 'gugik' | 'ign' | 'gsi' | 'naip' | 'sentinel'; name: string; url: string }
  export const CLOSE_UP_SOURCES: readonly CloseUpSource[];
  export const OSM: { name: string; url: string };
  // src/topics/types.ts
  // ExploreStep gains: closeUpNote?: boolean
  ```

---

- [ ] **Step 1: The strings (do this first — every later step uses them)**

Add these keys to `src/i18n/en.json`, `pl.json` and `uk.json`. The three files must end with **identical base key
sets and identical `{params}`** (`tests/unit/i18n.test.ts`). Keep each file's existing ordering convention.

**The twelve names** (`closeup.place.<id>`):

| key | en | pl | uk |
|---|---|---|---|
| `closeup.place.katowice` | Katowice — the school | Katowice — szkoła | Катовиці — школа |
| `closeup.place.greenwich` | Greenwich Observatory | Obserwatorium w Greenwich | Ґрінвіцька обсерваторія |
| `closeup.place.mitaddelmundo` | Mitad del Mundo (Ecuador) | Mitad del Mundo (Ekwador) | Мітад-дель-Мундо (Еквадор) |
| `closeup.place.rovaniemi` | Rovaniemi — the Arctic Circle | Rovaniemi — koło podbiegunowe | Рованіємі — полярне коло |
| `closeup.place.warsaw` | Warsaw | Warszawa | Варшава |
| `closeup.place.krakow` | Kraków | Kraków | Краків |
| `closeup.place.paris` | Paris — the Eiffel Tower | Paryż — wieża Eiffla | Париж — Ейфелева вежа |
| `closeup.place.manhattan` | Manhattan (New York) | Manhattan (Nowy Jork) | Мангеттен (Нью-Йорк) |
| `closeup.place.delhi` | Delhi | Delhi | Делі |
| `closeup.place.sydney` | Sydney | Sydney | Сідней |
| `closeup.place.tokyo` | Tokyo | Tokio | Токіо |
| `closeup.place.giza` | Giza — the pyramids | Giza — piramidy | Гіза — піраміди |

**The list itself:**

| key | en | pl | uk |
|---|---|---|---|
| `closeup.title` | Places up close | Miejsca z bliska | Місця зблизька |
| `closeup.hint` | Twelve places where the map goes down to the streets: an aerial photo with the streets drawn over it. | Dwanaście miejsc, w których mapa schodzi do poziomu ulic: zdjęcie lotnicze z narysowanymi na nim ulicami. | Дванадцять місць, де карта опускається до рівня вулиць: аерознімок із намальованими на ньому вулицями. |
| `closeup.goTo` | Show {place} up close | Pokaż {place} z bliska | Показати {place} зблизька |
| `closeup.description` | Inside this box the map shows an aerial photo with the streets drawn over it. | W tym prostokącie mapa pokazuje zdjęcie lotnicze z narysowanymi na nim ulicami. | У цьому прямокутнику карта показує аерознімок із намальованими на ньому вулицями. |

**The three teaching notes** (`closeup.note.<id>`), shown when the view is standing in that box:

| key | en |
|---|---|
| `closeup.note.greenwich` | The prime meridian is painted right across this courtyard. Stand on the line and your longitude is 0°. |
| `closeup.note.mitaddelmundo` | A line runs across this site: the equator, 0° latitude. Everything north of it is the northern hemisphere, everything south of it the southern. |
| `closeup.note.rovaniemi` | A line across the site marks the Arctic Circle, 66°34′N. North of it the Sun does not set at midsummer and does not rise at midwinter. |

| key | pl |
|---|---|
| `closeup.note.greenwich` | Południk zerowy jest namalowany w poprzek tego dziedzińca. Stań na linii, a twoja długość geograficzna wynosi 0°. |
| `closeup.note.mitaddelmundo` | Przez ten teren biegnie linia: równik, 0° szerokości geograficznej. Wszystko na północ od niej to półkula północna, a wszystko na południe — półkula południowa. |
| `closeup.note.rovaniemi` | Linia na tym terenie oznacza koło podbiegunowe północne, 66°34′N. Na północ od niego w środku lata Słońce nie zachodzi, a w środku zimy nie wschodzi. |

| key | uk |
|---|---|
| `closeup.note.greenwich` | Нульовий меридіан намальовано впоперек цього подвірʼя. Стань на лінію — і твоя довгота дорівнює 0°. |
| `closeup.note.mitaddelmundo` | Через цей майданчик проходить лінія: екватор, 0° широти. Усе на північ від неї — Північна півкуля, усе на південь — Південна. |
| `closeup.note.rovaniemi` | Лінія на цьому майданчику позначає полярне коло, 66°34′ пн. ш. На північ від нього в розпал літа Сонце не заходить, а в розпал зими не сходить. |

(Ukrainian uses the modifier-letter apostrophe `ʼ` U+02BC, as `src/map/political.ts` already does in `Мʼянма`.)

**The settings switch:**

| key | en | pl | uk |
|---|---|---|---|
| `settings.closeUps` | Places up close | Miejsca z bliska | Місця зблизька |
| `settings.closeUps.hint` | Show the twelve close-up places: an aerial photo and a street map inside each small box. Turning this off leaves the map exactly as it is everywhere else. The page is the same size either way. | Pokazuj dwanaście miejsc z bliska: zdjęcie lotnicze i mapę ulic w każdym małym prostokącie. Po wyłączeniu mapa wygląda dokładnie tak jak wszędzie indziej. Strona waży tyle samo w obu przypadkach. | Показувати дванадцять місць зблизька: аерознімок і карту вулиць у кожному маленькому прямокутнику. Якщо вимкнути, карта виглядатиме точно так само, як і всюди. Розмір сторінки в обох випадках однаковий. |

**Topic 9's extra sentence** (`topic.9.step.find.closeUp`):

| lang | text |
|---|---|
| en | This page can do the same: open “Places up close” under the map and pick a place — the map goes down to the streets, and the readout still gives the coordinates to the minute. |
| pl | Ta strona potrafi to samo: otwórz „Miejsca z bliska” pod mapą i wybierz miejsce — mapa zejdzie do poziomu ulic, a odczyt nadal poda współrzędne co do minuty. |
| uk | Ця сторінка вміє те саме: відкрий «Місця зблизька» під картою і вибери місце — карта опуститься до рівня вулиць, а показник і далі даватиме координати з точністю до хвилини. |

**The credits.** `closeup.credit` is translated; the six source lines are the licences' own prescribed wording and
are **identical in all three files** (planning ruling R20):

| key | en | pl | uk |
|---|---|---|---|
| `closeup.credit` | Close-up: {photo} · {streets} | Z bliska: {photo} · {streets} | Зблизька: {photo} · {streets} |
| `footer.closeUpPhotos` | Close-up photos: {source} | Zdjęcia z bliska: {source} | Знімки зблизька: {source} |
| `footer.closeUpStreets` | Close-up streets: {source} | Ulice z bliska: {source} | Вулиці зблизька: {source} |

| key | en = pl = uk |
|---|---|
| `closeup.credit.sentinel` | Contains modified Copernicus Sentinel data 2025-2026 |
| `closeup.credit.gugik` | Ortofotomapa: Główny Urząd Geodezji i Kartografii, geoportal.gov.pl |
| `closeup.credit.ign` | Orthophotos: © IGN / Géoplateforme, Licence Ouverte Etalab 2.0 |
| `closeup.credit.gsi` | Aerial photo: Geospatial Information Authority of Japan, seamlessphoto (processed) |
| `closeup.credit.naip` | Aerial photo: USDA-FSA NAIP, via USGS (public domain) |
| `closeup.credit.osm` | © OpenStreetMap contributors (ODbL) |

Use the **exact** strings `src/map/data/city/photos/manifest.json` recorded in Task 1 wherever they differ from the
above — Task 1's Step 6 may have found different GUGiK wording, and the year span in the Copernicus line comes
from the manifest, not from this table. A unit test in Step 8 checks the two agree.

Then extend the allow-lists in `scripts/translation-review-lib.ts` (read the file; keep every existing entry and
its comment style). In `SAME_OK`, after `/^place\./`:
```ts
  //  - closeup.place.*   real-world place names shared across languages (Giza, Sydney, Delhi, Manhattan, …)
  //  - closeup.credit.*  the licences' own prescribed attribution wording, which is not translated (ruling R20)
  /^closeup\.place\./,
  /^closeup\.credit\./,
```
and in `PLACE_NAME_KEY`: `const PLACE_NAME_KEY = /^place\.|^closeup\.place\.|^closeup\.credit\.|^label\.australia$/;`.

```bash
npx vitest run tests/unit/i18n.test.ts
```
Expected: PASS (same keys, same parameters, no suspicious strings).

- [ ] **Step 2: `src/map/closeUps.svelte.ts`**

```ts
import { readString, writeString } from '../app/storage';

/*
 * The "Places up close" switch (Places up close spec §6): default on, saved per pupil. It is a *display* switch,
 * not a download switch — the photos and the street data are in the file either way — so turning it off leaves the
 * map exactly as it was before this feature and changes nothing about the page's size.
 *
 * Its own storage key, not a field of geo-coords:settings, for the same reason the map style has one: the settings
 * record is asserted exactly by tests/unit/storage.test.ts (planning ruling R9).
 */
export const CLOSE_UPS_KEY = 'geo-coords:close-ups';

/** A saved value: only the exact string 'off' turns the feature off, so a cleared or corrupted value is "on". */
export const parseCloseUps = (v: unknown): boolean => v !== 'off';

export const closeUpSetting = $state<{ on: boolean }>({ on: true });

export function initCloseUps(): void {
  closeUpSetting.on = parseCloseUps(readString(CLOSE_UPS_KEY));
}

export function setCloseUps(on: boolean): void {
  closeUpSetting.on = on;
  writeString(CLOSE_UPS_KEY, on ? 'on' : 'off');
}
```
Call `initCloseUps()` in `src/app/App.svelte` right where `initSettings()` is called (read the file and follow it).

- [ ] **Step 3: `MapState` — the switch joins the scene flag, and `showCityBox`**

In `src/map/mapState.svelte.ts`, rename Task 4's field and add the getter and the method:
```ts
  /** Whether this *scene* offers the city close-ups (SceneSpec.closeUps; spec §2 "Where it appears"). */
  closeUpsScene = $state(false);

  /**
   * Whether close-ups are drawn and offered right now: the scene has to allow them *and* the pupil's "Places up
   * close" switch has to be on (spec §6). Everything that draws or lists a close-up reads this one getter.
   */
  get closeUps(): boolean {
    return this.closeUpsScene && closeUpSetting.on;
  }

  /**
   * Goes to a close-up box: the flat map centred on it at the zoom that fills the view with it, the globe centred
   * too, and the point moved there when it can move. Close-ups are a flat-map feature (planning ruling R1), so a
   * phone showing the globe is switched to the flat map. Returns the box, or null for an unknown id.
   */
  showCityBox(id: string): CityBox | null {
    const box = cityBoxById(id);
    if (!box) return null;
    const centre = { lat: box.lat, lon: box.lon };
    this.setFlatView(centre, box.fitZoom);
    this.centerGlobeOn(centre);
    if (this.views.includes('flat')) this.phoneView = 'flat';
    // After the zoom, so a free-play scene's point snaps to minutes at this close view.
    this.userSetPoint(centre, 'slider');
    return box;
  }
```
with `import { cityBoxById, type CityBox } from './cityBoxes';` and
`import { closeUpSetting } from './closeUps.svelte';`. In `replaceScene`, the line Task 4 added becomes
`this.closeUpsScene = scene.closeUps ?? false;`. Nothing else changes: every `mapState.closeUps` reader from
Tasks 4–6 keeps working and now also obeys the switch.

- [ ] **Step 4: `src/map/CloseUpList.svelte`**

Modelled on `SchoolList.svelte` (a `<details>` disclosure with a note and a grid of buttons); read that file and
follow its markup and styles so the two look like one family.

```svelte
<script lang="ts">
  import { formatLatLon } from '../geo/format';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { CITY_BOXES } from './cityBoxes';
  import { mapState } from './mapState.svelte';

  // The accessible way to the twelve close-ups (spec §6): ordinary buttons in a disclosure, like the Places and
  // Schools lists. A button centres both maps on the box and sets the zoom that fills the view with it.
  const items = $derived.by(() => {
    const collator = new Intl.Collator(i18n.lang);
    return CITY_BOXES.map((b) => ({ ...b, name: t(`closeup.place.${b.id}`) }))
      .sort((a, b) => collator.compare(a.name, b.name));
  });
</script>

<details class="close-ups">
  <summary>{t('closeup.title')} <span class="total">{CITY_BOXES.length}</span></summary>
  <div class="body">
    <p class="note">{t('closeup.hint')}</p>
    <ul>
      {#each items as b (b.id)}
        <li>
          <button type="button" onclick={() => mapState.showCityBox(b.id)} aria-label={t('closeup.goTo', { place: b.name })}>
            <span class="name">{b.name}</span>
            <span class="coords" aria-hidden="true">{formatLatLon(b, i18n.lang)}</span>
          </button>
        </li>
      {/each}
    </ul>
  </div>
</details>

<style>
  /* Copy SchoolList.svelte's .schools / summary / .total / .body / .note / button rules verbatim, renaming
     .schools to .close-ups, so the three lists under the map are visually one family; keep the 44 px min-height
     on summary and on every button. */
</style>
```
Copy the real CSS across rather than leaving that comment in the committed file.

- [ ] **Step 5: `src/map/CloseUpNote.svelte` — the teaching note and the credit**

```svelte
<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { cityBoxAt } from './cityBoxes';
  import { mapState } from './mapState.svelte';
  import { CITY_PHOTOS } from './texture/cityAssets';

  // Spec §6: a short note for the three teaching places, and the credit for whichever box is on screen. Both
  // follow where the *view* is standing, not what is painted, so they are right in every style.
  const box = $derived(mapState.closeUps ? cityBoxAt(mapState.flat.center, mapState.flat.zoom) : null);
  const credit = $derived(box
    ? t('closeup.credit', { photo: t(`closeup.credit.${CITY_PHOTOS[box.id].source}`), streets: t('closeup.credit.osm') })
    : '');
</script>

{#if box?.note}<p class="close-up-note">{t(`closeup.note.${box.id}`)}</p>{/if}
<p class="close-up-credit">{credit}</p>

<style>
  .close-up-note { margin: 0; padding: var(--space-2) var(--space-3); background: var(--accent-soft); border-radius: var(--radius); max-width: var(--measure); }
  .close-up-credit { margin: 0; color: var(--text-muted); font-size: var(--step--1); }
  .close-up-credit:empty { display: none; }
</style>
```

- [ ] **Step 6: `src/map/MapStage.svelte`**

Read the file. Add `import CloseUpList from './CloseUpList.svelte';` and
`import CloseUpNote from './CloseUpNote.svelte';`, put `<CloseUpNote />` right after the existing
`<p class="map-source">…</p>` line, and the list right after the `PlaceList` line:
```svelte
  {#if mapState.closeUps}<CloseUpList />{/if}
```
The list needs no `pointEditable`: it moves the view, and moves the point only where the point can move.

- [ ] **Step 7: The map's text description, the settings dialog, the footer and topic 9**

`src/map/FlatMap.svelte` — the visually-hidden description at line ~211 gains one sentence when a box is on
screen, and loses it when the switch is off (spec §6):
```svelte
  const inCityBox = $derived(mapState.closeUps && visibleCityBox(ctx.bounds, ctx.zoom) !== null);
```
```svelte
  <p id="{uid}-style-desc" class="visually-hidden">{t(`map.style.description.${mapState.drawnMapStyle}`)}{inCityBox ? ` ${t('closeup.description')}` : ''}</p>
```
`src/map/Globe.svelte` is left alone: close-ups are flat-map only (planning ruling R1).

`src/app/SettingsDialog.svelte` — add the switch after the map-style fieldset and before the `largeText`
checkbox, with its hint wired to the input:
```svelte
  <label class="row"><input type="checkbox" checked={closeUpSetting.on} onchange={(e) => setCloseUps(e.currentTarget.checked)} aria-describedby="close-ups-hint" /> {t('settings.closeUps')}</label>
  <p id="close-ups-hint" class="hint">{t('settings.closeUps.hint')}</p>
```
with `import { closeUpSetting, setCloseUps } from '../map/closeUps.svelte';` and a `.hint` rule beside the
existing ones (`margin: 0 0 var(--space-3) 2.75rem; color: var(--text-muted); font-size: var(--step--1);`).

`src/app/credits.ts`:
```ts
export interface CloseUpSource { key: 'gugik' | 'ign' | 'gsi' | 'naip' | 'sentinel'; name: string; url: string }
/** The five open imagery services the twelve close-up photos come from (spec §4); each keeps its own credit. */
export const CLOSE_UP_SOURCES: readonly CloseUpSource[] = [
  { key: 'gugik', name: 'GUGiK Geoportal', url: 'https://www.geoportal.gov.pl/' },
  { key: 'ign', name: 'IGN Géoplateforme', url: 'https://data.geopf.fr/' },
  { key: 'gsi', name: 'GSI Japan', url: 'https://maps.gsi.go.jp/development/ichiran.html' },
  { key: 'naip', name: 'USGS NAIP', url: 'https://imagery.nationalmap.gov/' },
  { key: 'sentinel', name: 'Copernicus Sentinel-2', url: 'https://sentinels.copernicus.eu/' },
];
export const OSM = { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/copyright' };
```

`src/app/Footer.svelte` — a new row under the school note, following the file's existing link pattern:
```svelte
  <p class="close-ups">
    {t('footer.closeUpPhotos', { source: '' })}{#each CLOSE_UP_SOURCES as s, i (s.key)}{#if i}<span aria-hidden="true">, </span>{/if}<a href={s.url} rel="noopener">{s.name}</a>{/each}
    <span class="sep" aria-hidden="true"> · </span>
    {t('footer.closeUpStreets', { source: '' })}<a href={OSM.url} rel="noopener">{OSM.name}</a>
  </p>
  <p class="close-ups small">{t('closeup.credit.sentinel')}</p>
```
with `p.close-ups { flex: 1 0 100%; padding-top: var(--space-1); }` and `p.small { font-size: var(--step--2); }`
beside the existing `p.schools` rule, and the same `@media (max-width: 599px)` treatment.

`src/topics/types.ts` — `ExploreStep` gains:
```ts
  /** The step shows one extra sentence about the city close-ups, when the pupil has them on (spec §6). */
  closeUpNote?: boolean;
```
`src/app/Explore.svelte` — after the `<p class="body">` line:
```svelte
    {#if current.closeUpNote && closeUpSetting.on}<p class="body extra">{t(`topic.${topic.id}.step.${current.id}.closeUp`)}</p>{/if}
```
with the import and `.body.extra { margin-top: calc(-1 * var(--space-3)); }` so the two paragraphs read as one
block. `src/topics/t9-phone.ts` — the `find` step gains `closeUpNote: true` (it already got `closeUps: true` in
Task 4).

- [ ] **Step 8: `tests/unit/close-ups.test.ts`**

```ts
import { beforeEach, describe, expect, test } from 'vitest';
import en from '../../src/i18n/en.json';
import pl from '../../src/i18n/pl.json';
import uk from '../../src/i18n/uk.json';
import photoManifest from '../../src/map/data/city/photos/manifest.json';
import { CITY_BOXES } from '../../src/map/cityBoxes';
import { CLOSE_UPS_KEY, closeUpSetting, initCloseUps, parseCloseUps, setCloseUps } from '../../src/map/closeUps.svelte';
import { MapState } from '../../src/map/mapState.svelte';
import { topic9 } from '../../src/topics/t9-phone';

const memory = () => {
  const data = new Map<string, string>();
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
};
const setStorage = (s: unknown) => { (globalThis as { localStorage?: unknown }).localStorage = s; };
beforeEach(() => { setStorage(memory()); closeUpSetting.on = true; });

describe('the Places up close switch', () => {
  test('default on; only the exact string "off" turns it off; a broken store is still on', () => {
    expect(parseCloseUps(null)).toBe(true);
    expect(parseCloseUps('on')).toBe(true);
    expect(parseCloseUps('OFF')).toBe(true);
    expect(parseCloseUps(0)).toBe(true);
    expect(parseCloseUps('off')).toBe(false);
    initCloseUps();
    expect(closeUpSetting.on).toBe(true);
  });

  test('it is saved under its own key and read back (planning ruling R9)', () => {
    const store = memory();
    setStorage(store);
    setCloseUps(false);
    expect(store.data.get(CLOSE_UPS_KEY)).toBe('off');
    closeUpSetting.on = true;
    initCloseUps();
    expect(closeUpSetting.on).toBe(false);
    setCloseUps(true);
    expect(store.data.get(CLOSE_UPS_KEY)).toBe('on');
    initCloseUps();
    expect(closeUpSetting.on).toBe(true);
  });

  test('a scene and the switch both have to say yes', () => {
    const s = new MapState();
    s.applyScene({ views: ['flat'] });
    expect(s.closeUps).toBe(false);
    s.applyScene({ views: ['flat'], closeUps: true });
    expect(s.closeUps).toBe(true);
    closeUpSetting.on = false;
    expect(s.closeUps).toBe(false);
    closeUpSetting.on = true;
    expect(s.closeUps).toBe(true);
  });
});

describe('showCityBox', () => {
  test('centres the flat map on the box at its fit zoom and moves the point there', () => {
    const s = new MapState();
    s.applyScene({ views: ['globe', 'flat'], point: { lat: 0, lon: 0 }, pointEditable: true, precision: 'auto', closeUps: true });
    for (const b of CITY_BOXES) {
      const got = s.showCityBox(b.id)!;
      expect(got.id).toBe(b.id);
      expect(s.flat.zoom, b.id).toBeCloseTo(b.fitZoom, 6);
      expect(s.flat.center.lat, b.id).toBeCloseTo(b.lat, 3);
      expect(s.flat.center.lon, b.id).toBeCloseTo(b.lon, 3);
      expect(s.phoneView, b.id).toBe('flat');
      // The point lands on the nearest minute, which is inside the box (a minute of latitude is 1.85 km, the box 4 km tall).
      expect(s.point!.lat >= b.bounds.south && s.point!.lat <= b.bounds.north, b.id).toBe(true);
      expect(s.point!.lon >= b.bounds.west && s.point!.lon <= b.bounds.east, b.id).toBe(true);
    }
    expect(s.showCityBox('atlantis')).toBeNull();
  });
});

describe('the close-up texts', () => {
  const files = { en, pl, uk } as Record<string, Record<string, string>>;

  test('every box has a name in all three languages, and the three teaching places have a note', () => {
    for (const b of CITY_BOXES) {
      for (const [lang, f] of Object.entries(files)) {
        expect(f, `${lang}:closeup.place.${b.id}`).toHaveProperty(`closeup.place.${b.id}`);
        if (b.note) expect(f, `${lang}:closeup.note.${b.id}`).toHaveProperty(`closeup.note.${b.id}`);
        else expect(f, `${lang}:closeup.note.${b.id}`).not.toHaveProperty(`closeup.note.${b.id}`);
      }
    }
    expect(Object.keys(en).filter((k) => k.startsWith('closeup.note.'))).toHaveLength(3);
  });

  test('the three notes name the line each place is famous for', () => {
    expect(en['closeup.note.greenwich']).toContain('prime meridian');
    expect(en['closeup.note.greenwich']).toContain('0°');
    expect(en['closeup.note.mitaddelmundo']).toContain('equator');
    expect(en['closeup.note.rovaniemi']).toContain('66°34′N');
    expect(pl['closeup.note.greenwich']).toContain('Południk zerowy');
    expect(pl['closeup.note.rovaniemi']).toContain('66°34′N');
    expect(uk['closeup.note.greenwich']).toContain('Нульовий меридіан');
    expect(uk['closeup.note.rovaniemi']).toContain('66°34′ пн. ш.');
  });

  test('every photo source has a credit line, identical in all three languages, matching the manifest', () => {
    const sources = new Set(Object.values(photoManifest.photos).map((p) => p.source));
    for (const key of sources) {
      const credit = en[`closeup.credit.${key}`]!;
      expect(credit, key).toBeTruthy();
      expect(pl[`closeup.credit.${key}`], key).toBe(credit);
      expect(uk[`closeup.credit.${key}`], key).toBe(credit);
    }
    // The Copernicus line's years come from the real build, not from a hand-typed date.
    const sentinelLicence = Object.values(photoManifest.photos).find((p) => p.source === 'sentinel')!.licence;
    expect(en['closeup.credit.sentinel']).toBe(sentinelLicence);
    expect(en['closeup.credit.osm']).toBe('© OpenStreetMap contributors (ODbL)');
  });

  test("topic 9's find step offers close-ups and has its extra sentence in all three languages", () => {
    const find = topic9.steps.find((s) => s.id === 'find')!;
    expect(find.scene.closeUps).toBe(true);
    expect(find.closeUpNote).toBe(true);
    for (const [lang, f] of Object.entries(files)) {
      expect(f, `${lang}:topic.9.step.find.closeUp`).toHaveProperty('topic.9.step.find.closeUp');
      expect(f['topic.9.step.find.closeUp']!.length, lang).toBeGreaterThan(60);
    }
  });
});
```

- [ ] **Step 9: `tests/e2e/close-up-places.spec.ts`**

The list's buttons are sorted by their translated name, not by the `boxes.json` order, so never address one by
position: use its accessible name (`Show <name> up close`), and drive the twelve through `showCityBox` directly.

```ts
import { expect, test } from '@playwright/test';
import boxesJson from '../../src/map/data/city/boxes.json';
import { expectNoAxeViolations, openPage, pageErrors } from './helpers';

const fit = (b: { west: number; east: number; south: number; north: number }) =>
  Math.min(360 / (b.east - b.west), 180 / (b.north - b.south));
const flat = (page: import('@playwright/test').Page) =>
  page.evaluate(() => (window as unknown as { __mapState: { flat: { zoom: number; center: { lat: number; lon: number } } } }).__mapState.flat);

test('each of the twelve is one click away and lands with the box filling the view', async ({ page }) => {
  test.setTimeout(180_000);
  await openPage(page, 'en/lab', '?test');
  await page.getByRole('group', { name: 'Map' }).first().waitFor({ state: 'attached' }).catch(() => {});
  const summary = page.getByText('Places up close', { exact: true }).first();
  await summary.click();
  const buttons = page.getByRole('button', { name: /up close$/ });
  await expect(buttons).toHaveCount(12);
  for (const b of boxesJson.boxes) {
    await page.evaluate((id) => (window as unknown as { __mapState: { showCityBox(id: string): unknown } }).__mapState.showCityBox(id), b.id);
    const f = await flat(page);
    expect(f.zoom, b.id).toBeCloseTo(fit(b), 0);
    expect(f.center.lat, b.id).toBeCloseTo(b.lat, 2);
    expect(f.center.lon, b.id).toBeCloseTo(b.lon, 2);
    await expect(page.locator(`.view-flat g.streets[data-city-box="${b.id}"]`), b.id).toHaveCount(1);
  }
  // And really through the list, for the one the lesson is about.
  await buttons.filter({ hasText: 'Katowice' }).click();
  expect((await flat(page)).center.lat).toBeCloseTo(50.26, 2);
  expect(pageErrors(page)).toEqual([]);
});

test('the three teaching places show their note, and the others do not', async ({ page }) => {
  test.setTimeout(120_000);
  await openPage(page, 'en/lab', '?test');
  const note = page.locator('.close-up-note');
  const go = (id: string) => page.evaluate((i) => (window as unknown as { __mapState: { showCityBox(id: string): unknown } }).__mapState.showCityBox(i), id);
  await go('greenwich');
  await expect(note).toHaveText(/prime meridian is painted/);
  await go('mitaddelmundo');
  await expect(note).toHaveText(/equator, 0° latitude/);
  await go('rovaniemi');
  await expect(note).toHaveText(/Arctic Circle, 66°34′N/);
  await go('katowice');
  await expect(note).toHaveCount(0);
  // The credit follows the box's own source.
  await expect(page.locator('.close-up-credit')).toHaveText(/Ortofotomapa.*OpenStreetMap/);
  await go('giza');
  await expect(page.locator('.close-up-credit')).toHaveText(/Copernicus Sentinel.*OpenStreetMap/);
});

test("topic 9's find step says so, and the list is there", async ({ page }) => {
  await openPage(page, 'en/topic-9/explore/4');
  await expect(page.getByText(/open .Places up close. under the map/)).toBeVisible();
  await expect(page.getByText('Places up close', { exact: true })).toBeVisible();
  await expectNoAxeViolations(page, 'topic 9 find step with close-ups');
});

for (const lang of ['pl', 'uk'] as const) {
  test(`the list, the notes and topic 9's sentence are translated (${lang})`, async ({ page }) => {
    const title = lang === 'pl' ? 'Miejsca z bliska' : 'Місця зблизька';
    await openPage(page, `${lang}/lab`, '?test');
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await page.evaluate(() => (window as unknown as { __mapState: { showCityBox(id: string): unknown } }).__mapState.showCityBox('greenwich'));
    await expect(page.locator('.close-up-note')).toHaveText(lang === 'pl' ? /Południk zerowy/ : /Нульовий меридіан/);
    await openPage(page, `${lang}/topic-9/explore/4`);
    await expect(page.getByText(lang === 'pl' ? /Miejsca z bliska/ : /Місця зблизька/).first()).toBeVisible();
  });
}
```

- [ ] **Step 10: `tests/e2e/close-ups-switch.spec.ts`**

```ts
import { expect, test } from '@playwright/test';
import boxesJson from '../../src/map/data/city/boxes.json';
import { openPage, pageErrors, setFlatView, setMapStyle, waitForTexture } from './helpers';

const k = boxesJson.boxes.find((b) => b.id === 'katowice')!;
const fit = Math.min(360 / (k.east - k.west), 180 / (k.north - k.south));

test('off: no photo, no streets, no list, no extra sentence — and the map is otherwise unchanged', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.setItem('geo-coords:close-ups', 'off'));
  await openPage(page, 'en/lab', '?test');
  await expect(page.getByText('Places up close', { exact: true })).toHaveCount(0);
  await setMapStyle(page, 'satellite');
  await waitForTexture(page, 'flat');
  await setFlatView(page, k.lat, k.lon, fit);
  await expect(page.locator('.view-flat g.streets')).toHaveCount(0);
  await expect(page.locator('.close-up-credit')).toHaveText('');
  // The map still works: the grid, the point and the readout are all there at this zoom.
  await expect(page.locator('.view-flat .grid')).toHaveCount(1);
  await expect(page.locator('.view-flat [data-point-handle]')).toHaveCount(1);
  await expect(page.locator('output').first()).toHaveText(/^\d+°\d\d′N, \d+°\d\d′E$/);

  await openPage(page, 'en/topic-9/explore/4');
  await expect(page.getByText(/open .Places up close. under the map/)).toHaveCount(0);
  expect(pageErrors(page)).toEqual([]);
});

test('the Settings switch turns it off and on again, and the choice is remembered', async ({ page }) => {
  test.setTimeout(120_000);
  await openPage(page, 'en/lab', '?test');
  await setFlatView(page, k.lat, k.lon, fit);
  await expect(page.locator('.view-flat g.streets')).toHaveCount(1);

  await page.getByRole('button', { name: 'Settings' }).click();
  const box = page.getByRole('checkbox', { name: 'Places up close' });
  await expect(box).toBeChecked();
  await box.uncheck();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.view-flat g.streets')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('geo-coords:close-ups'))).toBe('off');

  await openPage(page, 'en/lab', '?test');
  await setFlatView(page, k.lat, k.lon, fit);
  await expect(page.locator('.view-flat g.streets')).toHaveCount(0);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('checkbox', { name: 'Places up close' }).check();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('.view-flat g.streets')).toHaveCount(1);
  expect(pageErrors(page)).toEqual([]);
});

test('close-ups never appear where the spec says they must not', async ({ page }) => {
  // Practice and the class quiz: the scene never sets closeUps, so even at a box's own zoom nothing is drawn.
  for (const hash of ['en/topic-4/practice', 'en/class-quiz']) {
    await openPage(page, hash, '?test');
    await setFlatView(page, k.lat, k.lon, fit);
    await expect(page.locator('g.streets'), hash).toHaveCount(0);
    await expect(page.getByText('Places up close', { exact: true }), hash).toHaveCount(0);
  }
});
```
The `Settings` and `Close` button names must match what `Header.svelte` and `SettingsDialog.svelte` really render
in English — read them and use the real names.

- [ ] **Step 11: Run everything and look at it**

```bash
npm run check && npm test
npm run build
npm run e2e
```
Expected: the whole suite passes, the seven Atlas baselines with zero diff.

Then look at it, at 375 px and 1366 px, light and dark, in all three languages:
```bash
npm run shot -- en/lab close-ups
npm run shot -- pl/topic-9/explore/4 close-ups-t9-pl
npm run shot -- uk/lab close-ups-uk
```
Check and write down:
1. The three lists under the map (Places, Places up close, Maple Bear schools) read as one family and the
   close-up list's summary and buttons are at least 44 px tall.
2. The teaching note is readable in both themes and does not push the map off the first screen on a phone.
3. The credit line is small, correct for the box on screen, and changes when you move to another box.
4. The Settings switch's hint wraps sensibly at 320 px and the checkbox has a visible focus ring.
5. The Polish and Ukrainian names and notes fit their buttons and boxes without clipping; nothing overflows.
6. Topic 9's `find` step reads as two paragraphs of one thought, not as a bolt-on.

- [ ] **Step 12: Commit**

```bash
git add src/map/closeUps.svelte.ts src/map/CloseUpList.svelte src/map/CloseUpNote.svelte \
  src/map/mapState.svelte.ts src/map/MapStage.svelte src/map/FlatMap.svelte \
  src/app/SettingsDialog.svelte src/app/App.svelte src/app/Footer.svelte src/app/credits.ts \
  src/app/Explore.svelte src/topics/types.ts src/topics/t9-phone.ts \
  src/i18n/en.json src/i18n/pl.json src/i18n/uk.json scripts/translation-review-lib.ts \
  tests/unit/close-ups.test.ts tests/e2e/close-ups-switch.spec.ts tests/e2e/close-up-places.spec.ts
git commit -m "feat(lesson): Places up close list, teaching notes, topic 9 sentence and the settings switch"
```

**Report:** the six visual checks above; the keys added and the allow-list entries; whether any Polish or
Ukrainian string had to be reworded to fit, and what it became; the full e2e result.
