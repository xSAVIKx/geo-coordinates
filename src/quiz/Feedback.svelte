<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { renderText } from '../i18n/text';
  import { describeAnswer } from './registry';
  import type { CheckResult, Question } from './types';

  let { question, result }: { question: Question; result: CheckResult } = $props();
</script>

<div class="feedback" class:ok={result.correct} class:bad={!result.correct}>
  <p class="verdict">
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
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
  .feedback { border-radius: var(--radius); padding: var(--space-3) var(--space-4); border: 2px solid; margin-top: var(--space-4); }
  .ok { border-color: var(--ok); } .bad { border-color: var(--bad); }
  .verdict { display: flex; gap: var(--space-2); align-items: center; font-size: 1.4rem; font-weight: 800; margin: 0 0 var(--space-2); }
  .ok .verdict { color: var(--ok); } .bad .verdict { color: var(--bad); }
  .mistake { font-weight: 600; }
  .answer { font-weight: 700; }
  p { margin: var(--space-1) 0; }
</style>
