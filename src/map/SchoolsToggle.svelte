<script lang="ts">
  import { announce } from '../app/announcer.svelte';
  import { t, tn } from '../i18n/i18n.svelte';
  import { mapState } from './mapState.svelte';
  import { SCHOOLS } from './schools';
  // The "Maple Bear schools" switch in the flat map's and the globe's toolbars, offered only where
  // the scene sets `schoolsToggle` (the lab and topic 9's last step). Both views share the flag.
  const uid = `schools-${Math.random().toString(36).slice(2, 8)}`;

  function toggle() {
    mapState.layers.schools = !mapState.layers.schools;
    if (mapState.layers.schools) announce(tn('map.schools.count', SCHOOLS.length));
  }
</script>

{#if mapState.schoolsToggle}
  <button type="button" class="btn schools-toggle" aria-pressed={mapState.layers.schools} aria-describedby="{uid}-hint" onclick={toggle}>
    <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="2.5" /></svg>
    {t('map.schools')}
  </button>
  <p id="{uid}-hint" class="visually-hidden">{t('map.schools.hint')}</p>
{/if}

<style>
  .schools-toggle { padding: 0 var(--space-3); font-size: var(--step--1); gap: var(--space-2); }
  svg { width: 1rem; height: 1rem; flex: none; }
  rect { fill: var(--school); stroke: var(--school-border); stroke-width: 1.5; }
</style>
