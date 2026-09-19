import { feature, mesh } from 'topojson-client';
import type { GeometryObject } from 'topojson-specification';
import { CITY_STREET_ZOOM, type CityBox, type CityBoxId } from './cityBoxes';
import { unpackStreetTopology, type StreetClass, type StreetRoad, type StreetTopology } from './cityStreets';
import type { GeoBounds } from './geometry';
import type { LangCode } from '../geo/types';
import { asMultiPolygon, decodeArcs, levelOfDetail, lineParts, polygonParts, visibleParts, type Part } from './world';

/*
 * The street map inside a city close-up box (Places up close spec §5): roads by class, railways, waterways, water
 * bodies and green areas from OpenStreetMap (scripts/build-city-streets.ts), plus the street and place names.
 * There are no building outlines: they measured 2.3 MB for one box, which is a quarter of the whole file budget
 * (planning ruling R6); in the six boxes with orthophotos the photo itself shows the buildings.
 *
 * Each box's topology is a data block in the page (scripts/city-plugin.ts), read the first time the view enters
 * that box and then kept: a page that never opens a close-up never inflates 2.7 MB of JSON (planning ruling R8).
 *
 * The blocks are the *gzipped* TopoJSON in base64 (Task 2's controller ruling: the raw text would have put the page
 * past the 8 MiB cap), so a box cannot be read synchronously — DecompressionStream is a stream. `loadStreets`
 * therefore returns a promise, `streetsFor` draws nothing until that promise has resolved, and `onStreetsLoaded`
 * lets the two layers that draw this redraw when it does. Nothing here throws on bad data: `unpackStreetTopology`
 * already returns null for a missing DecompressionStream, a truncated block or a topology of the wrong shape, and a
 * box with no data simply draws no streets while the rest of the map carries on ("a failure in the street layer
 * disables that layer only"). The failure is never persisted: the next page session tries again.
 */
/** 0 motorway/trunk … 5 pedestrian: the classes scripts/build-city-streets.ts writes (cityStreets.ts). */
export type { StreetClass } from './cityStreets';

/**
 * The flat zoom each road class first appears at. Class 0 (motorways and trunk roads) comes in with the layer
 * itself; the smaller classes join as the box grows, so a box that is still a smudge across the view is a few
 * strokes rather than a scribble. The fit zooms are 2 659 to 5 009, so every class is drawn once a box fills
 * the view.
 */
export const STREET_CLASS_MIN_ZOOM: readonly number[] = [CITY_STREET_ZOOM, 60, 150, 400, 900, 2000];
/** Street names need a street wide enough to write along: about a fifth of the way to the fit zoom. */
export const STREET_NAME_ZOOM = 900;
/** District names (OSM `place=suburb|quarter|neighbourhood`) come earlier — they name a whole area. */
export const PLACE_NAME_ZOOM = 200;

/** The layer's opacity: it fades in over one octave from CITY_STREET_ZOOM rather than appearing all at once (spec §5). */
export function streetFade(zoom: number): number {
  return Math.max(0, Math.min(1, (zoom - CITY_STREET_ZOOM) / CITY_STREET_ZOOM));
}

export interface StreetName { id: string; text: string; lat: number; lon: number; cls: StreetClass }

/**
 * The name to write on a street: OpenStreetMap's local `name` — the name on the street sign — unless it is
 * written in a script this page's language does not use, in which case `name:en` where the data has one
 * (spec §4, planning ruling R24). Latin for English and Polish; Latin or Cyrillic for Ukrainian. A Tokyo street
 * called 青梅街道 is useless to a pupil in Katowice; a Paris street called Rue de Rivoli is exactly right.
 */
const READABLE: Record<LangCode, RegExp> = {
  en: /\p{Script=Latin}/u, pl: /\p{Script=Latin}/u, uk: /\p{Script=Latin}|\p{Script=Cyrillic}/u,
};
export function readableName(local: string, english: string | undefined, lang: LangCode): string {
  return READABLE[lang].test(local) || !english ? local : english;
}

/**
 * Whether a name, as it will be written, is in a script this page's language reads. `readableName` puts the
 * English form on a street whenever the data has one, so a `false` here means the data had nothing better — a
 * Tokyo district called 恵比寿, say. The map still writes such a name, because it is the only name there is, but
 * the layout keeps only a couple of them (`placeStreetLabels`): they are the ones a pupil in Katowice gets least
 * from, and the readable name beside them is worth more.
 */
export function readableHere(text: string, lang: LangCode): boolean {
  return READABLE[lang].test(text);
}

export interface StreetLayers {
  roads: { cls: StreetClass; line: GeoJSON.MultiLineString }[];
  rail: GeoJSON.MultiLineString;
  waterways: GeoJSON.MultiLineString;
  water: GeoJSON.MultiPolygon;
  green: GeoJSON.MultiPolygon;
  names: StreetName[];
}

/** A name before the page language has chosen between the local and the English form (`readableName`). */
interface NameCandidate { id: string; local: string; english?: string; lat: number; lon: number; cls: StreetClass }

interface BoxData {
  roads: { cls: StreetClass; parts: Part<GeoJSON.Position[]>[] }[];
  rail: Part<GeoJSON.Position[]>[];
  waterways: Part<GeoJSON.Position[]>[];
  water: Part<GeoJSON.Position[][]>[];
  green: Part<GeoJSON.Position[][]>[];
  /** One candidate point per distinct street name, at the middle of its longest way. */
  names: NameCandidate[];
  /** District names (OSM `place` nodes): the same at every level of detail. */
  places: NameCandidate[];
}

/*
 * Level of detail by flat zoom, the same shared helper the Central Europe data, Political and Physical use
 * (world.ts): arcs are thinned to half a map unit at the level's zoom. The ladder is geared to the range a box is
 * actually looked at in — from a smudge at zoom 24 to filling the view at 2 659-5 009 — and the finest level
 * thins to about 3.5 m, which is under one map unit at zoom 6000.
 */
const LEVELS = [24, 100, 400, 1600, 6000] as const;

/** A road geometry as it really is: @types/topojson-specification's union includes an unparameterised NullObject. */
type Road = GeometryObject & { properties: StreetRoad };

const boxes = new Map<CityBoxId, (zoom: number) => BoxData>();
const loading = new Map<CityBoxId, Promise<boolean>>();
const listeners = new Set<() => void>();

/** A fresh empty result. Not one shared object: callers are handed a value they may keep and read at any time. */
const emptyLayers = (): StreetLayers => ({
  roads: [], rail: { type: 'MultiLineString', coordinates: [] }, waterways: { type: 'MultiLineString', coordinates: [] },
  water: { type: 'MultiPolygon', coordinates: [] }, green: { type: 'MultiPolygon', coordinates: [] }, names: [],
});

/*
 * The street layer's *own* failure switch, and the reason it is not `reportHealth({ type: 'vector-fail' })`.
 *
 * That event is a single page-session flag which fallback.ts turns into "political -> atlas, physical -> atlas"
 * plus the note "This device can't draw this style; showing Atlas". It was right for Political.svelte and
 * PhysicalWater.svelte, each of which only ever renders inside the one style it names. This layer renders in all
 * four, so raising that event would take Political and Physical down with it — in Satellite, where neither of
 * those layers is even mounted, a broken street layer used to switch the pupil to Atlas and tell them their
 * device could not draw the style. The spec is verbatim "a failure in the street layer disables that layer only".
 *
 * So a street failure is remembered here and nowhere else: every `streetsFor` returns nothing from then on, the
 * two layers that draw streets fall quiet, and the rest of the map — the chosen style included — is untouched.
 * Like every other failure in this feature it lasts the page session only.
 */
let disabled = false;

export function streetsDisabled(): boolean {
  return disabled;
}

/** Switches the street layer off for the rest of the session. Safe to call from a render or an error boundary. */
export function disableStreets(reason: unknown): void {
  if (!disabled) console.warn('city streets: the street layer is off for this page session:', reason);
  disabled = true;
}

/** Tests only: puts the layer back. */
export function resetStreets(): void {
  disabled = false;
}

export function streetsLoaded(id: CityBoxId): boolean {
  return boxes.has(id);
}

/**
 * Runs `fn` when a box's streets have been unpacked, so a layer that drew nothing while the view was entering the
 * box redraws with the streets in it. Returns the unsubscribe (a Svelte `$effect` teardown).
 */
export function onStreetsLoaded(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** The arc index lists of a road, whichever line shape the builder gave it. */
function roadLines(g: Road): readonly (readonly number[])[] {
  if (g.type === 'MultiLineString') return g.arcs as number[][];
  if (g.type === 'LineString') return [g.arcs as number[]];
  return [];
}

/**
 * One line's points, its arcs stitched end to end — the shape `mesh()` would give it, without mesh's own work.
 * A negative index `i` means the arc `~i` walked backwards, and neighbouring arcs share their joint vertex.
 *
 * This is done by hand because the name of every street has to be found, and `mesh()` per street is quadratic:
 * it allocates and scans an array as long as the whole topology's arc list each time. Giza's box holds 1 921
 * named streets over 7 338 arcs, and one level of detail took 480 ms that way — five levels of that is two and a
 * half seconds of stalled zooming. Reading the arcs straight costs about 3 ms a level.
 */
function stitch(arcs: readonly [number, number][][], indexes: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const i of indexes) {
    const arc = arcs[i < 0 ? ~i : i];
    // An index with no arc behind it means the topology is not what it says it is. Skipping it would join two
    // unrelated ends into one line and put the name somewhere between them; give the whole line up instead.
    if (!arc) return [];
    if (i < 0) for (let k = arc.length - (out.length ? 2 : 1); k >= 0; k--) out.push(arc[k]!);
    else for (let k = out.length ? 1 : 0; k < arc.length; k++) out.push(arc[k]!);
  }
  return out;
}

/** Longest way wins: a street is many OSM ways, and its name goes on the longest piece inside the box. */
function nameCandidates(t: StreetTopology, roads: readonly Road[]): NameCandidate[] {
  // `levelOfDetail` hands this a topology whose arcs are already absolute (no `transform`); `decodeArcs` copes
  // with either, so a caller that ever passes the raw quantized topology gets the same answer.
  const arcs = decodeArcs(t);
  const best = new Map<string, { len: number; name: NameCandidate }>();
  roads.forEach((g, i) => {
    const local = g.properties.n;
    if (local === undefined) return;
    let run: [number, number][] = [];
    let len = 0;
    for (const indexes of roadLines(g)) {
      const points = stitch(arcs, indexes);
      let d = 0;
      for (let k = 1; k < points.length; k++) d += Math.hypot(points[k]![0] - points[k - 1]![0], points[k]![1] - points[k - 1]![1]);
      if (points.length >= 2 && d > len) { run = points; len = d; }
    }
    if (run.length < 2) return;
    const prev = best.get(local);
    if (prev && prev.len >= len) return;
    const mid = run[Math.floor(run.length / 2)]!;
    best.set(local, { len, name: { id: `r${i}`, local, english: g.properties.e, lat: mid[1], lon: mid[0], cls: g.properties.c } });
  });
  return [...best.values()].map((b) => b.name);
}

function build(t: StreetTopology, names: NameCandidate[], places: NameCandidate[]): BoxData {
  const roadGeoms = t.objects.roads.geometries as unknown as Road[];
  const byClass = new Map<StreetClass, Road[]>();
  for (const g of roadGeoms) {
    const list = byClass.get(g.properties.c) ?? [];
    list.push(g);
    byClass.set(g.properties.c, list);
  }
  const lines = (key: 'rail' | 'waterways') => lineParts(mesh(t, t.objects[key]));
  const areas = (key: 'water' | 'green') => polygonParts(asMultiPolygon(feature(t, t.objects[key])));
  return {
    roads: [...byClass.entries()].sort((a, b) => a[0] - b[0]).map(([cls, geoms]) => ({
      cls, parts: lineParts(mesh(t, { type: 'GeometryCollection', geometries: geoms })),
    })),
    rail: lines('rail'),
    waterways: lines('waterways'),
    water: areas('water'),
    green: areas('green'),
    names,
    places,
  };
}

/**
 * Reads the box's data block, once. Resolves true when the box's streets are ready to draw, false when they cannot
 * be had at all — a block missing from the page, a browser with no DecompressionStream, a topology of the wrong
 * shape. A false is remembered, so a page that cannot unpack does not try again on every frame.
 */
export function loadStreets(id: CityBoxId): Promise<boolean> {
  const started = loading.get(id);
  if (started) return started;
  const run = (async () => {
    try {
      const block = document.getElementById(`geo-city-${id}`);
      if (!block?.textContent) {
        console.warn(`city streets: data for ${id} is missing from the page (geo-city-${id})`);
        return false;
      }
      const topo = await unpackStreetTopology(block.textContent);
      if (!topo) {
        console.warn(`city streets: the data block for ${id} could not be unpacked (geo-city-${id})`);
        return false;
      }
      // District names have no geometry to thin, so they are read once and handed to every level of detail.
      const places: NameCandidate[] = topo.places.map((p) => ({ id: p.id, local: p.name, lat: p.lat, lon: p.lon, cls: 0 }));
      // Street names are read once too, from the unthinned arcs. Reading them per level instead put a name at the
      // middle of *that level's* copy of its street, so a name hopped a few pixels whenever a zoom crossed a level
      // boundary; and it was four times the work for an answer that should not depend on the zoom at all.
      const names = nameCandidates(topo, topo.objects.roads.geometries as unknown as Road[]);
      boxes.set(id, levelOfDetail(topo, LEVELS, (t) => build(t, names, places)));
    } catch (e) {
      // The promise never rejects: `streetsFor` starts this from a render and no caller is waiting to catch it.
      console.warn(`city streets: ${id} could not be read:`, e);
      return false;
    }
    for (const fn of [...listeners]) fn();
    return true;
  })();
  loading.set(id, run);
  return run;
}

/**
 * Everything of `box` a view at flat `zoom` covering `view` draws. Call only inside the box (`visibleCityBox`).
 * Empty until the box's block has been unpacked — the first call starts that, and `onStreetsLoaded` says when it
 * is worth asking again.
 */
export function streetsFor(box: CityBox, zoom: number, view: GeoBounds, lang: LangCode): StreetLayers {
  if (disabled) return emptyLayers();
  const level = boxes.get(box.id);
  if (!level) {
    void loadStreets(box.id);
    return emptyLayers();
  }
  try {
    return layersOf(level(zoom), zoom, view, lang);
  } catch (e) {
    // `level(zoom)` builds a level of detail the first time a zoom reaches it, so a bad topology throws *here*,
    // inside a caller's render, long after `loadStreets` returned. The layer switches itself off (above) and the
    // map carries on; no caller of this function ever has to catch.
    disableStreets(e);
    return emptyLayers();
  }
}

/** The drawable layers of one already-built level of detail; the part of `streetsFor` that may throw. */
function layersOf(d: BoxData, zoom: number, view: GeoBounds, lang: LangCode): StreetLayers {
  // Pedestrian ways (class 5) are drawn but never named: too many, too short, and a pupil reads the big streets.
  const named = zoom >= STREET_NAME_ZOOM ? d.names.filter((n) => n.cls <= 4) : [];
  const districts = zoom >= PLACE_NAME_ZOOM ? d.places : [];
  // Districts first, then streets, and a name only once: two streets can carry the same name in one box, and
  // `readableName` can fold a local and an English name onto one text as well.
  const seen = new Set<string>();
  const names: StreetName[] = [];
  for (const n of [...districts, ...named]) {
    const text = readableName(n.local, n.english, lang);
    if (seen.has(text)) continue;
    seen.add(text);
    names.push({ id: n.id, text, lat: n.lat, lon: n.lon, cls: n.cls });
  }
  return {
    roads: d.roads
      .filter((r) => zoom >= STREET_CLASS_MIN_ZOOM[r.cls]!)
      .map((r) => ({ cls: r.cls, line: { type: 'MultiLineString' as const, coordinates: visibleParts(r.parts, view) } }))
      .filter((r) => r.line.coordinates.length > 0),
    rail: { type: 'MultiLineString', coordinates: visibleParts(d.rail, view) },
    waterways: { type: 'MultiLineString', coordinates: visibleParts(d.waterways, view) },
    water: { type: 'MultiPolygon', coordinates: visibleParts(d.water, view) },
    green: { type: 'MultiPolygon', coordinates: visibleParts(d.green, view) },
    names,
  };
}
