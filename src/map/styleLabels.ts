import type { LangCode } from '../geo/types';
import { t } from '../i18n/i18n.svelte';
import { labelWidth } from './brackets';
import type { CityBox } from './cityBoxes';
import type { ViewCtx } from './geometry';
import { overlaps, selectLabelPlacements, textBox, type LabelBox } from './labelLayout';
import { PHYSICAL_NAMES, type PhysicalKind } from './physical';
import { tierZoom } from './places';
import { countryLabels, countryName } from './political';
import { streetsFor } from './streets';

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

export const STREET_FONT = 10;
/**
 * How many street names the layout even considers. A view 960 x 480 holds forty or fifty names at this size, and
 * Giza's box alone carries 1 883 of them; laying every one of them out on every frame of a pan is work whose
 * answer is "no" for nine names in ten. What is kept is the head of the map's own order (the biggest streets, and
 * within a class the ones nearest the middle of the view), so what is dropped here is what a pupil needs least.
 */
const STREET_NAME_LIMIT = 160;
/**
 * How many district names are written before the street names get their turn. A district name is there to say
 * which part of the city this is, and a handful does that; OpenStreetMap, though, tags every 丁目 block in Tokyo as
 * a neighbourhood, so that box carries 157 of them — and because districts outrank streets, all 157 were written
 * and not one street name fitted anywhere. The nearest few to the middle of the view are kept.
 */
const DISTRICT_LIMIT = 12;

/**
 * The margin a street name reserves around the box `textBox` models for it, as a share of the type size.
 *
 * `textBox` models a line of text as 0.8 em above the baseline and 0.25 em below, which is the ink of ordinary
 * words; the font's own box reaches a full em above the baseline, which is where a capital Ś keeps its accent.
 * 0.2 em covers both that and the same overhang on the *other* label — the lesson's names hand their unpadded
 * boxes in as obstacles — so a street name written a line under "Katowice" no longer brushes it (it used to, by a
 * tenth of a pixel, and a lesson name must never be touched: ruling R19). It also keeps two street names from
 * sitting so close that they read as one.
 */
const GAP = 0.2;

/** District names are OSM `place` nodes, whose ids begin with `n`; a street name's id begins with `r` (streets.ts). */
const isDistrict = (id: string) => id.startsWith('n');

/**
 * Street and district names inside a city close-up box (spec §5). Placed last of everything on the map: the
 * `obstacles` Places.svelte hands in are every label the lesson has already put down — places, schools, the point,
 * the special-line names, overlay texts and the edge numbers — so a street name is left out rather than pushed
 * over one of them (planning ruling R19). A few district names rank before the street names; the streets then go
 * biggest first, and within one class the ones nearest the middle of the view, so the names stay steady while the
 * map is panned and a motorway is named before the alley beside it.
 */
export function placeStreetLabels(ctx: ViewCtx, box: CityBox, lang: LangCode, obstacles: readonly LabelBox[]): StyleLabel[] {
  const size = STREET_FONT * ctx.px;
  const items = streetsFor(box, ctx.zoom, ctx.bounds, lang).names.flatMap((n) => {
    const xy = ctx.project(n);
    if (!xy || !insideView(ctx, xy)) return [];
    const width = labelWidth(n.text, STREET_FONT, ctx.px);
    const at = (dx: number, dy: number) => {
      const x = xy[0] + dx, y = xy[1] + size * 0.35 + dy;
      const b = textBox(x, y, width, size, 'middle');
      // A street name reserves a little more than `textBox` models. These are the smallest, densest names on the
      // map, and the model is an estimate: without the margin two of them sat a hair apart and read as one word,
      // and one ran a tenth of a pixel into "Katowice" — a lesson name, which must never happen (ruling R19).
      return { x, y, box: { left: b.left - size * GAP, right: b.right + size * GAP, top: b.top - size * GAP, bottom: b.bottom + size * GAP } };
    };
    const step = size * 1.2;
    const options = [at(0, 0), at(0, -step), at(0, step)]
      .filter((o) => o.box.left >= 0 && o.box.right <= ctx.width && o.box.top >= 0 && o.box.bottom <= ctx.height);
    if (options.length === 0) return [];
    // District names come first: their ids begin with `n` (an OSM node), a street name's with `r`
    // (see scripts/build-city-streets.ts and streets.ts). Then the streets, biggest first — the road a pupil can
    // follow across the whole box is the one worth naming, and taking them in that order also spreads the names
    // over the view instead of piling the nearest two hundred alley names into the middle of it (Giza's box holds
    // 1 883 names, nearly all of them alleys). Distance to the middle of the view is the tiebreaker within a
    // class, bucketed in whole CSS px — as every other stable map label is — so a pan of a pixel or two cannot
    // make two of them swap.
    const distance = Math.hypot(xy[0] - ctx.width / 2, xy[1] - ctx.height / 2) / ctx.px;
    const rank = isDistrict(n.id) ? 0 : 1_000_000 + n.cls * 100_000;
    return [{ id: n.id, text: n.text, options, rank: rank + Math.floor(distance / 8) }];
  });
  const byRank = (a: { rank: number }, b: { rank: number }) => a.rank - b.rank;
  const considered = [
    ...items.filter((i) => isDistrict(i.id)).sort(byRank).slice(0, DISTRICT_LIMIT),
    ...items.filter((i) => !isDistrict(i.id)).sort(byRank).slice(0, STREET_NAME_LIMIT),
  ];
  const chosen = selectLabelPlacements(considered, (i) => i.options.map((o) => o.box), (i) => i.rank, obstacles);
  return considered.flatMap((i, k) => {
    const o = chosen[k]! >= 0 ? i.options[chosen[k]!]! : null;
    return o ? [{ id: i.id, text: i.text, x: o.x, y: o.y, size, box: o.box }] : [];
  });
}
