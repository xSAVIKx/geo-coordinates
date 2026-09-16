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
  .style-note:empty { display: none; }
  svg { flex: none; width: 1.1rem; height: 1.1rem; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
</style>
