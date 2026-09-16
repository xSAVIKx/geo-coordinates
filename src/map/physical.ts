import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, GeometryObject, Topology } from 'topojson-specification';
import waterJson from './data/physical-water.json';
import { boundsIntersect, type GeoBounds } from './geometry';
import { asMultiPolygon, levelOfDetail, lineParts, polygonParts, REGION, REGION_DETAIL_ZOOM, regionActive, visibleParts, type Part } from './world';

/*
 * The Physical map style's vectors (spec §3): world rivers and lakes (Natural Earth 50m, scripts/build-physical-water.ts)
 * over the relief texture, and physical names. Inside Central Europe the detailed regional lakes (zoom 4) and rivers
 * (zoom 6) from central-europe.json take over, following the regional level of detail (world.ts).
 */
export type PhysicalKind = 'mountains' | 'desert' | 'plateau' | 'sea' | 'river';
export interface PhysicalName { id: string; lat: number; lon: number; kind: PhysicalKind; minZoom: number }

const n = (id: string, lat: number, lon: number, kind: PhysicalKind, minZoom: number): PhysicalName => ({ id, lat, lon, kind, minZoom });
export const PHYSICAL_NAMES: readonly PhysicalName[] = [
  n('tatra', 49.18, 20.08, 'mountains', 6), n('sudetes', 50.75, 16.1, 'mountains', 5), n('carpathians', 47.6, 24.8, 'mountains', 3),
  n('alps', 46.5, 10.2, 'mountains', 2.5), n('pyrenees', 42.7, 0.9, 'mountains', 4), n('caucasus', 42.9, 44, 'mountains', 3),
  n('urals', 58, 59.3, 'mountains', 2), n('scandinavian', 65, 14.5, 'mountains', 2.5), n('himalayas', 28.3, 84.5, 'mountains', 1),
  n('tibet', 33.5, 88, 'plateau', 1.5), n('andes', -19, -67.8, 'mountains', 1), n('rockies', 45, -111, 'mountains', 1),
  n('atlas', 31.8, -5.5, 'mountains', 3), n('sahara', 23.5, 10, 'desert', 1), n('gobi', 43, 105, 'desert', 1.5),
  n('kalahari', -23, 21.5, 'desert', 2), n('arabian', 22.5, 47.5, 'desert', 2), n('baltic', 55.6, 17.8, 'sea', 2),
  n('northsea', 56, 3.5, 'sea', 2.5), n('mediterranean', 35, 18, 'sea', 1.5), n('blacksea', 43.2, 34.5, 'sea', 2),
  n('caribbean', 15, -75, 'sea', 1.5), n('redsea', 20, 38.5, 'sea', 3), n('amazon', -3.3, -60, 'river', 1.5), n('nile', 25, 32.7, 'river', 2),
];

/** The largest Natural Earth scalerank drawn at a flat zoom: the great rivers on the world map, all of them from zoom 4. */
export const riverRankFor = (zoom: number): number => (zoom < 2 ? 4 : zoom < 4 ? 6 : 9);

type WaterTopology = Topology<{ rivers: GeometryCollection<{ r: number }>; lakes: GeometryCollection<{ r: number }> }>;
const topo = waterJson as unknown as WaterTopology;
// @types/topojson-specification's GeometryObject<P> union includes NullObject, which is not parameterized over P
// (its properties stay {}); every river here is an actual Line/MultiLineString with a scale rank, so narrow the
// element type back to what it really is instead of widening every properties access to `{ r: number } | {}`.
type River = GeometryObject & { properties: { r: number } };
const riversOf = (t: WaterTopology): readonly River[] => t.objects.rivers.geometries as unknown as readonly River[];

// Detail levels by flat zoom, thinned and cached by world.ts's shared `levelOfDetail`: the whole world's rivers and
// lakes are drawn at every level, so the coarsest one (the world map) has to be cheap.
const LEVELS = [1, 4, 16] as const;
interface WaterData { rivers: { r: number; parts: Part<GeoJSON.Position[]>[] }[]; lakes: Part<GeoJSON.Position[][]>[] }

const waterData = levelOfDetail(topo, LEVELS, (t): WaterData => ({
  rivers: riversOf(t).map((g) => ({ r: g.properties.r, parts: lineParts(mesh(t, { type: 'GeometryCollection', geometries: [g] })) })),
  lakes: polygonParts(asMultiPolygon(feature(t, t.objects.lakes))),
}));

const insideRegion = (b: GeoBounds) => b.west >= REGION.west && b.east <= REGION.east && b.south >= REGION.south && b.north <= REGION.north;

export function physicalWaterFor(zoom: number, view: GeoBounds): { rivers: GeoJSON.MultiLineString; lakes: GeoJSON.MultiPolygon } {
  const d = waterData(zoom);
  const rank = riverRankFor(zoom);
  // Inside the region box the detailed regional water (world.ts) is drawn instead of this coarser world data:
  // the regional lakes from REGION_MIN_ZOOM (`regionActive`, the same test landFor makes), the regional rivers
  // from REGION_DETAIL_ZOOM (the same test detailFor makes). Whatever is drawn there is dropped here, so no
  // lake or river is painted twice with its two outlines a hair apart.
  const regionalRivers = zoom >= REGION_DETAIL_ZOOM && boundsIntersect(view, REGION);
  const regionalLakes = regionActive(zoom, view);
  const outside = <T>(parts: Part<T>[]) => parts.filter((p) => !insideRegion(p.bounds));
  const rivers = d.rivers.filter((river) => river.r <= rank).flatMap((river) => (regionalRivers ? outside(river.parts) : river.parts));
  const lakes = regionalLakes ? outside(d.lakes) : d.lakes;
  return { rivers: { type: 'MultiLineString', coordinates: visibleParts(rivers, view) }, lakes: { type: 'MultiPolygon', coordinates: visibleParts(lakes, view) } };
}
