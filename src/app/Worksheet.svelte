<script lang="ts">
  import { t } from '../i18n/i18n.svelte';
  import { renderText } from '../i18n/text';
  import StaticMap from '../map/StaticMap.svelte';
  import { needsMap, paperPrompt, paperScene } from '../quiz/paper';
  import { describeAnswer, generateSet, modulesForTopic } from '../quiz/registry';
  import type { Difficulty, Question } from '../quiz/types';
  import { AUTHOR } from './credits';
  import { TOPIC_IDS, inTopicOrder, type TopicId } from './ids';
  import PrintTools from './PrintTools.svelte';

  // A printable worksheet: settings (never printed) and a paper preview that prints as is. The questions
  // come from the same generators as Practice, seeded by the code, so a code with the same topics, level
  // and count always makes the same sheet. The answer key starts on a new page and can be left out.
  const available = TOPIC_IDS.filter((id) => modulesForTopic(id).length > 0);
  const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
  const COUNTS = [6, 10, 15];
  const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
  const newCode = () => Math.random().toString(36).slice(2, 6);

  let chosen = $state<TopicId[]>([...available]);
  let difficulty = $state<Difficulty>('medium');
  let count = $state(10);
  // What is typed in the code field; the sheet follows it a moment later, so typing does not redraw every map on each key.
  const firstCode = newCode();
  let codeInput = $state(firstCode);
  let code = $state(firstCode);
  $effect(() => {
    const next = codeInput;
    if (next === code) return;
    const timer = setTimeout(() => (code = next), 350);
    return () => clearTimeout(timer);
  });
  let showKey = $state(true);

  const cleanCode = $derived(code.trim().replace(/[^\w-]/g, '').slice(0, 32));
  const topics = $derived(inTopicOrder(chosen));
  const questions = $derived<Question[]>(topics.length && cleanCode ? generateSet(`sheet:${cleanCode}`, topics, difficulty, count) : []);
  const year = new Date().getFullYear();

  function unitLabel(q: Question): string {
    return q.input.kind === 'number' ? t(`unit.label.${q.input.unit}`) : '';
  }
</script>

<h1 tabindex="-1" class="no-print">{t('mode.worksheet.title')}</h1>

<form class="ws-settings no-print" onsubmit={(e) => e.preventDefault()}>
  <p class="intro">{t('worksheet.intro')}</p>
  <fieldset aria-describedby={topics.length === 0 ? 'ws-no-topics' : undefined}>
    <legend>{t('classQuiz.topics')}</legend>
    <div class="topics">
      {#each available as id (id)}
        <label class="topic"><input type="checkbox" value={id} bind:group={chosen} /><span class="num" aria-hidden="true">{id}</span><span class="visually-hidden">{id}.</span> {t(`topic.${id}.title`)}</label>
      {/each}
    </div>
    {#if topics.length === 0}<p id="ws-no-topics" class="err" role="alert">{t('classQuiz.noTopics')}</p>{/if}
  </fieldset>
  <div class="row">
    <fieldset>
      <legend>{t('practice.difficulty')}</legend>
      <div class="seg">
        {#each DIFFS as d (d)}<label><input type="radio" name="ws-difficulty" value={d} bind:group={difficulty} /> {t(`difficulty.${d}`)}</label>{/each}
      </div>
    </fieldset>
    <fieldset>
      <legend>{t('classQuiz.count')}</legend>
      <div class="seg">
        {#each COUNTS as n (n)}<label><input type="radio" name="ws-count" value={n} bind:group={count} /> {n}</label>{/each}
      </div>
    </fieldset>
    <div class="code">
      <label for="ws-code">{t('worksheet.code')}</label>
      <div class="code-row">
        <input id="ws-code" type="text" bind:value={codeInput} maxlength="32" autocomplete="off" spellcheck="false" />
        <button type="button" class="btn" onclick={() => { codeInput = newCode(); code = codeInput; }}>{t('worksheet.newCode')}</button>
      </div>
    </div>
  </div>
  <label class="check"><input type="checkbox" bind:checked={showKey} /> {t('worksheet.showKey')}</label>
</form>

<PrintTools />

{#if questions.length}
  <h2 class="visually-hidden">{t('worksheet.preview')}</h2>
  <article class="paper" aria-labelledby="ws-title">
    <header class="paper-head">
      <h2 id="ws-title">{t('worksheet.sheetTitle')}</h2>
      <p class="meta">{t('worksheet.meta', { level: t(`difficulty.${difficulty}`), topics: topics.join(', '), count, code: cleanCode })}</p>
      <div class="fill">
        <span>{t('worksheet.name')}: <i class="line long"></i></span>
        <span>{t('worksheet.class')}: <i class="line short"></i></span>
        <span>{t('worksheet.date')}: <i class="line mid"></i></span>
      </div>
    </header>

    <ol class="questions">
      {#each questions as q, i (`${cleanCode}:${difficulty}:${topics.join()}:${q.id}`)}
        {@const withMap = needsMap(q)}
        <li class="q" class:with-map={withMap}>
          <p class="prompt"><span class="n">{i + 1}.</span> {renderText(paperPrompt(q))}</p>
          {#if withMap}
            <div class="map"><StaticMap scene={paperScene(q)} label={t('worksheet.map', { n: i + 1 })} /></div>
          {/if}
          {#if q.input.kind === 'choice'}
            <ul class="options">
              {#each q.input.options as o, j (j)}<li><span class="box" aria-hidden="true"></span><b>{LETTERS[j]}</b> {renderText(o)}</li>{/each}
            </ul>
          {:else if q.input.kind === 'coords' && !q.input.mapPick}
            <p class="blanks">
              {#if q.input.fields !== 'lon'}<span>{t('input.lat')}: <i class="line mid"></i></span>{/if}
              {#if q.input.fields !== 'lat'}<span>{t('input.lon')}: <i class="line mid"></i></span>{/if}
            </p>
          {:else if q.input.kind === 'number'}
            <p class="blanks"><span>{t('worksheet.answer')}: <i class="line mid"></i> {unitLabel(q)}</span></p>
          {:else if q.input.kind === 'clock'}
            <p class="blanks"><span>{t('worksheet.time')}: <i class="line short"></i> : <i class="line short"></i></span></p>
          {/if}
        </li>
      {/each}
    </ol>
    <p class="foot">{t('cheat.foot', { app: t('app.title'), year, author: AUTHOR.name })}</p>

    {#if showKey}
      <section class="key" aria-labelledby="ws-key">
        <h2 id="ws-key">{t('worksheet.keyTitle')} <span class="meta">· {t('worksheet.meta', { level: t(`difficulty.${difficulty}`), topics: topics.join(', '), count, code: cleanCode })}</span></h2>
        <ol>
          {#each questions as q, i (q.id)}
            <li><span class="n">{i + 1}.</span> <b>{renderText(describeAnswer(q))}</b> — {renderText(q.explanation)}</li>
          {/each}
        </ol>
      </section>
    {/if}
  </article>
{/if}

<style>
  h1 { font-size: var(--step-3); margin: var(--space-2) 0 var(--space-4); }
  h1:focus { outline: none; }
  .ws-settings { display: flex; flex-direction: column; gap: var(--space-4); max-width: 60rem; margin-bottom: var(--space-5); padding: var(--space-5) var(--space-6); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); box-shadow: var(--shadow-1); }
  .intro { margin: 0; color: var(--text-muted); }
  fieldset { border: 0; margin: 0; padding: 0; min-width: 0; }
  legend, .code > label { padding: 0; margin-bottom: var(--space-2); font-weight: var(--weight-strong); color: var(--text-muted); display: block; }
  .topics { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 15rem), 1fr)); gap: var(--space-2); }
  .topic, .check { display: flex; align-items: center; gap: var(--space-2); min-height: var(--tap); padding: 0 var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); cursor: pointer; }
  .topic:has(input:checked) { border-color: var(--accent); background: var(--accent-soft); }
  .topic input, .check input { width: 1.2rem; height: 1.2rem; accent-color: var(--accent); flex: none; }
  .check { align-self: flex-start; }
  .num { display: inline-grid; place-items: center; flex: none; width: 1.6rem; height: 1.6rem; border-radius: 0.45rem; background: var(--warm-soft); color: var(--warm-text); font-weight: var(--weight-heavy); font-size: var(--step--1); }
  .err { margin: var(--space-2) 0 0; color: var(--bad); font-weight: var(--weight-strong); }
  .row { display: flex; flex-wrap: wrap; gap: var(--space-4) var(--space-6); align-items: flex-end; }
  .code-row { display: flex; flex-wrap: wrap; gap: var(--space-2); }
  .code input { min-height: var(--tap); width: 9rem; padding: 0 var(--space-3); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); font-variant-numeric: tabular-nums; }

  /* Paper: fixed black on white on every theme, rem on screen and pt/mm on paper. */
  .paper { --ink: #111111; --muted: #4a4a4a; max-width: 52rem; margin: 0 auto; padding: var(--space-8); background: #ffffff; color: var(--ink); border: 1px solid #d6d6d6; border-radius: var(--radius-lg); box-shadow: var(--shadow-2); color-scheme: light; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .paper h2 { margin: 0; color: var(--ink); font-size: 1.45rem; font-weight: 800; letter-spacing: 0; }
  .paper-head { border-bottom: 2px solid var(--ink); padding-bottom: 0.6em; margin-bottom: 1em; }
  .meta { margin: 0.15em 0 0; color: var(--muted); font-size: 0.85rem; font-weight: 600; }
  .fill { display: flex; flex-wrap: wrap; gap: 0.4em 1.5em; margin-top: 0.9em; }
  .line { display: inline-block; vertical-align: baseline; border-bottom: 1px solid var(--ink); height: 1em; }
  .line.long { width: 16em; max-width: 60vw; } .line.mid { width: 7em; } .line.short { width: 3.5em; }
  .questions { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.1em 1.6em; align-items: start; }
  @media (min-width: 720px) { .questions { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .q { break-inside: avoid; page-break-inside: avoid; display: flex; flex-direction: column; gap: 0.45em; padding-bottom: 0.9em; border-bottom: 1px solid #d9d9d9; }
  .prompt { margin: 0; font-weight: 650; line-height: 1.35; }
  .n { font-weight: 800; }
  .map { border-radius: 2px; }
  .options { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.25em; }
  .options li { display: flex; align-items: baseline; gap: 0.45em; }
  .box { flex: none; width: 0.85em; height: 0.85em; border: 1.2px solid var(--ink); border-radius: 2px; transform: translateY(0.1em); }
  .blanks { margin: 0.2em 0 0; display: flex; flex-wrap: wrap; gap: 0.6em 1.4em; }
  .foot { margin: 1em 0 0; color: var(--muted); font-size: 0.75rem; text-align: center; }
  .key { margin-top: 2.5em; padding-top: 1em; border-top: 2px dashed #9a9a9a; }
  .key h2 { font-size: 1.2rem; }
  .key h2 .meta { display: inline; font-size: 0.7em; }
  .key ol { list-style: none; margin: 0.7em 0 0; padding: 0; display: grid; gap: 0.45em; font-size: 0.92rem; line-height: 1.4; }
  .key li { break-inside: avoid; }
  @media (max-width: 599px) { .paper { padding: var(--space-4); } .ws-settings { padding: var(--space-4); } }

  @media print {
    .paper { max-width: none; padding: 0; border: 0; border-radius: 0; font-size: 10pt; }
    .paper h2 { font-size: 15pt; }
    .meta { font-size: 8.5pt; }
    .questions { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4mm 7mm; }
    .q { padding-bottom: 3mm; }
    .key { break-before: page; page-break-before: always; margin-top: 0; padding-top: 0; border-top: 0; }
    .key h2 { font-size: 13pt; border-bottom: 2px solid var(--ink); padding-bottom: 2mm; }
    .key ol { font-size: 9pt; }
    .foot { font-size: 7.5pt; }
  }
</style>
