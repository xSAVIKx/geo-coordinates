<script lang="ts">
  import { i18n, t } from '../i18n/i18n.svelte';
  import { AUTHOR, MAP_DATA, SCHOOL_DATA } from './credits';
  const year = new Date().getFullYear();
  const retrieved = $derived(new Intl.DateTimeFormat(i18n.lang, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${SCHOOL_DATA.retrieved}T00:00:00Z`)));
</script>

<footer class="no-print" aria-label={t('footer.label')}>
  <p>
    © {year} {t('footer.madeBy', { name: AUTHOR.name })}
    <span class="sep" aria-hidden="true"> · </span>
    {t('footer.mapData', { source: '' })}<a href={MAP_DATA.url} rel="noopener">{MAP_DATA.name}</a>
  </p>
  <p class="links">
    <a href={AUTHOR.url} rel="author">{t('footer.website', { name: AUTHOR.name })}</a>
    <span class="sep" aria-hidden="true"> · </span>
    <a href={AUTHOR.github} rel="noopener">{t('footer.github', { name: AUTHOR.name })}</a>
  </p>
  <p class="schools">{t('footer.schools', { date: retrieved })}</p>
</footer>

<style>
  /* One calm band: credits and links share a row on wide screens (a hairline between them), the school
     data note sits under them. Links keep 44px tall targets; the rows themselves add little padding. */
  footer { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; column-gap: var(--space-4); padding: var(--space-3) var(--space-6) var(--space-4); border-top: 1px solid var(--border); background: var(--bg-deep); color: var(--text-muted); font-size: var(--step--1); }
  footer p { margin: 0; padding: 0; text-align: center; text-wrap: balance; }
  footer p.schools { flex: 1 0 100%; padding-top: var(--space-1); }
  footer a { color: inherit; display: inline-flex; align-items: center; min-height: var(--tap); text-decoration-color: color-mix(in srgb, currentColor 45%, transparent); }
  footer a:hover { color: var(--text); text-decoration-color: currentColor; }
  @media (min-width: 900px) {
    footer p.links { display: inline-flex; align-items: center; gap: var(--space-2); }
    footer p.links::before { content: ''; align-self: center; width: 1px; height: 1em; margin-right: var(--space-4); background: var(--border-strong); opacity: 0.6; }
  }
  @media (max-width: 599px) {
    footer { flex-direction: column; padding: var(--space-2) var(--space-3) var(--space-4); }
    .sep { display: block; height: 0; overflow: hidden; }
    footer p.schools { flex-basis: auto; }
  }
</style>
