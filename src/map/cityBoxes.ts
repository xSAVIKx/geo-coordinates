import boxesJson from './data/city/boxes.json';
import { boundsIntersect, type GeoBounds } from './geometry';
import type { LatLon } from '../geo/types';

/*
 * The twelve city close-up boxes (Places up close spec §3). The geometry comes from
 * src/map/data/city/boxes.json, which scripts/city-boxes.ts writes and both data builds read, so the photo, the
 * streets and the page can never disagree about where a box is.
 */
export type CityBoxId = 'katowice' | 'greenwich' | 'mitaddelmundo' | 'rovaniemi' | 'warsaw' | 'krakow'
  | 'paris' | 'manhattan' | 'delhi' | 'sydney' | 'tokyo' | 'giza';

export interface CityBox {
  id: CityBoxId;
  lat: number;
  lon: number;
  bounds: GeoBounds;
  /** The flat zoom at which the box just fills a 960 x 480 view (both axes). */
  fitZoom: number;
  /** One of the three teaching places with a coordinate line painted on the ground (spec §1). */
  note: boolean;
}

/*
 * Every zoom in this file is a **flat-map** zoom, on the flat map's own 1-6000 scale. The globe runs 1-60 and
 * stops there (planning ruling R1: "A pupil who stays on the globe never sees a close-up"), so a globe zoom
 * compared against these numbers passes the two lower ones for the wrong reason — the globe at its own ceiling
 * of 60 clears both CITY_STREET_ZOOM and CITY_PHOTO_ZOOM while a box is still about ten pixels across. The three
 * derivations that ask `visibleCityBox` therefore gate on `ctx.kind === 'flat'` first, and tests/e2e/
 * globe-zoom.spec.ts holds the globe at 60 over Katowice to prove it. Nothing in here can tell the two scales
 * apart on its own, which is why the gate lives at the call sites rather than behind another argument.
 */
/** Streets fade in from here (spec §5); below it a box is not "in view" at all, which is what keeps the Atlas baselines still (planning ruling R3). */
export const CITY_STREET_ZOOM = 24;
/** The photo starts to fade in here and is fully mixed at CITY_PHOTO_FULL_ZOOM (spec §5). */
export const CITY_PHOTO_ZOOM = 40;
export const CITY_PHOTO_FULL_ZOOM = 80;

/**
 * The flat zoom at which `b` just fills the 960 x 480 view: zoom 1 spans 360° across the width and 180° down the
 * height, so the smaller of the two ratios is the fit. Measured for the twelve: 2 659 (Rovaniemi, the widest box
 * in degrees) to 5 009 (every box whose 4 km height binds first).
 */
export function fitZoom(b: GeoBounds): number {
  return Math.min(360 / (b.east - b.west), 180 / (b.north - b.south));
}

export const CITY_BOXES: readonly CityBox[] = boxesJson.boxes.map((b) => {
  const bounds: GeoBounds = { west: b.west, south: b.south, east: b.east, north: b.north };
  return { id: b.id as CityBoxId, lat: b.lat, lon: b.lon, bounds, fitZoom: fitZoom(bounds), note: b.note };
});

export const CITY_BOX_IDS: readonly CityBoxId[] = CITY_BOXES.map((b) => b.id);

export function cityBoxById(id: string): CityBox | null {
  return CITY_BOXES.find((b) => b.id === id) ?? null;
}

const inside = (b: GeoBounds, p: LatLon) => p.lon >= b.west && p.lon <= b.east && p.lat >= b.south && p.lat <= b.north;

/**
 * The box the view's centre is standing in, or null. Used for the teaching note, the credit line and the map's
 * text description — the things that describe where the pupil *is*, not what is painted.
 */
export function cityBoxAt(p: LatLon, zoom: number): CityBox | null {
  if (zoom < CITY_STREET_ZOOM) return null;
  return CITY_BOXES.find((b) => inside(b.bounds, p)) ?? null;
}

/**
 * The box to draw for a view covering `view`, or null. Call it only for a flat view (see the note at the top of
 * this file).
 *
 * The box **nearest the middle of the view**, not the first one in the table that happens to overlap. At zoom 24
 * the view is 15° across and several boxes can be in it at once: taking the first put Warsaw over Kraków up to
 * zoom 42 and Katowice over Kraków up to zoom 428, so a pupil panning towards Kraków lit up Katowice's streets
 * over Kraków's rooftops. The centres are 250 km apart at the closest, so by the time either box is more than a
 * smudge the nearest one is unambiguous, and the answer only ever changes while both are far too small to read.
 */
export function visibleCityBox(view: GeoBounds, zoom: number): CityBox | null {
  if (zoom < CITY_STREET_ZOOM) return null;
  const lon = (view.west + view.east) / 2, lat = (view.south + view.north) / 2;
  let best: CityBox | null = null, bestD = Infinity;
  for (const b of CITY_BOXES) {
    if (!boundsIntersect(view, b.bounds)) continue;
    const d = (b.lon - lon) ** 2 + (b.lat - lat) ** 2;
    if (d < bestD) { best = b; bestD = d; }
  }
  return best;
}
