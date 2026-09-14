<script lang="ts">
  import { announce } from '../app/announcer.svelte';
  import { motionReduced } from '../app/settings.svelte';
  import { t } from '../i18n/i18n.svelte';

  let { seconds, running, ondone }: { seconds: number; running: boolean; ondone: () => void } = $props();
  let left = $state(0);
  let key = $state(0);

  $effect(() => {
    void seconds; void key;
    left = seconds;
  });

  $effect(() => {
    if (!running || left <= 0) return;
    const id = setInterval(() => {
      left -= 1;
      if (left <= 0) { clearInterval(id); announce(t('classQuiz.timeUp')); ondone(); }
    }, 1000);
    return () => clearInterval(id);
  });

  export function restart() { key += 1; }
  const frac = $derived(seconds > 0 ? left / seconds : 0);
</script>

<div class="countdown" class:done={left <= 0} aria-hidden="true">
  <svg viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="44" class="track" />
    <circle cx="50" cy="50" r="44" class="ring" class:animate={!motionReduced()} style:stroke-dashoffset={276.5 * (1 - frac)} />
  </svg>
  <span>{left > 0 ? left : '0'}</span>
</div>

<style>
  .countdown { position: relative; width: clamp(3.5rem, 2rem + 3.5vw, 10rem); aspect-ratio: 1; flex: none; }
  svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .track { fill: none; stroke: var(--surface-2); stroke-width: 8; }
  .ring { fill: none; stroke: var(--accent); stroke-width: 8; stroke-dasharray: 276.5; stroke-linecap: round; }
  .ring.animate { transition: stroke-dashoffset 1s linear, stroke 300ms var(--ease); }
  span { position: absolute; inset: 0; display: grid; place-items: center; font-size: clamp(1.25rem, 0.6rem + 1.5vw, 4rem); font-weight: var(--weight-heavy); font-variant-numeric: tabular-nums; }
  .done .track { stroke: var(--bad-soft); }
  .done span { color: var(--bad); }
</style>
