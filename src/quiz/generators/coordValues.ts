import type { LatLon, Precision } from '../../geo/types';
import type { Difficulty, Rng } from '../types';
import { gridInt, signed, withMinutes } from '../values';

/**
 * How far from 0° easy and medium points go. Near 180° a point on the whole-world map (easy), or on a medium view pushed
 * against the edge of the world, sits under the latitude numbers down the map's left side or the 180° meridian's name.
 * Easy points in the west stop sooner: on a phone a Ukrainian latitude number ("40° пн. ш.") is about 70 px wide.
 */
export const EASY_MAX_LON = { east: 130, west: 90 } as const;
export const MEDIUM_MAX_LON = 150;

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
  // Easy and medium points keep away from the map's sides (see EASY_MAX_LON).
  if (difficulty === 'easy') {
    const east = signed(rng) > 0;
    const lon = east ? gridInt(rng, 10, EASY_MAX_LON.east, 10) : -gridInt(rng, 10, EASY_MAX_LON.west, 10);
    return { p: { lat: gridInt(rng, 10, 70, 10) * signed(rng), lon }, precision: 'degree', graticuleStep: 10 };
  }
  if (difficulty === 'medium') {
    const p = { lat: gridInt(rng, 5, 75, 5) * signed(rng), lon: gridInt(rng, 5, MEDIUM_MAX_LON, 5) * signed(rng) };
    return { p, precision: 'degree', graticuleStep: 5, flatView: { center: { lat: p.lat + rng.int(-8, 8), lon: p.lon + rng.int(-15, 15) }, zoom: 3 } };
  }
  let lat: number, lon: number;
  do { lat = rng.int(1, 80) * signed(rng); lon = rng.int(1, 179) * signed(rng); } while (lat % 5 === 0 || lon % 5 === 0);
  const p = { lat, lon };
  return { p, precision: 'degree', graticuleStep: 1, flatView: { center: { lat: lat + rng.int(-3, 3), lon: lon + rng.int(-6, 6) }, zoom: 8 } };
}
