<script lang="ts">
  import { onMount } from 'svelte';
  import { t, tn } from '../i18n/i18n.svelte';
  import type { School } from './schools';
  import { showSchool } from './showSchool';

  // The schools of a count badge that zooming in cannot pull apart (they share one spot, or the map is
  // as close as it goes), listed next to where it was clicked. Buttons work like the Schools list.
  // Escape or a press outside closes it; focus moves in when it opens and back to the map on Escape.
  let { members, x, y, onclose }: { members: School[]; x: number; y: number; onclose: (refocus: boolean) => void } = $props();
  const uid = `school-pop-${Math.random().toString(36).slice(2, 8)}`;
  let box: HTMLDivElement;

  onMount(() => {
    box.querySelector<HTMLButtonElement>('.pick')?.focus();
    const outside = (e: PointerEvent) => { if (!box.contains(e.target as Node)) onclose(false); };
    // Capture: the map's own pointer handlers must not see the press first and keep it open.
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  });

  function onkeydown(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    e.stopPropagation();
    onclose(true);
  }

  function pick(id: string) {
    showSchool(id);
    onclose(true);
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -- Escape closes the dialog -->
<div class="pop" role="dialog" tabindex="-1" aria-labelledby="{uid}-title" bind:this={box} style:--x="{x}px" style:--y="{y}px" {onkeydown}>
  <div class="head">
    <p id="{uid}-title" class="title">{tn('map.schools.count', members.length)}</p>
    <button type="button" class="btn icon close" aria-label={t('schools.close')} title={t('schools.close')} onclick={() => onclose(true)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  </div>
  <ul>
    {#each members as s (s.id)}
      <li>
        <button type="button" class="pick" onclick={() => pick(s.id)}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="2.5" /></svg>
          <span>{s.name}</span>
        </button>
      </li>
    {/each}
  </ul>
</div>

<style>
  .pop {
    position: absolute; z-index: 20; width: min(20rem, calc(100% - 1rem));
    left: clamp(0.5rem, calc(var(--x) - 10rem), calc(100% - min(20rem, calc(100% - 1rem)) - 0.5rem));
    top: var(--y);
    background: var(--surface); color: var(--text); border: 1px solid var(--border-strong); border-radius: var(--radius); box-shadow: var(--shadow-3);
  }
  .head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); padding: var(--space-1) var(--space-1) var(--space-1) var(--space-4); border-bottom: 1px solid var(--border); }
  .title { margin: 0; font-weight: var(--weight-strong); }
  .close { flex: none; }
  .close svg { fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; }
  ul { list-style: none; margin: 0; padding: var(--space-2); display: grid; gap: var(--space-1); max-height: 15rem; overflow: auto; }
  .pick { width: 100%; min-height: var(--tap); display: flex; gap: var(--space-2); align-items: center; text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: var(--space-1) var(--space-3); font-weight: 600; }
  .pick:hover { background: var(--accent-soft); border-color: var(--accent); }
  .pick svg { width: 0.9rem; height: 0.9rem; flex: none; }
  .pick rect { fill: var(--school); stroke: var(--school-border); stroke-width: 1.5; }
</style>
