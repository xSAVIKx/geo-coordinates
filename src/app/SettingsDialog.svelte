<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { mapState } from '../map/mapState.svelte';
  import { MAP_STYLES } from '../map/mapStyle';
  import { settings, type Theme } from './settings.svelte';

  let { open = $bindable(false) }: { open?: boolean } = $props();
  let dialog: HTMLDialogElement;
  const THEMES: Theme[] = ['system', 'light', 'dark'];

  $effect(() => {
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });
</script>

<dialog bind:this={dialog} aria-labelledby="settings-title" onclose={() => (open = false)}>
  <h2 id="settings-title">{t('settings.title')}</h2>
  <fieldset>
    <legend>{t('settings.theme')}</legend>
    {#each THEMES as theme (theme)}
      <label class="row"><input type="radio" name="theme" value={theme} bind:group={settings.theme} /> {t(`settings.theme.${theme}`)}</label>
    {/each}
  </fieldset>
  <fieldset>
    <legend>{t('settings.mapStyle')}</legend>
    {#each MAP_STYLES as s (s)}
      <label class="row"><input type="radio" name="map-style" value={s} checked={mapState.stylePreference === s} onchange={() => mapState.setStylePreference(s)} /> {t(`map.style.${s}`)}</label>
    {/each}
  </fieldset>
  <label class="row"><input type="checkbox" bind:checked={settings.largeText} /> {t('settings.largeText')}</label>
  <label class="row"><input type="checkbox" bind:checked={settings.reducedMotion} /> {t('settings.reducedMotion')}</label>
  <form method="dialog"><button class="btn primary">{t('settings.close')}</button></form>
</dialog>

<style>
  dialog { border: 1px solid var(--border); border-radius: var(--radius-lg); background: var(--surface); color: var(--text); padding: var(--space-6); width: min(26rem, calc(100vw - 2rem)); box-shadow: var(--shadow-3); }
  dialog[open] { animation: pop 180ms var(--ease) both; }
  @keyframes pop { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: none; } }
  dialog::backdrop { background: rgb(10 16 24 / 0.5); backdrop-filter: blur(2px); }
  h2 { margin: 0 0 var(--space-4); font-size: var(--step-2); }
  fieldset { border: 1px solid var(--border); border-radius: var(--radius); margin: 0 0 var(--space-3); padding: var(--space-2) var(--space-4) var(--space-2); }
  legend { font-weight: var(--weight-strong); padding: 0 var(--space-1); }
  .row { display: flex; gap: var(--space-3); align-items: center; min-height: var(--tap); cursor: pointer; }
  .row input { width: 1.25rem; height: 1.25rem; margin: 0; accent-color: var(--accent); }
  form { display: flex; justify-content: flex-end; }
  .primary { margin-top: var(--space-4); padding: 0 var(--space-6); }
</style>
