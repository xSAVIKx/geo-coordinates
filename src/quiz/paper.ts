import type { Text } from '../i18n/text';
import type { SceneSpec } from '../map/types';
import type { Question } from './types';

/*
 * Questions on paper (the printable worksheet). Pure helpers, so the same question always prints the same way.
 */

/**
 * Whether a question needs its map on paper: a point to read or to mark, or overlays that carry the
 * question (markers, highlighted regions). A lone highlighted meridian beside a number question (distance
 * in reverse, time from a duration) adds nothing the text does not already say, so those print without one.
 */
export function needsMap(q: Question): boolean {
  if (q.type === 'place-point' || q.scene.point) return true;
  const overlays = (q.scene.overlays ?? []).filter((o) => o.kind !== 'noon-meridian');
  if (q.type === 'name-line') return overlays.length > 0;
  return overlays.some((o) => o.kind !== 'highlight-line');
}

/**
 * The question's scene as a still picture: the flat grid map only (a globe scene is drawn flat), no
 * day/night or schools, no noon line, nothing editable. A place-point question shows the grid without
 * the point — the pupil marks it.
 */
export function paperScene(q: Question): SceneSpec {
  const s = q.scene;
  return {
    views: ['flat'],
    flatProjection: 'grid',
    flatView: s.flatView,
    flatPreset: s.flatView ? undefined : s.flatPreset,
    layers: { ...s.layers, daylight: false, schools: false },
    point: q.type === 'place-point' ? null : (s.point ?? null),
    pointEditable: false,
    showReadout: false,
    precision: s.precision === 'auto' ? 'degree' : s.precision,
    overlays: (s.overlays ?? []).filter((o) => o.kind !== 'noon-meridian'),
    sun: null,
  };
}

/** The prompt as printed: "Move the point to …" becomes "Mark the point … on the map". */
export function paperPrompt(q: Question): Text {
  if (q.type === 'place-point' && q.answer.kind === 'coords') {
    const precision = q.input.kind === 'coords' ? q.input.precision : 'degree';
    return { key: 'worksheet.markPoint', params: { coords: { coord: q.answer.value, precision } } };
  }
  return q.prompt;
}
