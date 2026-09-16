import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, GeometryObject, Topology } from 'topojson-specification';
import type { LangCode } from '../geo/types';
import politicalJson from './data/political-pol.json';
import { boundsIntersect, RAD, type GeoBounds } from './geometry';
import { asMultiPolygon, levelOfDetail, lineParts, paddedView, polygonParts, type Part } from './world';

/*
 * The Political map style (spec §3): pastel country fills whose neighbours differ, coast and borders from the same
 * shapes (planning ruling R8), and label data. Natural Earth's Poland point of view (scripts/build-political.ts).
 */
export interface CountryProps { a2: string; c: number; lr: number; ml: number; lx: number; ly: number }
type PoliticalTopology = Topology<{ countries: GeometryCollection<CountryProps> }>;
const topo = politicalJson as unknown as PoliticalTopology;
// @types/topojson-specification's GeometryObject<P> union includes NullObject, which is not parameterized over P
// (its properties stay {}); every country here is an actual Polygon/MultiPolygon with an id, so narrow the element
// type back to what it really is instead of widening every properties access to `CountryProps | {}`.
type Country = GeometryObject & { id: string; properties: CountryProps };
const countriesOf = (t: PoliticalTopology): readonly Country[] => t.objects.countries.geometries as unknown as readonly Country[];

/**
 * How many fill colours the countries were coloured with — scripts/political-colours.ts's PALETTE_SIZE, which the
 * build has already checked every country against; the drawn side keeps `.c0 … .c5` / `--pol-0 … --pol-5` in step.
 */
export const POLITICAL_COLOURS = 6;

/** Capitals among the lesson's places, drawn with a ring in the Political style. */
export const CAPITALS: ReadonlySet<string> = new Set([
  'warsaw', 'kyiv', 'london', 'paris', 'berlin', 'rome', 'madrid', 'reykjavik', 'oslo', 'cairo', 'nairobi', 'dakar',
  'mexicocity', 'buenosaires', 'lima', 'quito', 'tokyo', 'beijing', 'delhi', 'singapore', 'jakarta', 'washington', 'suva',
  'prague', 'bratislava', 'vienna', 'budapest', 'vilnius', 'riga',
]);

// Detail levels by flat zoom: arcs thinned to half a pixel at the level's zoom (world.ts `levelOfDetail`, shared with
// the Atlas region data). The whole world is drawn at every level, so the coarsest one has to be cheap.
//
// 0.25 and 0.5 are the globe's levels (`globeLevel` below); flat maps still pick theirs from their own zoom, so
// what a flat Political map draws is unchanged.
const LEVELS = [0.25, 0.5, 1, 3, 8, 24] as const;

/*
 * The globe's own level.
 *
 * `levelOfDetail`'s tolerance is half a pixel on a *960-unit-wide* map at the level's zoom, and a globe reports the
 * flat zoom of its coverage (2 -- the disc spans 180 deg), not of its size. The lab's globe is about 350 px across,
 * so it was being handed arcs thinned for a map nearly three times as wide. Two factors put that right:
 *
 *   - `cssWidth / 960`: what the view is really drawn at, so a small globe asks for less;
 *   - 0.5: Political's tolerance is a whole pixel, not half of one. That rule was written for Atlas's hairlines;
 *     these are area fills under a 0.9 px coast stroke, where a pixel of thinning cannot be seen -- checked on 2x
 *     screenshots of the globe against the level above it, which are indistinguishable.
 *
 * Together they take the lab's globe from level 1 to 0.25, and the whole world's path data on it from 354 KB a
 * frame to 241 KB (Atlas draws 156 KB). Never more detail than the flat-zoom rule already allowed: `min(1, ...)`.
 */
export const globeLevel = (zoom: number, cssWidth: number): number => 0.5 * zoom * Math.min(1, cssWidth / 960);

/*
 * Hemisphere culling for the globe.
 *
 * On a flat map `visibleParts`' boxes do the work, but a globe's own box is the whole world at zoom 1
 * (`globeBounds` widens to +/-180 as soon as the view reaches a pole), so every one of the 210 countries used to
 * be handed to d3 on every frame of a drag -- half of them on the side of the Earth facing away, where the
 * projection's clipAngle(90) throws the result away after doing all the work. Measured on the lab's globe under
 * CPU x4: 33 ms median and 300 ms at p90, against Atlas's 17 / 100.
 *
 * Each part therefore carries the smallest spherical cap that provably contains it (`capOf`). A cap is convex
 * while its radius is under 90 degrees, and a great-circle edge between two vertices inside a convex cap stays
 * inside it, so the cap contains the drawn shape, not just its vertices. A part can then reach the near
 * hemisphere only if the angle between the view's centre and the cap's centre is less than 90 degrees + the
 * cap's radius -- one dot product per part per frame. Caps of 90 degrees or more are never culled.
 */
type Vec3 = readonly [number, number, number];
/** The unit vector of a point on the sphere: what a globe's `ctx.center` becomes for `politicalFor`. */
export function eyeVector(lon: number, lat: number): Vec3 {
  const p = lat * RAD, l = lon * RAD, c = Math.cos(p);
  return [c * Math.cos(l), c * Math.sin(l), Math.sin(p)];
}
/** `cosLimit`: what `dot(eye, centre)` has to beat for any of the shape to be within 90 degrees of the eye. */
interface Cap { centre: Vec3; cosLimit: number }
const NEVER_CULLED: Cap = { centre: [0, 0, 1], cosLimit: -1 };
/** A degree of slack, so a country whose sliver is exactly on the limb still gets drawn. */
const CAP_MARGIN = RAD;

function capOf(points: readonly GeoJSON.Position[]): Cap {
  let sx = 0, sy = 0, sz = 0;
  for (const [lon = 0, lat = 0] of points) { const v = eyeVector(lon, lat); sx += v[0]; sy += v[1]; sz += v[2]; }
  const n = Math.hypot(sx, sy, sz);
  if (!n) return NEVER_CULLED;
  const centre: Vec3 = [sx / n, sy / n, sz / n];
  let minDot = 1;
  for (const [lon = 0, lat = 0] of points) {
    const v = eyeVector(lon, lat);
    minDot = Math.min(minDot, centre[0] * v[0] + centre[1] * v[1] + centre[2] * v[2]);
  }
  const limit = Math.acos(Math.max(-1, Math.min(1, minDot))) + Math.PI / 2 + CAP_MARGIN;
  return limit >= Math.PI ? NEVER_CULLED : { centre, cosLimit: Math.cos(limit) };
}

interface Capped<T> extends Part<T> { cap: Cap }
const cappedPolygons = (parts: Part<GeoJSON.Position[][]>[]): Capped<GeoJSON.Position[][]>[] =>
  parts.map((p) => ({ ...p, cap: capOf(p.coordinates.flat()) }));
const cappedLines = (parts: Part<GeoJSON.Position[]>[]): Capped<GeoJSON.Position[]>[] =>
  parts.map((p) => ({ ...p, cap: capOf(p.coordinates) }));

/** `visibleParts` plus, on a globe, the far-hemisphere cull above. */
function visibleCapped<T>(parts: Capped<T>[], view: GeoBounds, eye: Vec3 | null): T[] {
  const padded = paddedView(view);
  const out: T[] = [];
  for (const p of parts) {
    if (!boundsIntersect(padded, p.bounds)) continue;
    if (eye && eye[0] * p.cap.centre[0] + eye[1] * p.cap.centre[1] + eye[2] * p.cap.centre[2] <= p.cap.cosLimit) continue;
    out.push(p.coordinates);
  }
  return out;
}

interface PoliticalData { fills: { id: string; colour: number; parts: Capped<GeoJSON.Position[][]>[] }[]; borders: Capped<GeoJSON.Position[]>[]; coast: Capped<GeoJSON.Position[]>[] }

const politicalData = levelOfDetail(topo, LEVELS, (t): PoliticalData => {
  const countries = t.objects.countries;
  return {
    fills: countriesOf(t).map((g) => ({ id: g.id, colour: g.properties.c, parts: cappedPolygons(polygonParts(asMultiPolygon(feature(t, g) as GeoJSON.Feature))) })),
    // The same shapes give both lines: an edge between two countries is a border, an edge only one country
    // has is its coast (planning ruling R8), so no coastline ever runs beside a border a hair away from it.
    borders: cappedLines(lineParts(mesh(t, countries, (a, b) => a !== b))),
    coast: cappedLines(lineParts(mesh(t, countries, (a, b) => a === b))),
  };
});

export interface CountryFill { id: string; colour: number; geometry: GeoJSON.MultiPolygon }
export interface PoliticalLayers { fills: CountryFill[]; borders: GeoJSON.MultiLineString; coast: GeoJSON.MultiLineString }

/**
 * The fills, borders and coast a view at flat `zoom` covering `view` can see. `eye`, on a globe, is the unit
 * vector of the point facing the viewer (`eyeVector(ctx.center...)`): everything the far side of the Earth is then
 * left out before d3 ever sees it. Flat maps pass `null` and are filtered by their box alone, as before.
 */
export function politicalFor(zoom: number, view: GeoBounds, eye: Vec3 | null = null): PoliticalLayers {
  const d = politicalData(zoom);
  return {
    fills: d.fills
      .map((f) => ({ id: f.id, colour: f.colour, geometry: { type: 'MultiPolygon' as const, coordinates: visibleCapped(f.parts, view, eye) } }))
      .filter((f) => f.geometry.coordinates.length > 0),
    borders: { type: 'MultiLineString', coordinates: visibleCapped(d.borders, view, eye) },
    coast: { type: 'MultiLineString', coordinates: visibleCapped(d.coast, view, eye) },
  };
}

export interface CountryLabel { id: string; a2: string; lat: number; lon: number; minZoom: number }

/** Natural Earth's MIN_LABEL is a web-map zoom; our flat zoom 1 (a 960 px world) is about web zoom 2. */
export const labelMinZoom = (minLabel: number): number => 2 ** (minLabel - 2);

let labels: CountryLabel[] | null = null;
/** Every country Intl can name, most important first (Natural Earth's LABELRANK, then the zoom it may be written at). */
export function countryLabels(): readonly CountryLabel[] {
  return (labels ??= countriesOf(topo)
    .filter((g) => g.properties.a2 !== '')
    .map((g) => ({ id: g.id, p: g.properties }))
    .sort((a, b) => a.p.lr - b.p.lr || a.p.ml - b.p.ml)
    .map(({ id, p }) => ({ id, a2: p.a2, lat: p.ly, lon: p.lx, minZoom: labelMinZoom(p.ml) })));
}

/**
 * The few names `Intl.DisplayNames` gives that do not belong on a school map (planning ruling R22). Each of these
 * countries carries a label from zoom 1–4, so an 11-year-old meets them on the very first world map:
 *
 * - the disambiguated Congos, `Congo - Kinshasa` / `Congo - Brazzaville`, which read as a note rather than a name;
 * - the renaming brackets of `Myanmar (Burma)`;
 * - `Hong Kong SAR China` and its longer Polish and Ukrainian forms, administrative wording no lesson needs;
 * - `Côte d’Ivoire` left in French for English and Polish readers, where both languages have their own name;
 * - the full Polish and Ukrainian names of South Africa, which at world zoom are longer than the country.
 *
 * Only these; every other name Intl gives was read through in all three languages and is what a school atlas says.
 * Anything not listed falls through to Intl, so the table stays small.
 */
export const COUNTRY_NAME_OVERRIDES: Partial<Record<LangCode, Record<string, string>>> = {
  en: { CD: 'DR Congo', CG: 'Congo', MM: 'Myanmar', HK: 'Hong Kong', CI: 'Ivory Coast' },
  pl: { CD: 'DR Konga', MM: 'Mjanma', HK: 'Hongkong', CI: 'Wybrzeże Kości Słoniowej', ZA: 'RPA' },
  uk: { CD: 'ДР Конго', CG: 'Конго', MM: 'Мʼянма', HK: 'Гонконг', ZA: 'ПАР' },
};

const displayNames = new Map<LangCode, Intl.DisplayNames>();
/** The country's name in the page language: the table above where it has one, otherwise `Intl.DisplayNames` (spec §3). */
export function countryName(a2: string, lang: LangCode): string {
  const override = COUNTRY_NAME_OVERRIDES[lang]?.[a2];
  if (override) return override;
  let names = displayNames.get(lang);
  if (!names) { names = new Intl.DisplayNames([lang], { type: 'region' }); displayNames.set(lang, names); }
  return names.of(a2) ?? a2;
}
