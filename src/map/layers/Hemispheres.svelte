<script lang="ts">
  import { t } from '../../i18n/i18n.svelte';
  import { hemisphere, type ViewCtx } from '../geometry';
  import { useMapState } from '../mapStateContext';
  import { hemisphereLabels } from '../overlayLayout';
  const mapState = useMapState();
  let { ctx, idPrefix }: { ctx: ViewCtx; idPrefix: string } = $props();

  const regions = $derived(
    mapState.layers.hemispheres === 'ns' ? (['N', 'S'] as const) : mapState.layers.hemispheres === 'ew' ? (['E', 'W'] as const) : ([] as const),
  );
  // Shared with the special-line names, which keep clear of these (overlayLayout.ts).
  const labels = $derived(hemisphereLabels(ctx, mapState.layers.hemispheres, (r) => t(`hemi.${r}`)));
</script>

<defs>
  <pattern id="{idPrefix}-stripes" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
    <rect width="8" height="8" fill="var(--hemi-a)" /><line x1="0" y1="0" x2="0" y2="8" stroke="var(--marker-a)" stroke-width="1.5" stroke-opacity="0.16" />
  </pattern>
  <pattern id="{idPrefix}-dots" width="10" height="10" patternUnits="userSpaceOnUse">
    <rect width="10" height="10" fill="var(--hemi-b)" /><circle cx="5" cy="5" r="1.5" fill="var(--marker-b)" fill-opacity="0.26" />
  </pattern>
</defs>
{#each regions as r, i (r)}
  <path d={ctx.path(hemisphere(r)) ?? ''} fill="url(#{idPrefix}-{i === 0 ? 'stripes' : 'dots'})" />
{/each}
{#each labels as l (l.r)}
  <text class="halo hemi-label" x={l.x} y={l.y} text-anchor="middle" font-size={l.size * ctx.px}>{t(`hemi.${l.r}`)}</text>
{/each}

<style>
  .hemi-label { fill: var(--text); font-weight: 750; letter-spacing: 0.01em; }
</style>
