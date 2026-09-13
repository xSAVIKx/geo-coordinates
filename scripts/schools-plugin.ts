// Build-time shaping of the Maple Bear schools dataset (Task 23b).
// src/map/data/maple-bear-schools.json stays complete (city, precision, url… for traceability);
// the page only needs id, name, country and position. A plain JSON import would bundle every
// field, so this Vite plugin serves `virtual:maple-bear-schools` with the slim shape instead:
//   export const retrieved = "2026-09-13";
//   export const schools = [["pl-katowice","Maple Bear Katowice","PL",50.2604,19.0185], …];
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

export const SCHOOLS_MODULE = 'virtual:maple-bear-schools';
const RESOLVED = `\0${SCHOOLS_MODULE}`;
const SOURCE = resolve(import.meta.dirname, '../src/map/data/maple-bear-schools.json');

/** One school as bundled: [id, name, country, lat, lon]. */
export type SlimSchool = [id: string, name: string, country: string, lat: number, lon: number];

interface SourceData { retrieved: string; schools: { id: string; name: string; country: string; lat: number; lon: number }[] }

export function slimSchools(data: SourceData): { retrieved: string; schools: SlimSchool[] } {
  return { retrieved: data.retrieved, schools: data.schools.map((s) => [s.id, s.name, s.country, s.lat, s.lon]) };
}

export function schoolsModuleCode(data: SourceData): string {
  const slim = slimSchools(data);
  return `export const retrieved = ${JSON.stringify(slim.retrieved)};\nexport const schools = ${JSON.stringify(slim.schools)};\n`;
}

export function mapleBearSchools(): Plugin {
  return {
    name: 'maple-bear-schools',
    resolveId(id) {
      return id === SCHOOLS_MODULE ? RESOLVED : undefined;
    },
    load(id) {
      if (id !== RESOLVED) return undefined;
      this.addWatchFile(SOURCE);
      return schoolsModuleCode(JSON.parse(readFileSync(SOURCE, 'utf8')) as SourceData);
    },
  };
}
