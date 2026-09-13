<script lang="ts">
  import { t } from '../../i18n/i18n.svelte';
  import { hemisphere, type ViewCtx } from '../geometry';
  import { mapState } from '../mapState.svelte';
  let { ctx, idPrefix }: { ctx: ViewCtx; idPrefix: string } = $props();

  const regions = $derived(
    mapState.layers.hemispheres === 'ns' ? (['N', 'S'] as const) : mapState.layers.hemispheres === 'ew' ? (['E', 'W'] as const) : ([] as const),
  );
  const LABEL_AT = { N: { lat: 45, lon: -120 }, S: { lat: -45, lon: -120 }, E: { lat: 60, lon: 90 }, W: { lat: 60, lon: -90 } } as const;
</script>

<defs>
  <pattern id="{idPrefix}-stripes" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="8" height="8" fill="var(--hemi-a)" /><line x1="0" y1="0" x2="0" y2="8" stroke="var(--marker-a)" stroke-width="1.5" stroke-opacity="0.35" />
  </pattern>
  <pattern id="{idPrefix}-dots" width="10" height="10" patternUnits="userSpaceOnUse">
    <rect width="10" height="10" fill="var(--hemi-b)" /><circle cx="5" cy="5" r="1.6" fill="var(--marker-b)" fill-opacity="0.45" />
  </pattern>
</defs>
{#each regions as r, i (r)}
  <path d={ctx.path(hemisphere(r)) ?? ''} fill="url(#{idPrefix}-{i === 0 ? 'stripes' : 'dots'})" />
{/each}
{#each regions as r (r)}
  {@const xy = ctx.project(ctx.kind === 'globe' ? { lat: LABEL_AT[r].lat > 0 ? 35 : -35, lon: r === 'E' || r === 'W' ? (r === 'E' ? 90 : -90) : -ctx.projection.rotate()[0] } : LABEL_AT[r])}
  {#if xy}<text class="halo hemi-label" x={xy[0]} y={xy[1]} text-anchor="middle" font-size={15 * ctx.px}>{t(`hemi.${r}`)}</text>{/if}
{/each}

<style>
  .hemi-label { fill: var(--text); }
</style>
