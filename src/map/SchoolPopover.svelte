<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { t, tn } from '../i18n/i18n.svelte';
  import type { School } from './schools';
  import { showSchool } from './showSchool';

  // The schools of a count badge that zooming in cannot pull apart (they share one spot, or the map is
  // as close as it goes), listed next to where it was clicked. Buttons work like the Schools list.
  // It opens below the press, or above it when that has more room (never over the map's toolbar, past
  // the bottom of the window or under the sticky header), scrolling its list when neither side is tall
  // enough. Escape anywhere, a press outside or focus moving out closes it; focus moves in on opening
  // and back to the map on Escape.
  // x, y: the press, and mapBottom: the bottom of the map frame, in the figure's CSS px.
  let { members, x, y, mapBottom, onclose }: { members: School[]; x: number; y: number; mapBottom: number; onclose: (refocus: boolean) => void } = $props();
  const uid = `school-pop-${Math.random().toString(36).slice(2, 8)}`;
  const GAP = 14, MARGIN = 6;
  let box: HTMLDivElement;
  let top = $state(0);
  let maxHeight = $state<number | null>(null);
  let placed = $state(false);

  onMount(() => {
    const figureTop = (box.offsetParent ?? document.body).getBoundingClientRect().top;
    const headerBottom = document.querySelector('header')?.getBoundingClientRect().bottom ?? 0;
    const height = box.offsetHeight;
    const below = Math.min(mapBottom, window.innerHeight - figureTop) - (y + GAP) - MARGIN;
    const above = y - GAP - Math.max(0, headerBottom - figureTop) - MARGIN;
    if (height <= below || below >= above) {
      top = y + GAP;
      if (height > below) maxHeight = Math.max(120, below);
    } else {
      const h = Math.min(height, above);
      if (height > above) maxHeight = Math.max(120, above);
      top = y - GAP - h;
    }
    placed = true;
    // Once shown: a hidden element cannot take focus.
    void tick().then(() => box?.querySelector<HTMLButtonElement>('.pick')?.focus());
    const outside = (e: PointerEvent) => { if (!box.contains(e.target as Node)) onclose(false); };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onclose(true);
    };
    // Capture: the map's own pointer and key handlers must not see these first.
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
    };
  });

  function onfocusout(e: FocusEvent) {
    const to = e.relatedTarget as Node | null;
    if (to) { if (!box.contains(to)) onclose(false); return; }
    // No new focus known yet (e.g. a click on a spot that takes none): decide once the focus has
    // settled — a click on the dialog's own background focuses the dialog itself.
    setTimeout(() => { if (box?.isConnected && !box.contains(document.activeElement)) onclose(false); }, 0);
  }

  function pick(id: string) {
    showSchool(id);
    onclose(true);
  }
</script>

<div class="pop" role="dialog" tabindex="-1" aria-labelledby="{uid}-title" bind:this={box} style:--x="{x}px" style:top="{top}px" style:max-height={maxHeight === null ? undefined : `${maxHeight}px`} class:placed {onfocusout}>
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
    position: absolute; z-index: 30; width: min(20rem, calc(100% - 1rem)); display: flex; flex-direction: column; visibility: hidden;
    left: clamp(0.5rem, calc(var(--x) - 10rem), calc(100% - min(20rem, calc(100% - 1rem)) - 0.5rem));
    background: var(--surface); color: var(--text); border: 1px solid var(--border-strong); border-radius: var(--radius); box-shadow: var(--shadow-3);
  }
  .pop.placed { visibility: visible; }
  .head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); padding: var(--space-1) var(--space-1) var(--space-1) var(--space-4); border-bottom: 1px solid var(--border); }
  .title { margin: 0; font-weight: var(--weight-strong); }
  .close { flex: none; }
  .close svg { fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; }
  ul { list-style: none; margin: 0; padding: var(--space-2); display: grid; gap: var(--space-1); max-height: 15rem; min-height: 0; flex: 1 1 auto; overflow: auto; }
  .pick { width: 100%; min-height: var(--tap); display: flex; gap: var(--space-2); align-items: center; text-align: left; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: var(--space-1) var(--space-3); font-weight: 600; }
  .pick:hover { background: var(--accent-soft); border-color: var(--accent); }
  .pick svg { width: 0.9rem; height: 0.9rem; flex: none; }
  .pick rect { fill: var(--school); stroke: var(--school-border); stroke-width: 1.5; }
</style>
