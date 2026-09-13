import type { Axis, LangCode, LatLon, Precision } from './types';

const EPS = 1e-9;

export function normalizeLon(lon: number): number {
  let l = ((lon % 360) + 360) % 360; // [0, 360)
  if (l > 180) l -= 360;                // (-180, 180]
  return l === 0 ? 0 : l;               // turn -0 into 0
}

export function clampLat(lat: number): number {
  return Math.max(-90, Math.min(90, lat));
}

export function roundTo(value: number, precision: Precision): number {
  return precision === 'degree' ? Math.round(value) : Math.round(value * 60) / 60;
}

export function toDegMin(value: number): { deg: number; min: number } {
  const totalMin = Math.round(Math.abs(value) * 60);
  return { deg: Math.floor(totalMin / 60), min: totalMin % 60 };
}

const LETTERS: Record<LangCode, { N: string; S: string; E: string; W: string; sep: string }> = {
  en: { N: 'N', S: 'S', E: 'E', W: 'W', sep: '' },
  pl: { N: 'N', S: 'S', E: 'E', W: 'W', sep: '' },
  uk: { N: 'пн. ш.', S: 'пд. ш.', E: 'сх. д.', W: 'зх. д.', sep: ' ' },
};

function body(value: number, precision: Precision): { text: string; isZero: boolean; deg: number; min: number } {
  if (precision === 'degree') {
    const deg = Math.round(Math.abs(value));
    return { text: `${deg}°`, isZero: deg === 0, deg, min: 0 };
  }
  const { deg, min } = toDegMin(value);
  return { text: `${deg}°${String(min).padStart(2, '0')}′`, isZero: deg === 0 && min === 0, deg, min };
}

export function formatLat(lat: number, lang: LangCode, precision: Precision = 'degree'): string {
  const b = body(clampLat(lat), precision);
  if (b.isZero) return b.text;
  const L = LETTERS[lang];
  return `${b.text}${L.sep}${lat > 0 ? L.N : L.S}`;
}

export function formatLon(lon: number, lang: LangCode, precision: Precision = 'degree'): string {
  const n = normalizeLon(lon);
  const b = body(n, precision);
  if (b.isZero || (b.deg === 180 && b.min === 0)) return b.text;
  const L = LETTERS[lang];
  return `${b.text}${L.sep}${n > 0 ? L.E : L.W}`;
}

export function formatLatLon(p: LatLon, lang: LangCode, precision: Precision = 'degree'): string {
  return `${formatLat(p.lat, lang, precision)}, ${formatLon(p.lon, lang, precision)}`;
}

// Direction tokens, lower-cased, matched at the end of the input.
const DIRS: { re: RegExp; axis: Axis; sign: 1 | -1 }[] = [
  { re: /(?:пн|півн)[.\s]*(?:ш[.\s]*)?$/u, axis: 'lat', sign: 1 },
  { re: /(?:пд|півд)[.\s]*(?:ш[.\s]*)?$/u, axis: 'lat', sign: -1 },
  { re: /(?:сх)[.\s]*(?:д[.\s]*)?$/u, axis: 'lon', sign: 1 },
  { re: /(?:зх)[.\s]*(?:д[.\s]*)?$/u, axis: 'lon', sign: -1 },
  { re: /n$/u, axis: 'lat', sign: 1 },
  { re: /s$/u, axis: 'lat', sign: -1 },
  { re: /e$/u, axis: 'lon', sign: 1 },
  { re: /w$/u, axis: 'lon', sign: -1 },
];

export function parseAngle(input: string, axis: Axis): number | null {
  let s = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;
  let sign: 1 | -1 | 0 = 0;
  for (const d of DIRS) {
    if (d.re.test(s)) {
      if (d.axis !== axis) return null;
      sign = d.sign;
      s = s.replace(d.re, '').trim().replace(/[,\s]+$/, '');
      break;
    }
  }
  const m = /^(-)?\s*(\d+(?:[.,]\d+)?)\s*°?\s*(?:(\d+(?:[.,]\d+)?)\s*[′']?)?$/u.exec(s);
  if (!m) return null;
  const negative = m[1] === '-';
  if (negative && sign !== 0) return null;
  const deg = Number(m[2]!.replace(',', '.'));
  const min = m[3] ? Number(m[3].replace(',', '.')) : 0;
  if (min >= 60) return null;
  const abs = deg + min / 60;
  const max = axis === 'lat' ? 90 : 180;
  if (abs > max + EPS) return null;
  if (sign === 0 && !negative && abs > EPS && !(axis === 'lon' && Math.abs(abs - 180) < EPS)) return null;
  if (axis === 'lon' && Math.abs(abs - 180) < EPS) return 180;
  const signed = (negative || sign === -1 ? -1 : 1) * abs;
  return signed === 0 ? 0 : signed;
}
