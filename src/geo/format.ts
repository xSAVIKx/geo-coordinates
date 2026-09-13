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

/** Rounds to `digits` decimals without a "-0.0000". */
function fixed(value: number, digits: number): string {
  const s = value.toFixed(digits);
  return /^-0\.?0*$/.test(s) ? s.slice(1) : s;
}

/**
 * Decimal degrees as map apps write them: latitude first, a minus for south/west, always a `.`
 * decimal separator and a comma + space between the numbers — in every language, so the pair can
 * be typed into a map app as it is. `formatDecimal({ lat: 50.2649, lon: 19.0238 })` → `"50.2649, 19.0238"`.
 */
export function formatDecimal(p: LatLon, digits = 4): string {
  // A longitude just east of -180 rounds to "-180.0000": that is the antimeridian, written 180 like `normalizeLon`.
  const lon = fixed(normalizeLon(p.lon), digits);
  return `${fixed(clampLat(p.lat), digits)}, ${/^-180\.?0*$/.test(lon) ? lon.slice(1) : lon}`;
}

/** Whole degrees, minutes and seconds of |value|, with 60″ and 60′ carried up. */
export function toDegMinSec(value: number): { deg: number; min: number; sec: number } {
  const total = Math.round(Math.abs(value) * 3600);
  return { deg: Math.floor(total / 3600), min: Math.floor(total / 60) % 60, sec: total % 60 };
}

/**
 * Degrees, minutes and seconds in the language's letter notation: `50°15′54″N`, UK `50°15′54″ пн. ш.`.
 * The same boundary rules as `formatLat`/`formatLon`: no letter at 0°, nor at longitude 180°.
 */
export function formatDMS(value: number, axis: Axis, lang: LangCode): string {
  const v = axis === 'lat' ? clampLat(value) : normalizeLon(value);
  const { deg, min, sec } = toDegMinSec(v);
  const text = `${deg}°${String(min).padStart(2, '0')}′${String(sec).padStart(2, '0')}″`;
  const total = deg * 3600 + min * 60 + sec;
  if (total === 0 || (axis === 'lon' && total === 180 * 3600)) return text;
  const L = LETTERS[lang];
  return `${text}${L.sep}${axis === 'lat' ? (v > 0 ? L.N : L.S) : (v > 0 ? L.E : L.W)}`;
}

const DECIMAL = String.raw`[-−+]?\d+(?:\.\d+)?`;
const DECIMAL_PAIR = new RegExp(String.raw`^\s*(${DECIMAL})\s*(?:,\s*|\s+)(${DECIMAL})\s*$`, 'u');

/**
 * Reads a decimal pair as typed into or copied from a map app — `50.2649, 19.0238`,
 * `50.2649 19.0238`, `-33.87,151.21` (a typographic minus `−` works too). Latitude comes first;
 * `null` when the text is not such a pair or a number is out of range.
 */
export function parseDecimalPair(input: string): LatLon | null {
  const m = DECIMAL_PAIR.exec(input);
  if (!m) return null;
  const num = (s: string) => Number(s.replace('−', '-'));
  const lat = num(m[1]!), lon = num(m[2]!);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat: lat + 0, lon: lon === -180 ? 180 : lon + 0 }; // in range already: no modulo rounding
}
