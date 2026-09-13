import { lonDifference } from '../geo/compare';
import { toDegMin } from '../geo/format';
import type { Axis, LatLon, Precision } from '../geo/types';
import type { Text } from '../i18n/text';
import type { Answer, CheckResult, Question } from './types';

const EPS = 1e-9;

export function anglesMatch(a: number, b: number, axis: Axis, precision: Precision): boolean {
  const tol = precision === 'minute' ? 1 / 60 + EPS : EPS;
  const d = axis === 'lon' ? lonDifference(a, b) : Math.abs(a - b);
  return d <= tol;
}

export function coordsMatch(expected: LatLon, got: LatLon, fields: Axis | 'both', precision: Precision): boolean {
  const latOk = fields === 'lon' || anglesMatch(expected.lat, got.lat, 'lat', precision);
  const lonOk = fields === 'lat' || anglesMatch(expected.lon, got.lon, 'lon', precision);
  return latOk && lonOk;
}

const absEq = (a: number, b: number, precision: Precision) => Math.abs(Math.abs(a) - Math.abs(b)) <= (precision === 'minute' ? 1 / 60 : 0) + EPS;

export function coordMistake(expected: LatLon, got: LatLon, fields: Axis | 'both', precision: Precision): Text | undefined {
  if (coordsMatch(expected, got, fields, precision)) return undefined;
  if (fields === 'both' && Math.abs(expected.lat) !== Math.abs(expected.lon)
      && absEq(got.lat, expected.lon, precision) && absEq(got.lon, expected.lat, precision)) return { key: 'q.mistake.swapped' };
  const latAbs = fields === 'lon' || absEq(got.lat, expected.lat, precision);
  const lonAbs = fields === 'lat' || absEq(got.lon, expected.lon, precision);
  const latSignWrong = fields !== 'lon' && expected.lat !== 0 && latAbs && Math.sign(got.lat) !== Math.sign(expected.lat);
  const lonSignWrong = fields !== 'lat' && Math.abs(expected.lon) !== 180 && expected.lon !== 0 && lonAbs && Math.sign(got.lon) !== Math.sign(expected.lon);
  const latOk = fields === 'lon' || anglesMatch(expected.lat, got.lat, 'lat', precision);
  const lonOk = fields === 'lat' || anglesMatch(expected.lon, got.lon, 'lon', precision);
  if (latSignWrong && lonSignWrong) return { key: 'q.mistake.bothLetters' };
  if (latSignWrong && lonOk) return { key: 'q.mistake.nsLetter' };
  if (lonSignWrong && latOk) return { key: 'q.mistake.ewLetter' };
  if (precision === 'minute') {
    const sameDeg = (a: number, b: number) => Math.sign(a) === Math.sign(b) && toDegMin(a).deg === toDegMin(b).deg;
    if ((fields === 'lon' || sameDeg(expected.lat, got.lat)) && (fields === 'lat' || sameDeg(expected.lon, got.lon))) return { key: 'q.mistake.minutes' };
  }
  return undefined;
}

export function checkChoice(q: Question, r: Answer): CheckResult {
  return { correct: q.answer.kind === 'choice' && r.kind === 'choice' && r.index === q.answer.index };
}

export function checkCoords(q: Question, r: Answer): CheckResult {
  if (q.answer.kind !== 'coords' || q.input.kind !== 'coords' || r.kind !== 'coords') return { correct: false };
  const correct = coordsMatch(q.answer.value, r.value, q.input.fields, q.input.precision);
  return correct ? { correct } : { correct, mistake: coordMistake(q.answer.value, r.value, q.input.fields, q.input.precision) };
}

export function choiceText(q: Question): Text {
  if (q.input.kind !== 'choice' || q.answer.kind !== 'choice') throw new Error('not a choice question');
  return q.input.options[q.answer.index]!;
}
