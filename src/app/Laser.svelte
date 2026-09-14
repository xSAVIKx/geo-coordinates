<script lang="ts">
  import { presenter } from './presenter.svelte';

  // The pointer highlight: a red dot that follows the mouse (or pen/finger) so the class can see where the
  // teacher points. Decorative (aria-hidden) and click-through; it only moves with the pointer, never animates,
  // so reduced motion keeps it. It waits off screen until the pointer first moves.
  let x = $state(-200), y = $state(-200);
  $effect(() => {
    if (!presenter.laser) return;
    const move = (e: PointerEvent) => { x = e.clientX; y = e.clientY; };
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', move, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', move);
    };
  });
</script>

{#if presenter.laser}
  <div class="laser" aria-hidden="true" style:transform="translate({x}px, {y}px)"></div>
{/if}

<style>
  .laser {
    position: fixed; left: calc(-1 * var(--laser) / 2); top: calc(-1 * var(--laser) / 2); z-index: 1000; pointer-events: none;
    --laser: 2.4rem;
    width: var(--laser); height: var(--laser); border-radius: 50%;
    background: radial-gradient(circle, rgb(255 32 32 / 0.95) 0 20%, rgb(255 32 32 / 0.45) 38%, rgb(255 32 32 / 0) 70%);
  }
</style>
