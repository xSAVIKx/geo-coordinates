import { beforeEach, describe, expect, test } from 'vitest';
import en from '../../src/i18n/en.json';
import pl from '../../src/i18n/pl.json';
import uk from '../../src/i18n/uk.json';
import photoManifest from '../../src/map/data/city/photos/manifest.json';
import { formatLatLon } from '../../src/geo/format';
import { CITY_BOXES } from '../../src/map/cityBoxes';
import { POLAR } from '../../src/map/geometry';
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

  test('the key is the only thing it writes, and it is prefixed like every other one', () => {
    const store = memory();
    setStorage(store);
    setCloseUps(false);
    expect([...store.data.keys()]).toEqual(['geo-coords:close-ups']);
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

  test('the coordinates on a card are the ones the pupil then reads on the map', () => {
    // Whole degrees would print Rovaniemi's box as 67°N while its own note says the Arctic Circle is at 66°34′N,
    // and the readout on arriving says 66°33′N. At minute precision the card, the note and the readout agree.
    const s = new MapState();
    s.applyScene({ views: ['flat'], point: { lat: 0, lon: 0 }, pointEditable: true, precision: 'auto', closeUps: true });
    for (const b of CITY_BOXES) {
      s.showCityBox(b.id);
      expect(formatLatLon(b, 'en', 'minute'), b.id).toBe(formatLatLon(s.point!, 'en', 'minute'));
    }
    expect(formatLatLon(CITY_BOXES.find((b) => b.id === 'rovaniemi')!, 'en', 'minute')).toBe('66°33′N, 25°51′E');
    expect(formatLatLon(CITY_BOXES.find((b) => b.id === 'greenwich')!, 'en', 'minute')).toBe('51°29′N, 0°00′');
    expect(formatLatLon(CITY_BOXES.find((b) => b.id === 'mitaddelmundo')!, 'en', 'minute')).toBe('0°00′, 78°27′W');
  });

  test('a scene whose point cannot move is only centred, not edited', () => {
    const s = new MapState();
    s.applyScene({ views: ['flat'], point: { lat: 0, lon: 0 }, closeUps: true });
    const box = s.showCityBox('greenwich')!;
    expect(s.flat.center.lat).toBeCloseTo(box.lat, 3);
    expect(s.point).toEqual({ lat: 0, lon: 0 });
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

  /*
   * Rovaniemi's one-minute seam, said out loud instead of left for the pupil to trip over. The box is centred on
   * the mark Rovaniemi paints on the ground, so the card and the readout say 66°33′N; the Arctic Circle the app
   * draws (POLAR = 66.56, geometry.ts) is 66°34′N and its dashed line runs across the box about 1.5 km north of
   * the point — measured at the fit zoom: 75 px down a 288 px frame whose box starts at 67 px, so the line is on
   * screen and labelled, seven pixels inside the box's northern edge. The note now names both numbers, so a
   * reader of the note and a reader of the readout are told the same thing.
   */
  test("the Arctic Circle note names the readout's own minute as well as the circle's", () => {
    const readout = formatLatLon(CITY_BOXES.find((b) => b.id === 'rovaniemi')!, 'en', 'minute');
    expect(readout).toBe('66°33′N, 25°51′E');
    expect(en['closeup.note.rovaniemi']).toContain('66°33′N');
    expect(pl['closeup.note.rovaniemi']).toContain('66°33′N');
    expect(uk['closeup.note.rovaniemi']).toContain('66°33′ пн. ш.');
    // And the circle the app draws really is the 66°34′ the note claims.
    expect(formatLatLon({ lat: POLAR, lon: 0 }, 'en', 'minute').startsWith('66°34′N')).toBe(true);
  });

  test('every photo source has a credit line, identical in all three languages, matching the manifest', () => {
    const sources = new Set(Object.values(photoManifest.photos).map((p) => p.source));
    for (const key of sources) {
      const credit = en[`closeup.credit.${key}` as keyof typeof en] as string;
      expect(credit, key).toBeTruthy();
      expect(pl[`closeup.credit.${key}` as keyof typeof pl], key).toBe(credit);
      expect(uk[`closeup.credit.${key}` as keyof typeof uk], key).toBe(credit);
      // Word for word what the service publishes: Task 1 wrote it into the manifest from the licence itself.
      const licence = Object.values(photoManifest.photos).find((p) => p.source === key)!.licence;
      expect(credit, key).toBe(licence);
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
    // The step's own sentence invites the pupil to pick a place and read its coordinates off the readout, and
    // showCityBox moves the point only where the point may move — so this step's point has to be editable.
    expect(find.scene.pointEditable).toBe(true);
    for (const [lang, f] of Object.entries(files)) {
      expect(f, `${lang}:topic.9.step.find.closeUp`).toHaveProperty('topic.9.step.find.closeUp');
      expect(f['topic.9.step.find.closeUp']!.length, lang).toBeGreaterThan(60);
    }
  });

  test('the list, the switch and the footer are all spelled out in all three languages', () => {
    const keys = ['closeup.title', 'closeup.hint', 'closeup.goTo', 'closeup.showing', 'closeup.description',
      'closeup.credit', 'settings.closeUps', 'settings.closeUps.hint', 'footer.closeUpPhotos', 'footer.closeUpStreets'];
    for (const [lang, f] of Object.entries(files)) for (const k of keys) expect(f, `${lang}:${k}`).toHaveProperty(k);
  });

  test("the Ukrainian close-up texts use uk.json's own apostrophe, U+2019", () => {
    // U+02BC and U+2019 look alike and read alike, but no search, diff or sort matches one against the other, so
    // a file holding both has two spellings of the same word. uk.json's own is U+2019 and these keys keep to it.
    // (scripts/translation-review-lib.ts has no check of this class — it compares alphabets and parameters only;
    // six older uk keys still use a straight quote, which is noted for the design task, not changed here.)
    const mine = Object.keys(uk).filter((k) => k.startsWith('closeup.') || k.startsWith('settings.closeUps')
      || k.startsWith('footer.closeUp') || k === 'topic.9.step.find.closeUp');
    expect(mine.length).toBeGreaterThan(20);
    expect(mine.filter((k) => /[\u02bc'`\u00b4]/.test(uk[k as keyof typeof uk]))).toEqual([]);
    expect(uk['closeup.note.greenwich']).toContain('подвір\u2019я');
  });
});
