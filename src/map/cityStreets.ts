import type { GeometryCollection, Topology } from 'topojson-specification';

/*
 * Unpacking the city close-up street data (Places up close spec §4).
 *
 * scripts/build-city-streets.ts commits one gzipped TopoJSON per box, src/map/data/city/streets/<id>.json.gz,
 * because the twelve are 2 734 653 B as text and the page is a single offline file capped at 8 388 608 B; gzipped
 * they are 785 349 B (1 047 132 B once base64'd into the page). Task 3 puts each file into the page as base64
 * in its own <script type="application/x-geo-city"> block; this module turns one of those blocks back into a
 * topology.
 *
 * Nothing here throws. A browser without DecompressionStream, a truncated block or a topology of the wrong shape
 * all return null, and the caller draws no streets while the rest of the map carries on — the fallback rule every
 * other vector layer follows ("a failure in the street layer disables that layer only"). The failure is never
 * persisted: the next page session tries again.
 */

/** 0 motorway/trunk, 1 primary, 2 secondary, 3 tertiary, 4 residential/unclassified/living street, 5 pedestrian. */
export type StreetClass = 0 | 1 | 2 | 3 | 4 | 5;

/** `n` is the name on the street sign; `e` an English name only where it differs from it (planning ruling R24). */
export interface StreetRoad { c: StreetClass; n?: string; e?: string }

export interface StreetPlace { id: string; name: string; lat: number; lon: number }

export type StreetTopology = Topology<{
  roads: GeometryCollection<StreetRoad>;
  rail: GeometryCollection;
  waterways: GeometryCollection;
  water: GeometryCollection;
  green: GeometryCollection;
}> & {
  /** Named neighbourhoods inside the box, for labelling; may be empty. */
  places: StreetPlace[];
  source: string;
};

/** How the committed street files are packed, and what `unpackStreetTopology` expects to be handed. */
export const STREET_ENCODING = 'gzip';

const LAYERS = ['roads', 'rail', 'waterways', 'water', 'green'] as const;

/** True when this browser can inflate the street blocks at all. */
export function canUnpackStreets(): boolean {
  return typeof DecompressionStream === 'function';
}

/** A topology we would rather not hand to the renderer half-formed. */
function looksLikeStreets(value: unknown): value is StreetTopology {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Partial<StreetTopology>;
  if (!Array.isArray(t.arcs) || !Array.isArray(t.places)) return false;
  const objects = t.objects as Record<string, unknown> | undefined;
  if (!objects) return false;
  return LAYERS.every((name) => {
    const layer = objects[name] as { type?: string; geometries?: unknown } | undefined;
    return layer?.type === 'GeometryCollection' && Array.isArray(layer.geometries);
  });
}

/**
 * One box's street topology from the base64 of its gzipped file, or null if it cannot be had.
 * `base64` is the text of a <script type="application/x-geo-city"> block; whitespace in it is ignored.
 */
export async function unpackStreetTopology(base64: string): Promise<StreetTopology | null> {
  if (!canUnpackStreets()) return null;
  try {
    const binary = atob(base64.replace(/\s+/g, ''));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const inflated = new Response(bytes).body?.pipeThrough(new DecompressionStream(STREET_ENCODING));
    if (!inflated) return null;
    const parsed: unknown = JSON.parse(await new Response(inflated).text());
    return looksLikeStreets(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
