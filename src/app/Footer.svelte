<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { AUTHOR, MAP_DATA } from './credits';
  const year = new Date().getFullYear();
</script>

<footer aria-label={t('footer.label')}>
  <p>
    {#if AUTHOR.url}
      © {year} <a href={AUTHOR.url} rel="author">{t('footer.madeBy', { name: AUTHOR.name })}</a>
    {:else}
      © {year} {t('footer.madeBy', { name: AUTHOR.name })}
    {/if}
    <span aria-hidden="true"> · </span>
    {t('footer.mapData', { source: '' })}<a href={MAP_DATA.url} rel="noopener">{MAP_DATA.name}</a>
  </p>
</footer>

<style>
  footer { border-top: 1px solid var(--border); margin-top: var(--space-8); padding: var(--space-4); color: var(--text-muted); text-align: center; font-size: 0.95rem; }
  footer p { margin: 0; }
  footer a { color: inherit; display: inline-flex; align-items: center; min-height: var(--tap); }
</style>
