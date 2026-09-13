export type LangCode = 'en' | 'pl' | 'uk';
export const LANGS: readonly LangCode[] = ['en', 'pl', 'uk'];
export interface LatLon { lat: number; lon: number }
export type Precision = 'degree' | 'minute';
export type Axis = 'lat' | 'lon';
