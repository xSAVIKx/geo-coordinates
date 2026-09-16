<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { mapState } from './mapState.svelte';
  import { styleUnavailable } from './texture/fallback';
  import { renderHealth } from './texture/health.svelte';
  // Spec §4 fallback step 3: the chosen style cannot be drawn on this device, so the map shows Atlas and says so once.
  const unavailable = $derived(styleUnavailable(mapState.chosenMapStyle, renderHealth.state));
</script>

<p class="style-note" role="status">{#if unavailable}<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.2v.3" /></svg>{t('map.style.fallback')}{/if}</p>

<style>
  .style-note { margin: 0; display: flex; gap: var(--space-2); align-items: center; color: var(--text-muted); font-size: var(--step--1); }
  /*
   * The live region has to be in the accessibility tree before it has anything to say: `display: none` would take it
   * out of the tree, and a live region that appears only once it is populated reads as a brand-new region, which most
   * screen readers do not announce. So the empty note is taken out of the *flow* instead (the same treatment as
   * .visually-hidden in src/styles/base.css) — it keeps its place in the tree, and an out-of-flow box is not a flex
   * item, so it adds no gap to the stage either.
   */
  .style-note:empty { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
  svg { flex: none; width: 1.1rem; height: 1.1rem; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
</style>
