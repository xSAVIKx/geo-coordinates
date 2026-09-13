<script lang="ts">
  import { LANGS, type LangCode } from '../geo/types';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { formatRoute } from './router';
  import { switchLang } from './router.svelte';
  import SettingsDialog from './SettingsDialog.svelte';

  const NAMES: Record<LangCode, string> = { en: 'English', pl: 'Polski', uk: 'Українська' };
  const SHORT: Record<LangCode, string> = { en: 'EN', pl: 'PL', uk: 'УК' };
  let settingsOpen = $state(false);
</script>

<header class="bar">
  <div class="inner">
    <a class="brand" href={formatRoute({ name: 'home', lang: i18n.lang })}>
      <svg class="logo" viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
        <circle cx="20" cy="20" r="17" class="logo-sea" />
        <ellipse cx="20" cy="20" rx="7" ry="17" class="logo-line" />
        <path d="M5.5 11.5h29M5.5 28.5h29" class="logo-line" />
        <path d="M3 20h34" class="logo-eq" />
        <circle cx="20" cy="20" r="17" class="logo-rim" />
        <circle cx="27" cy="11.5" r="3.6" class="logo-pt" />
      </svg>
      <span class="title">{t('app.title')}</span>
    </a>
    <div class="actions">
      <div class="langs seg" role="group" aria-label={t('header.language')}>
        {#each LANGS as l (l)}
          <button type="button" class="btn" lang={l} aria-pressed={i18n.lang === l} onclick={() => switchLang(l)}>
            <span aria-hidden="true">{SHORT[l]}</span><span class="visually-hidden">{SHORT[l]} – {NAMES[l]}</span>
          </button>
        {/each}
      </div>
      <button type="button" class="btn quiet settings" aria-haspopup="dialog" onclick={() => (settingsOpen = true)}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L15 3.5h-4L10.7 6a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>
        <span class="label">{t('header.settings')}</span>
      </button>
    </div>
  </div>
</header>
<SettingsDialog bind:open={settingsOpen} />

<style>
  .bar { position: sticky; top: 0; z-index: 20; background: var(--surface); background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: saturate(1.4) blur(10px); -webkit-backdrop-filter: saturate(1.4) blur(10px); border-bottom: 1px solid var(--border); }
  .inner { display: flex; gap: var(--space-2) var(--space-4); align-items: center; justify-content: space-between; min-height: var(--header-h); padding: var(--space-2) var(--space-6); max-width: var(--page-max); margin-inline: auto; }
  .brand { display: inline-flex; gap: var(--space-3); align-items: center; color: var(--text); text-decoration: none; font-weight: var(--weight-heavy); font-size: var(--step-1); letter-spacing: var(--tracking-tight); min-height: var(--tap); min-width: 0; border-radius: var(--radius-sm); }
  .title { line-height: 1.15; }
  .logo { flex: none; width: 2.5rem; height: 2.5rem; transition: transform 400ms var(--ease); }
  .brand:hover .logo { transform: rotate(-12deg); }
  .logo-sea { fill: var(--accent); }
  .logo-line { fill: none; stroke: var(--accent-contrast); stroke-width: 1.6; opacity: 0.55; }
  .logo-eq { stroke: var(--warm); stroke-width: 2.6; stroke-linecap: round; }
  .logo-rim { fill: none; stroke: var(--accent); stroke-width: 2; }
  .logo-pt { fill: var(--warm); stroke: var(--surface); stroke-width: 2; }
  .actions { display: flex; gap: var(--space-2); align-items: center; flex: none; }
  .langs .btn { min-width: 2.75rem; padding: 0 var(--space-3); font-size: var(--step--1); letter-spacing: 0.03em; }
  .settings { padding: 0 var(--space-3); }
  @media (max-width: 899px) { .brand { font-size: var(--step-0); } }
  @media (max-width: 599px) {
    .inner { padding: var(--space-2) var(--space-3); gap: var(--space-2); }
    .settings { width: var(--tap); padding: 0; }
    .settings .label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .brand { font-size: var(--step-0); gap: var(--space-2); }
    .logo { width: 2.25rem; height: 2.25rem; }
  }
  @media (max-width: 479px) {
    .title { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
  }
</style>
