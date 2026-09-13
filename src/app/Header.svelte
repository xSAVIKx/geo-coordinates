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
  <a class="brand" href={formatRoute({ name: 'home', lang: i18n.lang })}>
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" />
      <ellipse cx="12" cy="12" rx="4.5" ry="10" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M2 12h20M4 7h16M4 17h16" stroke="currentColor" stroke-width="1.5" />
    </svg>
    <span>{t('app.title')}</span>
  </a>
  <div class="actions">
    <div class="langs" role="group" aria-label={t('header.language')}>
      {#each LANGS as l (l)}
        <button type="button" lang={l} aria-pressed={i18n.lang === l} onclick={() => switchLang(l)}>
          <span aria-hidden="true">{SHORT[l]}</span><span class="visually-hidden">{SHORT[l]} – {NAMES[l]}</span>
        </button>
      {/each}
    </div>
    <button type="button" class="icon-btn" aria-haspopup="dialog" onclick={() => (settingsOpen = true)}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L15 3.5h-4L10.7 6a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>
      <span class="label">{t('header.settings')}</span>
    </button>
  </div>
</header>
<SettingsDialog bind:open={settingsOpen} />

<style>
  .bar { display: flex; flex-wrap: wrap; gap: var(--space-2) var(--space-4); align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-4); background: var(--surface); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 20; }
  .brand { display: inline-flex; gap: var(--space-2); align-items: center; color: var(--text); text-decoration: none; font-weight: 700; font-size: 1.15rem; min-height: var(--tap); }
  .actions { display: flex; gap: var(--space-2); align-items: center; }
  .langs { display: inline-flex; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
  .langs button { border: 0; background: transparent; padding: 0 var(--space-3); font-weight: 600; }
  .langs button[aria-pressed='true'] { background: var(--accent); color: var(--accent-contrast); }
  .icon-btn { display: inline-flex; gap: var(--space-2); align-items: center; background: transparent; border: 1px solid var(--border); border-radius: var(--radius); padding: 0 var(--space-3); }
  @media (max-width: 599px) { .icon-btn .label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); } .brand span { font-size: 1rem; } }
</style>
