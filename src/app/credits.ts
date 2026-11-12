import { retrieved } from 'virtual:maple-bear-schools';

export const AUTHOR = { name: 'Yurii Serhiichuk', url: 'https://serhiichuk.dev', github: 'https://github.com/xSAVIKx', projects: 'https://xsavikx.github.io/' };
export const MAP_DATA = { name: 'Natural Earth', url: 'https://www.naturalearthdata.com/' };
export const IMAGERY = { name: 'NASA Earth Observatory', url: 'https://earthobservatory.nasa.gov/' };
/** Maple Bear school locations (src/map/data/maple-bear-schools.json): when the official listings were read. */
export const SCHOOL_DATA = { retrieved };

export interface CloseUpSource { key: 'gugik' | 'ign' | 'gsi' | 'naip' | 'sentinel'; name: string; url: string }
/** The five open imagery services the twelve close-up photos come from (spec §4); each keeps its own credit. */
export const CLOSE_UP_SOURCES: readonly CloseUpSource[] = [
  { key: 'gugik', name: 'GUGiK Geoportal', url: 'https://www.geoportal.gov.pl/' },
  { key: 'ign', name: 'IGN Géoplateforme', url: 'https://data.geopf.fr/' },
  { key: 'gsi', name: 'GSI Japan', url: 'https://maps.gsi.go.jp/development/ichiran.html' },
  { key: 'naip', name: 'USGS NAIP', url: 'https://imagery.nationalmap.gov/' },
  { key: 'sentinel', name: 'Copernicus Sentinel-2', url: 'https://sentinels.copernicus.eu/' },
];
/** The street map inside every box (spec §4): one source, one credit, in every language. */
export const OSM = { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/copyright' };
