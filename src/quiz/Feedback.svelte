<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { renderText } from '../i18n/text';
  import { describeAnswer } from './registry';
  import type { CheckResult, Question } from './types';

  let { question, result }: { question: Question; result: CheckResult } = $props();
</script>

<div class="feedback" class:ok={result.correct} class:bad={!result.correct}>
  <p class="verdict">
    <svg class="icon" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      {#if result.correct}<path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      {:else}<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />{/if}
    </svg>
    {result.correct ? t('practice.correct') : t('practice.incorrect')}
  </p>
  {#if result.mistake}<p class="mistake">{renderText(result.mistake)}</p>{/if}
  {#if !result.correct}<p class="answer">{t('practice.correctAnswer', { answer: renderText(describeAnswer(question)) })}</p>{/if}
  {#if result.note}<p>{renderText(result.note)}</p>{/if}
  <p class="why">{renderText(question.explanation)}</p>
</div>

<style>
  .feedback { border-radius: var(--radius); padding: var(--space-4) var(--space-5); border: 1px solid; border-left-width: 6px; animation: appear 240ms var(--ease) both; }
  @keyframes appear { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
  .ok { border-color: var(--ok); background: var(--ok-soft); }
  .bad { border-color: var(--bad); background: var(--bad-soft); }
  .verdict { display: flex; gap: var(--space-3); align-items: center; font-size: var(--step-2); font-weight: var(--weight-heavy); letter-spacing: var(--tracking-tight); margin: 0 0 var(--space-2); }
  .icon { flex: none; width: 2.25rem; height: 2.25rem; padding: 0.35rem; border-radius: 50%; color: var(--surface); }
  .ok .verdict { color: var(--ok); } .bad .verdict { color: var(--bad); }
  .ok .icon { background: var(--ok); } .bad .icon { background: var(--bad); }
  .mistake { font-weight: var(--weight-strong); }
  .answer { font-weight: var(--weight-heavy); }
  p { margin: var(--space-1) 0; }
  .why { color: var(--text); margin-top: var(--space-2); }
</style>
