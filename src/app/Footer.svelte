<script lang="ts">
  import { i18n, t } from '../i18n/i18n.svelte';
  import { AUTHOR, MAP_DATA, SCHOOL_DATA } from './credits';
  const year = new Date().getFullYear();
  const retrieved = $derived(new Intl.DateTimeFormat(i18n.lang, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${SCHOOL_DATA.retrieved}T00:00:00Z`)));
</script>

<footer aria-label={t('footer.label')}>
  <p>
    {#if AUTHOR.url}
      © {year} <a href={AUTHOR.url} rel="author">{t('footer.madeBy', { name: AUTHOR.name })}</a>
    {:else}
      © {year} {t('footer.madeBy', { name: AUTHOR.name })}
    {/if}
    <span class="sep" aria-hidden="true"> · </span>
    {t('footer.mapData', { source: '' })}<a href={MAP_DATA.url} rel="noopener">{MAP_DATA.name}</a>
  </p>
  <p class="schools">{t('footer.schools', { date: retrieved })}</p>
</footer>

<style>
  footer { border-top: 1px solid var(--border); background: var(--bg-deep); color: var(--text-muted); font-size: var(--step--1); }
  footer p { margin: 0 auto; max-width: var(--page-max); padding: var(--space-3) var(--space-6); text-align: center; text-wrap: balance; }
  footer a { color: inherit; display: inline-flex; align-items: center; min-height: var(--tap); text-decoration-color: color-mix(in srgb, currentColor 45%, transparent); }
  footer p.schools { padding-top: 0; }
  @media (max-width: 599px) { .sep { display: block; height: 0; overflow: hidden; } }
  footer a:hover { color: var(--text); text-decoration-color: currentColor; }
</style>
