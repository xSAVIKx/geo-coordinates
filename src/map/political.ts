import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, GeometryObject, Topology } from 'topojson-specification';
import type { LangCode } from '../geo/types';
import politicalJson from './data/political-pol.json';
import type { GeoBounds } from './geometry';
import { asMultiPolygon, levelOfDetail, lineParts, polygonParts, visibleParts, type Part } from './world';

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
const LEVELS = [1, 3, 8, 24] as const;
interface PoliticalData { fills: { id: string; colour: number; parts: Part<GeoJSON.Position[][]>[] }[]; borders: Part<GeoJSON.Position[]>[]; coast: Part<GeoJSON.Position[]>[] }

const politicalData = levelOfDetail(topo, LEVELS, (t): PoliticalData => {
  const countries = t.objects.countries;
  return {
    fills: countriesOf(t).map((g) => ({ id: g.id, colour: g.properties.c, parts: polygonParts(asMultiPolygon(feature(t, g) as GeoJSON.Feature)) })),
    // The same shapes give both lines: an edge between two countries is a border, an edge only one country
    // has is its coast (planning ruling R8), so no coastline ever runs beside a border a hair away from it.
    borders: lineParts(mesh(t, countries, (a, b) => a !== b)),
    coast: lineParts(mesh(t, countries, (a, b) => a === b)),
  };
});

export interface CountryFill { id: string; colour: number; geometry: GeoJSON.MultiPolygon }
export interface PoliticalLayers { fills: CountryFill[]; borders: GeoJSON.MultiLineString; coast: GeoJSON.MultiLineString }

/** The fills, borders and coast a view at flat `zoom` covering `view` can see. */
export function politicalFor(zoom: number, view: GeoBounds): PoliticalLayers {
  const d = politicalData(zoom);
  return {
    fills: d.fills
      .map((f) => ({ id: f.id, colour: f.colour, geometry: { type: 'MultiPolygon' as const, coordinates: visibleParts(f.parts, view) } }))
      .filter((f) => f.geometry.coordinates.length > 0),
    borders: { type: 'MultiLineString', coordinates: visibleParts(d.borders, view) },
    coast: { type: 'MultiLineString', coordinates: visibleParts(d.coast, view) },
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

const displayNames = new Map<LangCode, Intl.DisplayNames>();
/** The country's name in the page language (spec §3: `Intl.DisplayNames`). */
export function countryName(a2: string, lang: LangCode): string {
  let names = displayNames.get(lang);
  if (!names) { names = new Intl.DisplayNames([lang], { type: 'region' }); displayNames.set(lang, names); }
  return names.of(a2) ?? a2;
}
