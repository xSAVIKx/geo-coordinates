export interface Place { id: string; lat: number; lon: number; kind: 'city' | 'pole'; featured: boolean }
export interface MapLabel { id: string; lat: number; lon: number; kind: 'continent' | 'ocean' }

const p = (id: string, lat: number, lon: number, featured = false, kind: Place['kind'] = 'city'): Place => ({ id, lat, lon, kind, featured });

export const PLACES: readonly Place[] = [
  p('warsaw', 52.23, 21.01, true), p('krakow', 50.06, 19.94), p('gdansk', 54.35, 18.65), p('wroclaw', 51.11, 17.03), p('poznan', 52.41, 16.93),
  p('kyiv', 50.45, 30.52, true), p('lviv', 49.84, 24.03), p('odesa', 46.48, 30.72), p('kharkiv', 49.99, 36.23),
  p('london', 51.51, -0.13, true), p('paris', 48.86, 2.35), p('berlin', 52.52, 13.4), p('rome', 41.9, 12.5), p('madrid', 40.42, -3.7),
  p('reykjavik', 64.15, -21.94), p('oslo', 59.91, 10.75), p('istanbul', 41.01, 28.98),
  p('cairo', 30.04, 31.24, true), p('nairobi', -1.29, 36.82), p('capetown', -33.92, 18.42, true), p('lagos', 6.52, 3.38), p('dakar', 14.72, -17.47),
  p('newyork', 40.71, -74.01, true), p('losangeles', 34.05, -118.24), p('mexicocity', 19.43, -99.13), p('anchorage', 61.22, -149.9), p('honolulu', 21.31, -157.86),
  p('rio', -22.91, -43.17, true), p('buenosaires', -34.6, -58.38, true), p('lima', -12.05, -77.04), p('quito', -0.18, -78.47),
  p('tokyo', 35.68, 139.69, true), p('beijing', 39.9, 116.4), p('delhi', 28.61, 77.21, true), p('singapore', 1.35, 103.82), p('jakarta', -6.21, 106.85), p('dubai', 25.2, 55.27),
  p('sydney', -33.87, 151.21, true), p('auckland', -36.85, 174.76), p('suva', -18.14, 178.44),
  p('northpole', 90, 0, false, 'pole'), p('southpole', -90, 0, false, 'pole'),
];

export function placeById(id: string): Place {
  const place = PLACES.find((x) => x.id === id);
  if (!place) throw new Error(`Unknown place ${id}`);
  return place;
}

export const MAP_LABELS: readonly MapLabel[] = [
  { id: 'europe', lat: 47, lon: 8, kind: 'continent' }, { id: 'asia', lat: 50, lon: 90, kind: 'continent' },
  { id: 'africa', lat: 8, lon: 20, kind: 'continent' }, { id: 'northamerica', lat: 45, lon: -100, kind: 'continent' },
  { id: 'southamerica', lat: -12, lon: -58, kind: 'continent' }, { id: 'australia', lat: -25, lon: 134, kind: 'continent' },
  { id: 'antarctica', lat: -80, lon: 20, kind: 'continent' },
  { id: 'pacific', lat: -10, lon: -140, kind: 'ocean' }, { id: 'atlantic', lat: 25, lon: -40, kind: 'ocean' },
  { id: 'indian', lat: -20, lon: 80, kind: 'ocean' }, { id: 'arctic', lat: 82, lon: 0, kind: 'ocean' },
];
