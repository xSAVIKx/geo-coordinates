<script lang="ts">
  import type { Snippet } from 'svelte';
  import { LANGS, type LangCode } from '../geo/types';
  import { i18n, t } from '../i18n/i18n.svelte';
  import { switchLang } from './router.svelte';

  // The toolbar above a printable page (cheat sheet, worksheet): the page's language and the print button.
  // Never printed. `children` adds page-specific controls before the print button.
  let { children }: { children?: Snippet } = $props();
  const NAMES: Record<LangCode, string> = { en: 'English', pl: 'Polski', uk: 'Українська' };
</script>

<div class="tools no-print">
  <div class="seg langs" role="group" aria-label={t('header.language')}>
    {#each LANGS as l (l)}
      <button type="button" class="btn" lang={l} aria-pressed={i18n.lang === l} onclick={() => switchLang(l)}>{NAMES[l]}</button>
    {/each}
  </div>
  {@render children?.()}
  <div class="print">
    <button type="button" class="btn primary" onclick={() => window.print()}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 9V3.5h10V9M7 17.5H4.5v-7A1.5 1.5 0 0 1 6 9h12a1.5 1.5 0 0 1 1.5 1.5v7H17M7 14h10v6.5H7z" /></svg>
      {t('cheat.print')}
    </button>
    <p class="hint">{t('cheat.printHint')}</p>
  </div>
</div>

<style>
  .tools { display: flex; flex-wrap: wrap; gap: var(--space-3) var(--space-5); align-items: flex-start; margin: 0 0 var(--space-5); }
  .langs .btn { padding: 0 var(--space-3); }
  .print { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1) var(--space-3); }
  .print svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linejoin: round; }
  .hint { margin: 0; color: var(--text-muted); font-size: var(--step--1); max-width: 36ch; }
</style>
