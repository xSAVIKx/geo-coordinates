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
 * The box to draw for a view covering `view`, or null. Boxes are 250 km apart at the closest (Warsaw and Kraków),
 * and a view deep enough to reach CITY_STREET_ZOOM spans at most 15°, so at most one box can ever match.
 */
export function visibleCityBox(view: GeoBounds, zoom: number): CityBox | null {
  if (zoom < CITY_STREET_ZOOM) return null;
  return CITY_BOXES.find((b) => boundsIntersect(view, b.bounds)) ?? null;
}
