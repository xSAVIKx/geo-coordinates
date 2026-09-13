<script lang="ts">
  import { tn } from '../../i18n/i18n.svelte';
  import type { ViewCtx } from '../geometry';
  import { SCHOOL_BADGE_H as BADGE_H, schoolBadgeWidth as badgeWidth, type SchoolCluster } from '../schools';
  // Maple Bear schools: a small rounded square per school, a count badge per group. A click on a
  // badge zooms in on the group (FlatMap/Globe look the group up by its `data-school-cluster` key); the names and the
  // accessible way to reach a school are in the Schools list (SchoolList.svelte). The names of
  // schools standing alone are placed by Places.svelte, below place names in priority.
  let { ctx, clusters }: { ctx: ViewCtx; clusters: SchoolCluster[] } = $props();

  const SQUARE = 10;
</script>

<g class="schools">
  {#each clusters as c (c.key)}
    {#if c.members.length === 1}
      <rect class="school" data-school={c.key} x={c.x - (SQUARE / 2) * ctx.px} y={c.y - (SQUARE / 2) * ctx.px} width={SQUARE * ctx.px} height={SQUARE * ctx.px} rx={2.5 * ctx.px} />
    {:else}
      {@const n = c.members.length}
      {@const w = badgeWidth(n)}
      <g class="school-cluster" data-school-cluster={c.key} transform="translate({c.x} {c.y})">
        <title>{tn('map.schools.count', n)}</title>
        <rect class="hit" x={-(w / 2 + 6) * ctx.px} y={-(BADGE_H / 2 + 6) * ctx.px} width={(w + 12) * ctx.px} height={(BADGE_H + 12) * ctx.px} />
        <rect class="school-badge" x={(-w / 2) * ctx.px} y={(-BADGE_H / 2) * ctx.px} width={w * ctx.px} height={BADGE_H * ctx.px} rx={6 * ctx.px} />
        <text class="count" y={4.3 * ctx.px} text-anchor="middle" font-size={12.5 * ctx.px}>{n}</text>
      </g>
    {/if}
  {/each}
</g>

<style>
  .school { fill: var(--school); stroke: var(--school-border); stroke-width: 2; vector-effect: non-scaling-stroke; }
  .school-cluster { cursor: pointer; }
  .hit { fill: transparent; }
  .school-badge { fill: var(--school); stroke: var(--school-border); stroke-width: 2; vector-effect: non-scaling-stroke; }
  .count { fill: var(--school-contrast); font-weight: 800; font-family: var(--font); font-variant-numeric: tabular-nums; pointer-events: none; }
</style>
