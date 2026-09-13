import type { LatLon, Precision } from '../../geo/types';
import type { Difficulty, Rng } from '../types';
import { gridInt, signed, withMinutes } from '../values';

export interface CoordTask { p: LatLon; precision: Precision; graticuleStep: 1 | 5 | 10; flatView?: { center: LatLon; zoom: number } }

export function coordTask(rng: Rng, difficulty: Difficulty, minutes: boolean): CoordTask {
  if (minutes) {
    const latDeg = rng.int(1, 70) * signed(rng);
    const lonDeg = rng.int(1, 170) * signed(rng);
    let latMin: number, lonMin: number;
    if (difficulty === 'easy') { latMin = 30; lonMin = 0; }
    else if (difficulty === 'medium') { [latMin, lonMin] = rng.pick([[30, 0], [0, 30], [30, 30]] as const); }
    else { latMin = rng.pick([15, 30, 45]); lonMin = rng.pick([15, 30, 45]); }
    const p = { lat: withMinutes(latDeg, latMin), lon: withMinutes(lonDeg, lonMin) };
    return { p, precision: 'minute', graticuleStep: 1, flatView: { center: { lat: p.lat + (rng.next() - 0.5) * 3, lon: p.lon + (rng.next() - 0.5) * 6 }, zoom: 12 } };
  }
  if (difficulty === 'easy') {
    return { p: { lat: gridInt(rng, 10, 70, 10) * signed(rng), lon: gridInt(rng, 10, 170, 10) * signed(rng) }, precision: 'degree', graticuleStep: 10 };
  }
  if (difficulty === 'medium') {
    const p = { lat: gridInt(rng, 5, 75, 5) * signed(rng), lon: gridInt(rng, 5, 175, 5) * signed(rng) };
    return { p, precision: 'degree', graticuleStep: 5, flatView: { center: { lat: p.lat + rng.int(-8, 8), lon: p.lon + rng.int(-15, 15) }, zoom: 3 } };
  }
  let lat: number, lon: number;
  do { lat = rng.int(1, 80) * signed(rng); lon = rng.int(1, 179) * signed(rng); } while (lat % 5 === 0 || lon % 5 === 0);
  const p = { lat, lon };
  return { p, precision: 'degree', graticuleStep: 1, flatView: { center: { lat: lat + rng.int(-3, 3), lon: lon + rng.int(-6, 6) }, zoom: 8 } };
}
