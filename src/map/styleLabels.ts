import type { LangCode } from '../geo/types';
import { t } from '../i18n/i18n.svelte';
import { labelWidth } from './brackets';
import type { ViewCtx } from './geometry';
import { overlaps, selectLabelPlacements, textBox, type LabelBox } from './labelLayout';
import { PHYSICAL_NAMES, type PhysicalKind } from './physical';
import { tierZoom } from './places';
import { countryLabels, countryName } from './political';

/*
 * Names that only some map styles write (spec §4): country names (Political) and physical names (Physical).
 * Placed with the place names by Places.svelte, clear of everything already on the map (labelLayout.ts).
 */
export interface StyleLabel { id: string; text: string; x: number; y: number; size: number; box: LabelBox }

export const COUNTRY_FONT = 11;
export const PHYSICAL_FONT = 11.5;
/**
 * `.country-name`'s letter-spacing (Places.svelte), in em. `labelWidth` measures plain text, so without adding this
 * back a country name is reserved a box narrower than it is drawn — about 4 px for a seven-letter name — and two
 * names the layout believed were clear of each other touched: "Germany" and "Belgium" overlapped by 3 px at a
 * Central-European zoom. Keep the two in step.
 */
const COUNTRY_TRACKING = 0.05;

const insideView = (ctx: ViewCtx, xy: [number, number]) => xy[0] >= 0 && xy[0] <= ctx.width && xy[1] >= 0 && xy[1] <= ctx.height;

/** How far a name steps, in line heights, to get out from under a dot it would otherwise be written through. */
const STEP = 1.3;

/**
 * Country names for the view, most important first: a name appears once the view has reached the zoom Natural
 * Earth gives it, sits on the country's label point, and is left out where it would cover an `obstacle` (every
 * name already on the map) or run off the side.
 *
 * `marks` are the things drawn *over* the names — the place dots and the capitals' rings. A name with one of
 * them on its spot is offered a line above and a line below first, and keeps its own spot only if neither is
 * free: a dot on a letter (as on the Atlas map, where the dots are drawn over the continent names too) is
 * still better than no name at all. A name whose spot is clear of the marks is never offered anywhere else,
 * so Natural Earth's label point is where a country's name goes.
 */
export function placeCountryLabels(ctx: ViewCtx, lang: LangCode, obstacles: readonly LabelBox[], marks: readonly LabelBox[] = []): StyleLabel[] {
  const zoom = tierZoom(ctx.zoom, ctx.width / ctx.px);
  const size = COUNTRY_FONT * ctx.px;
  const items = countryLabels().flatMap((c, rank) => {
    if (zoom < c.minZoom) return [];
    const xy = ctx.project(c);
    if (!xy || !insideView(ctx, xy)) return [];
    const text = countryName(c.a2, lang);
    const width = labelWidth(text, COUNTRY_FONT, ctx.px) + text.length * COUNTRY_TRACKING * COUNTRY_FONT * ctx.px;
    const at = (dy: number) => {
      const y = xy[1] + size * 0.35 + dy;
      return { y, box: textBox(xy[0], y, width, size, 'middle') };
    };
    const own = at(0);
    if (own.box.left < 0 || own.box.right > ctx.width) return [];
    const clear = (s: { box: LabelBox }) => s.box.top >= 0 && s.box.bottom <= ctx.height && !marks.some((m) => overlaps(s.box, m));
    const options = clear(own) ? [own] : [...[at(-size * STEP), at(size * STEP)].filter(clear), own];
    return [{ rank, id: c.id, text, x: xy[0], options }];
  });
  const chosen = selectLabelPlacements(items, (i) => i.options.map((o) => o.box), (i) => i.rank, obstacles);
  return items.flatMap((i, k) => {
    const o = chosen[k]! >= 0 ? i.options[chosen[k]!]! : null;
    return o ? [{ id: i.id, text: i.text, x: i.x, y: o.y, size, box: o.box }] : [];
  });
}

/**
 * The Physical style's names of mountains, deserts, plateaux, seas and great rivers (physical.ts), from the zoom an
 * atlas would first print each at. Most important (smallest `minZoom`) first, so on a crowded view the Alps beat the
 * Tatras. A name belongs to a whole range, not to a dot, so it keeps its own spot unless an `obstacle` — every name
 * already on the map — is on it; then it steps one line up, down, left or right, and is left out only if none is free.
 * (Without that step a single city name erased a name the size of the Sahara, and the Physical world map, which has
 * no continent names to fall back on, came out nearly bare.) A name that would run off the side is always left out.
 */
export function placePhysicalLabels(ctx: ViewCtx, lang: LangCode, obstacles: readonly LabelBox[]): (StyleLabel & { kind: PhysicalKind })[] {
  // The plain view zoom, not `tierZoom` (which place and country names use to thin themselves out on a narrow
  // map): these minZooms are the zooms an atlas first prints each name at, and on a narrow map the names are
  // drawn proportionally larger, so the placement below already drops the ones that no longer fit. Scaling the
  // zoom down as well would leave the Physical world map with no names at all — and it has no continent names
  // to fall back on, since these replace them.
  const zoom = ctx.zoom;
  const size = PHYSICAL_FONT * ctx.px;
  const items = PHYSICAL_NAMES.flatMap((p, rank) => {
    if (zoom < p.minZoom) return [];
    const xy = ctx.project(p);
    if (!xy || !insideView(ctx, xy)) return [];
    const text = t(`physical.${p.id}`, undefined, lang);
    // Mountain names are spaced out capitals (wider); seas, rivers and deserts are italic.
    const width = labelWidth(text, PHYSICAL_FONT, ctx.px) * (p.kind === 'mountains' ? 1.25 : 1);
    const at = (dx: number, dy: number) => {
      const x = xy[0] + dx, y = xy[1] + size * 0.35 + dy;
      return { x, y, box: textBox(x, y, width, size, 'middle') };
    };
    const step = size * STEP;
    const own = at(0, 0);
    const inside = (o: { box: LabelBox }) => o.box.left >= 0 && o.box.right <= ctx.width && o.box.top >= 0 && o.box.bottom <= ctx.height;
    if (!inside(own)) return [];
    const options = [own, at(0, -step), at(0, step), at(-step, 0), at(step, 0)].filter(inside);
    return [{ rank: p.minZoom * 100 + rank, id: p.id, text, kind: p.kind, options }];
  });
  const chosen = selectLabelPlacements(items, (i) => i.options.map((o) => o.box), (i) => i.rank, obstacles);
  return items.flatMap((i, k) => {
    const o = chosen[k]! >= 0 ? i.options[chosen[k]!]! : null;
    return o ? [{ id: i.id, text: i.text, x: o.x, y: o.y, size, box: o.box, kind: i.kind }] : [];
  });
}
