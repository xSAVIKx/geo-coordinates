<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
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
  <label class="row"><input type="checkbox" bind:checked={settings.largeText} /> {t('settings.largeText')}</label>
  <label class="row"><input type="checkbox" bind:checked={settings.reducedMotion} /> {t('settings.reducedMotion')}</label>
  <form method="dialog"><button class="primary">{t('settings.close')}</button></form>
</dialog>

<style>
  dialog { border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); color: var(--text); padding: var(--space-6); width: min(26rem, calc(100vw - 2rem)); }
  dialog::backdrop { background: rgb(0 0 0 / 0.45); }
  fieldset { border: 1px solid var(--border); border-radius: var(--radius); margin: 0 0 var(--space-4); }
  .row { display: flex; gap: var(--space-3); align-items: center; min-height: var(--tap); }
  .row input { width: 1.25rem; height: 1.25rem; }
  .primary { margin-top: var(--space-4); background: var(--accent); color: var(--accent-contrast); border: 0; border-radius: var(--radius); padding: 0 var(--space-6); font-weight: 600; }
</style>
