// The twelve city close-up boxes (Places up close spec §3): 6 x 4 km, centred on the named feature.
// This file is the single source of truth for the box geometry. It writes src/map/data/city/boxes.json,
// which scripts/build-city-photos.py, scripts/build-city-streets.ts and src/map/cityBoxes.ts all read, so the
// photo, the streets and the page can never disagree about where a box is.
//
// Usage: node --experimental-strip-types scripts/city-boxes.ts   (npm run data:city-boxes)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export type PhotoSourceKey = 'gugik' | 'ign' | 'gsi' | 'naip' | 'sentinel';

export interface CityBoxSpec {
  id: string;
  lat: number;
  lon: number;
  /** One of the three teaching places with a coordinate line painted on the ground (spec §1). */
  note: boolean;
  source: PhotoSourceKey;
  photoWidth: number;
  photoHeight: number;
  /** WebP quality: 65 for the detailed orthophotos, 80 for the small Sentinel tiles (planning ruling R4). */
  quality: number;
}

export const CITY_BOX_WIDTH_M = 6000;
export const CITY_BOX_HEIGHT_M = 4000;
const OUT = 'src/map/data/city/boxes.json';

// 3:2 like the 6 x 4 km box. Katowice is the school's own box and gets the largest size (ruling R4).
const ORTHO_BIG = { photoWidth: 1440, photoHeight: 960, quality: 65 } as const;
const ORTHO = { photoWidth: 1200, photoHeight: 800, quality: 65 } as const;
// 600 x 400 is exactly Sentinel-2's own 10 m per pixel over this box: never enlarge it (ruling R4).
const SENTINEL = { photoWidth: 600, photoHeight: 400, quality: 80 } as const;

export const CITY_BOX_SPECS: readonly CityBoxSpec[] = [
  { id: 'katowice', lat: 50.26, lon: 19.02, note: false, source: 'gugik', ...ORTHO_BIG },
  { id: 'greenwich', lat: 51.4779, lon: -0.0015, note: true, source: 'sentinel', ...SENTINEL },
  { id: 'mitaddelmundo', lat: -0.0022, lon: -78.4558, note: true, source: 'sentinel', ...SENTINEL },
  { id: 'rovaniemi', lat: 66.5436, lon: 25.8475, note: true, source: 'sentinel', ...SENTINEL },
  { id: 'warsaw', lat: 52.2297, lon: 21.0122, note: false, source: 'gugik', ...ORTHO },
  { id: 'krakow', lat: 50.0647, lon: 19.945, note: false, source: 'gugik', ...ORTHO },
  { id: 'paris', lat: 48.8584, lon: 2.2945, note: false, source: 'ign', ...ORTHO },
  { id: 'manhattan', lat: 40.7484, lon: -73.9857, note: false, source: 'naip', ...ORTHO },
  { id: 'delhi', lat: 28.6129, lon: 77.2295, note: false, source: 'sentinel', ...SENTINEL },
  { id: 'sydney', lat: -33.8568, lon: 151.2153, note: false, source: 'sentinel', ...SENTINEL },
  // Tokyo is the busiest frame of the twelve — roofs, viaducts and rail yards edge to edge — and comes out 10 %
  // over the 260 KiB ceiling at quality 65, and still over it at 60, so it alone goes to the floor the planning
  // allows (ruling R22: never below 55).
  { id: 'tokyo', lat: 35.6595, lon: 139.7004, note: false, source: 'gsi', ...ORTHO, quality: 55 },
  { id: 'giza', lat: 29.9792, lon: 31.1342, note: false, source: 'sentinel', ...SENTINEL },
];

export interface BoxBounds { west: number; south: number; east: number; north: number }

/** Metres per degree of latitude, and of longitude at `lat`, on a sphere of the WGS 84 mean radius. */
const M_PER_DEG_LAT = 111_320;

/**
 * A box `widthM` x `heightM` metres centred on (lat, lon), in degrees. The longitude half-width is divided by
 * cos(lat), so the box is the given size in metres at every latitude — which is what makes every photo's pixel
 * square in metres and lets all twelve share one 3:2 shape (planning ruling R15).
 */
export function boxAround(lat: number, lon: number, widthM: number, heightM: number): BoxBounds {
  const dLat = heightM / 2 / M_PER_DEG_LAT;
  const dLon = widthM / 2 / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  const r = (v: number) => Math.round(v * 1e7) / 1e7;   // 1e-7 deg is about 1 cm: far finer than any source
  return { west: r(lon - dLon), south: r(lat - dLat), east: r(lon + dLon), north: r(lat + dLat) };
}

export interface BoxesFile { widthM: number; heightM: number; boxes: (CityBoxSpec & BoxBounds)[] }

export function boxesFile(): BoxesFile {
  return {
    widthM: CITY_BOX_WIDTH_M,
    heightM: CITY_BOX_HEIGHT_M,
    boxes: CITY_BOX_SPECS.map((s) => ({ ...s, ...boxAround(s.lat, s.lon, CITY_BOX_WIDTH_M, CITY_BOX_HEIGHT_M) })),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(dirname(OUT), { recursive: true });
  const json = JSON.stringify(boxesFile(), null, 1);
  writeFileSync(OUT, `${json}\n`);
  console.log(`${OUT}: ${CITY_BOX_SPECS.length} boxes, ${json.length} B`);
}
