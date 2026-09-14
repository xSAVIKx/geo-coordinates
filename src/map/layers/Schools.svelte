<script lang="ts">
  import { tn } from '../../i18n/i18n.svelte';
  import type { ViewCtx } from '../geometry';
  import { CHOSEN_FONT, CHOSEN_LINE, type ChosenLabel } from '../chosenLabel';
  import { SCHOOL_BADGE_H as BADGE_H, schoolBadgeWidth as badgeWidth, type School, type SchoolCluster } from '../schools';
  // Maple Bear schools, in two parts around Places.svelte (Layers.svelte):
  // - `squares`: a small rounded square per school standing alone, under city dots and names;
  // - `badges`: count badges for groups, above city dots, names and continent names so the digits stay
  //   readable, and the school chosen from a list — a bigger, ringed square;
  // - `label`: the chosen school's name, over everything else on the map including the point's guide
  //   lines (its halo keeps it readable where one crosses it).
  // A click on a badge zooms in on the group or lists it (FlatMap/Globe look the group up by its
  // `data-school-cluster` key). School names are placed by Places.svelte; the accessible way to a
  // school is the Schools list (SchoolList.svelte).
  let { ctx, clusters, part, chosen = null, label = null }: { ctx: ViewCtx; clusters: SchoolCluster[]; part: 'squares' | 'badges' | 'label'; chosen?: { x: number; y: number; school: School } | null; label?: ChosenLabel | null } = $props();

  const SQUARE = 10;
  const CHOSEN = 15;
  /** A badge's pointer target: 44 CSS px where there is room, never less than 24 (WCAG 2.5.8). */
  const HIT = 44, HIT_MIN = 24;
  // Half the distance (CSS px, per axis) to the nearest other school mark — badge, square or the chosen
  // school — so neighbouring targets never overlap and a badge's target never covers the chosen square.
  const hitHalves = $derived.by(() => {
    if (part !== 'badges') return new Map<string, [number, number]>();
    const marks = [...clusters.map((c) => ({ key: c.key, x: c.x, y: c.y })), ...(chosen ? [{ key: '', x: chosen.x, y: chosen.y }] : [])];
    const out = new Map<string, [number, number]>();
    for (const c of clusters) {
      if (c.members.length < 2) continue;
      const w = badgeWidth(c.members.length);
      let halfW = Math.max(HIT, w + 12) / 2, halfH = HIT / 2;
      for (const m of marks) {
        if (m.key === c.key) continue;
        const dx = Math.abs(m.x - c.x) / ctx.px, dy = Math.abs(m.y - c.y) / ctx.px;
        // Only a neighbour whose target could reach this one along both axes limits it, along the freer axis.
        if (dx >= halfW * 2 || dy >= halfH * 2) continue;
        if (dx >= dy) halfW = Math.min(halfW, dx / 2); else halfH = Math.min(halfH, dy / 2);
      }
      out.set(c.key, [Math.max(HIT_MIN / 2, halfW), Math.max(HIT_MIN / 2, halfH)]);
    }
    return out;
  });
</script>

<g class="schools {part}">
  {#each clusters as c (c.key)}
    {#if part === 'squares' && c.members.length === 1}
      <rect class="school" data-school={c.key} x={c.x - (SQUARE / 2) * ctx.px} y={c.y - (SQUARE / 2) * ctx.px} width={SQUARE * ctx.px} height={SQUARE * ctx.px} rx={2.5 * ctx.px} />
    {:else if part === 'badges' && c.members.length > 1}
      {@const n = c.members.length}
      {@const w = badgeWidth(n)}
      {@const half = hitHalves.get(c.key) ?? [HIT / 2, HIT / 2]}
      <g class="school-cluster" data-school-cluster={c.key} transform="translate({c.x} {c.y})">
        <title>{tn('map.schools.count', n)}</title>
        <rect class="hit" x={-half[0] * ctx.px} y={-half[1] * ctx.px} width={half[0] * 2 * ctx.px} height={half[1] * 2 * ctx.px} />
        <rect class="school-badge" x={(-w / 2) * ctx.px} y={(-BADGE_H / 2) * ctx.px} width={w * ctx.px} height={BADGE_H * ctx.px} rx={6 * ctx.px} />
        <text class="count" y={4.3 * ctx.px} text-anchor="middle" font-size={12.5 * ctx.px}>{n}</text>
      </g>
    {/if}
  {/each}
  {#if part === 'badges' && chosen}
    <g class="school-chosen-mark" transform="translate({chosen.x} {chosen.y})">
      <rect class="chosen-ring" x={(-CHOSEN / 2 - 4) * ctx.px} y={(-CHOSEN / 2 - 4) * ctx.px} width={(CHOSEN + 8) * ctx.px} height={(CHOSEN + 8) * ctx.px} rx={6 * ctx.px} />
      <rect class="school school-chosen" data-school={chosen.school.id} x={(-CHOSEN / 2) * ctx.px} y={(-CHOSEN / 2) * ctx.px} width={CHOSEN * ctx.px} height={CHOSEN * ctx.px} rx={3.5 * ctx.px} />
    </g>
  {/if}
  {#if part === 'label' && label}
    <!-- Wrapped lines keep a space at their end, so the text reads as the whole name. -->
    <text class="halo school-name chosen" data-school={label.id} x={label.x} y={label.y} text-anchor={label.anchor} font-size={CHOSEN_FONT * ctx.px}>{#each label.lines as line, i (i)}<tspan x={label.x} dy={i === 0 ? 0 : CHOSEN_LINE * ctx.px}>{line}{i < label.lines.length - 1 ? ' ' : ''}</tspan>{/each}</text>
  {/if}
</g>

<style>
  .school { fill: var(--school); stroke: var(--school-border); stroke-width: calc(2px * var(--stroke-scale)); vector-effect: non-scaling-stroke; }
  .school-chosen { stroke-width: calc(2.5px * var(--stroke-scale)); }
  .chosen-ring { fill: none; stroke: var(--school); stroke-width: calc(2.5px * var(--stroke-scale)); vector-effect: non-scaling-stroke; pointer-events: none; }
  .school-chosen-mark { pointer-events: none; }
  .school-cluster { cursor: pointer; }
  .school-name { fill: var(--school-text); font-weight: 800; pointer-events: none; }
  .hit { fill: transparent; }
  .school-badge { fill: var(--school); stroke: var(--school-border); stroke-width: calc(2px * var(--stroke-scale)); vector-effect: non-scaling-stroke; }
  .count { fill: var(--school-contrast); font-weight: 800; font-family: var(--font); font-variant-numeric: tabular-nums; pointer-events: none; }
</style>
