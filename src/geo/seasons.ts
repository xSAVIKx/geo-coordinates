import { dayLightMinutes, solarParams } from './sun';

/*
 * Seasons for a place and a date (spec §6.1 readout). Day length is geometric: the Sun's centre on the horizon, the
 * same boundary the day and night shading uses (planning ruling R14). Times are local mean solar time: the mean Sun
 * is highest at 12:00; with the real Sun it is highest at 12:00 − equation of time.
 */
export interface DayInfo { declination: number; eqTimeMin: number; dayMinutes: number; polar: 'day' | 'night' | null; sunrise: number | null; sunset: number | null }

export function dayInfo(lat: number, date: Date, realSun: boolean): DayInfo {
  const { declination, eqTimeMin } = solarParams(date);
  const dayMinutes = dayLightMinutes(lat, declination);
  const polar = dayMinutes >= 1440 ? 'day' : dayMinutes <= 0 ? 'night' : null;
  const noon = 720 - (realSun ? eqTimeMin : 0);
  return { declination, eqTimeMin, dayMinutes, polar, sunrise: polar ? null : noon - dayMinutes / 2, sunset: polar ? null : noon + dayMinutes / 2 };
}

export interface PolarLimit { lat: number; hemisphere: 'N' | 'S' }

/** Beyond 90° − |declination| the Sun does not set (towards the Sun's side) or does not rise (the other pole). */
export function polarLimits(declination: number): { day: PolarLimit; night: PolarLimit } | null {
  if (Math.abs(declination) < 1e-6) return null;
  const lat = Math.round((90 - Math.abs(declination)) * 1e6) / 1e6;
  const sunSide = declination > 0 ? 'N' : 'S';
  return { day: { lat, hemisphere: sunSide }, night: { lat, hemisphere: sunSide === 'N' ? 'S' : 'N' } };
}

export function splitMinutes(minutes: number): { h: number; m: number } {
  const total = Math.round(minutes);
  return { h: Math.floor(total / 60), m: total % 60 };
}
