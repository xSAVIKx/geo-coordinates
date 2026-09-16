import type { LangCode } from '../geo/types';
import { labelWidth } from './brackets';
import type { ViewCtx } from './geometry';
import { overlaps, selectLabelPlacements, textBox, type LabelBox } from './labelLayout';
import { tierZoom } from './places';
import { countryLabels, countryName } from './political';

/*
 * Names that only some map styles write (spec §4): country names (Political), and from Task 13 physical names
 * (Physical). Placed with the place names by Places.svelte, clear of everything already on the map (labelLayout.ts).
 */
export interface StyleLabel { id: string; text: string; x: number; y: number; size: number; box: LabelBox }

export const COUNTRY_FONT = 11;

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
    const width = labelWidth(text, COUNTRY_FONT, ctx.px);
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
