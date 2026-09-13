// Validates src/map/data/maple-bear-schools.json (Task 23a).
// Usage: node --experimental-strip-types scripts/validate-schools.ts [path]
// Exits 1 and prints one message per problem when the data is invalid.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const SCHOOLS_PATH = 'src/map/data/maple-bear-schools.json';
const SCHOOL_KEYS = ['id', 'name', 'city', 'country', 'lat', 'lon', 'precision', 'url'] as const;
const PRECISIONS = ['address', 'city'];
// Codes that Intl.DisplayNames resolves but that are not countries or territories.
const NOT_COUNTRIES = new Set(['EU', 'EZ', 'UN', 'QO', 'XA', 'XB', 'ZZ']);
const regionNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });

/** English name for an ISO 3166-1 alpha-2 code, or undefined when the code does not resolve. */
export function countryName(code: string): string | undefined {
  if (!/^[A-Z]{2}$/.test(code) || NOT_COUNTRIES.has(code)) return undefined;
  try {
    const name = regionNames.of(code);
    return name && name !== code ? name : undefined;
  } catch {
    return undefined;
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const maxFourDecimals = (n: number) => Math.abs(Math.round(n * 1e4) / 1e4 - n) < 1e-9;

/** Returns a list of problems; an empty list means the data is valid. */
export function validateSchools(data: unknown): string[] {
  const errors: string[] = [];
  if (!isObject(data)) return ['top level: expected an object'];
  for (const key of ['source', 'retrieved', 'note']) {
    if (!nonEmpty(data[key])) errors.push(`top level: "${key}" must be a non-empty string`);
  }
  if (nonEmpty(data.retrieved)) {
    const d = data.retrieved;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(`${d}T00:00:00Z`)) || new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10) !== d) {
      errors.push(`top level: "retrieved" must be a YYYY-MM-DD date, got "${d}"`);
    }
  }
  if (!Array.isArray(data.schools) || data.schools.length === 0) {
    errors.push('top level: "schools" must be a non-empty array');
    return errors;
  }
  const ids = new Set<string>();
  data.schools.forEach((s: unknown, i: number) => {
    const where = `schools[${i}]`;
    if (!isObject(s)) { errors.push(`${where}: expected an object`); return; }
    const label = nonEmpty(s.id) ? `${where} (${s.id})` : where;
    for (const key of Object.keys(s)) {
      if (!(SCHOOL_KEYS as readonly string[]).includes(key)) errors.push(`${label}: unexpected field "${key}"`);
    }
    for (const key of ['id', 'name', 'city', 'country', 'precision', 'url']) {
      if (!nonEmpty(s[key])) errors.push(`${label}: "${key}" must be a non-empty string`);
    }
    if (nonEmpty(s.id)) {
      if (ids.has(s.id)) errors.push(`${label}: duplicate id`);
      ids.add(s.id);
      if (!/^[a-z]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s.id)) errors.push(`${label}: id must look like "pl-katowice" (lowercase ascii, hyphens)`);
      else if (nonEmpty(s.country) && s.id.slice(0, 2) !== s.country.toLowerCase()) errors.push(`${label}: id prefix must be the lowercase country code`);
    }
    if (nonEmpty(s.country) && !countryName(s.country)) errors.push(`${label}: "${s.country}" is not an ISO 3166-1 alpha-2 country code`);
    for (const [key, limit] of [['lat', 90], ['lon', 180]] as const) {
      const v = s[key];
      if (typeof v !== 'number' || !Number.isFinite(v)) { errors.push(`${label}: "${key}" must be a finite number`); continue; }
      if (v < -limit || v > limit) errors.push(`${label}: "${key}" ${v} out of range [-${limit}, ${limit}]`);
      if (!maxFourDecimals(v)) errors.push(`${label}: "${key}" ${v} has more than 4 decimals`);
    }
    if (s.lat === 0 && s.lon === 0) errors.push(`${label}: coordinates 0,0 look like a missing value`);
    if (nonEmpty(s.precision) && !PRECISIONS.includes(s.precision)) errors.push(`${label}: "precision" must be "address" or "city"`);
    if (nonEmpty(s.url)) {
      let ok = false;
      try { ok = /^https?:$/.test(new URL(s.url).protocol); } catch { ok = false; }
      if (!ok) errors.push(`${label}: "url" must be an http(s) URL`);
    }
  });
  return errors;
}

function main(): void {
  const path = process.argv[2] ?? SCHOOLS_PATH;
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`${path}: cannot read JSON: ${(e as Error).message}`);
    process.exit(1);
  }
  const errors = validateSchools(data);
  if (errors.length > 0) {
    for (const e of errors) console.error(e);
    console.error(`${path}: ${errors.length} problem(s)`);
    process.exit(1);
  }
  const schools = (data as { schools: { country: string }[] }).schools;
  const countries = new Set(schools.map((s) => s.country));
  console.log(`${path}: OK, ${schools.length} schools in ${countries.size} countries`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
