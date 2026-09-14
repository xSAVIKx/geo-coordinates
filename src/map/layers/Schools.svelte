<script lang="ts">
  import { tn } from '../../i18n/i18n.svelte';
  import type { ViewCtx } from '../geometry';
  import { SCHOOL_BADGE_H as BADGE_H, schoolBadgeWidth as badgeWidth, type School, type SchoolCluster } from '../schools';
  // Maple Bear schools, in two parts around Places.svelte (Layers.svelte):
  // - `squares`: a small rounded square per school standing alone, under city dots and names;
  // - `badges`: count badges for groups, above city dots, names and continent names so the digits stay
  //   readable, and the school chosen from a list — a bigger, ringed square.
  // A click on a badge zooms in on the group or lists it (FlatMap/Globe look the group up by its
  // `data-school-cluster` key). School names are placed by Places.svelte; the accessible way to a
  // school is the Schools list (SchoolList.svelte).
  let { ctx, clusters, part, chosen = null }: { ctx: ViewCtx; clusters: SchoolCluster[]; part: 'squares' | 'badges'; chosen?: { x: number; y: number; school: School } | null } = $props();

  const SQUARE = 10;
  const CHOSEN = 15;
  /** Tall enough for a finger: a badge's pointer target is at least 44 CSS px high and wide. */
  const HIT = 44;
</script>

<g class="schools {part}">
  {#each clusters as c (c.key)}
    {#if part === 'squares' && c.members.length === 1}
      <rect class="school" data-school={c.key} x={c.x - (SQUARE / 2) * ctx.px} y={c.y - (SQUARE / 2) * ctx.px} width={SQUARE * ctx.px} height={SQUARE * ctx.px} rx={2.5 * ctx.px} />
    {:else if part === 'badges' && c.members.length > 1}
      {@const n = c.members.length}
      {@const w = badgeWidth(n)}
      {@const hitW = Math.max(HIT, w + 12)}
      <g class="school-cluster" data-school-cluster={c.key} transform="translate({c.x} {c.y})">
        <title>{tn('map.schools.count', n)}</title>
        <rect class="hit" x={(-hitW / 2) * ctx.px} y={(-HIT / 2) * ctx.px} width={hitW * ctx.px} height={HIT * ctx.px} />
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
</g>

<style>
  .school { fill: var(--school); stroke: var(--school-border); stroke-width: 2; vector-effect: non-scaling-stroke; }
  .school-chosen { stroke-width: 2.5; }
  .chosen-ring { fill: none; stroke: var(--school); stroke-width: 2.5; vector-effect: non-scaling-stroke; pointer-events: none; }
  .school-chosen-mark { pointer-events: none; }
  .school-cluster { cursor: pointer; }
  .hit { fill: transparent; }
  .school-badge { fill: var(--school); stroke: var(--school-border); stroke-width: 2; vector-effect: non-scaling-stroke; }
  .count { fill: var(--school-contrast); font-weight: 800; font-family: var(--font); font-variant-numeric: tabular-nums; pointer-events: none; }
</style>
