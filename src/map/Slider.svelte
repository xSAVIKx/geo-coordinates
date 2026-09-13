<script lang="ts">
  import { t } from '../i18n/i18n.svelte';

  let { label, min, max, value, step, bigStep, valueText, display, onchange, wrap = false }: {
    label: string; min: number; max: number; value: number; step: number; bigStep: number;
    valueText: string; display: string; onchange: (v: number) => void; wrap?: boolean;
  } = $props();

  let track: HTMLDivElement;
  let dragging = false;
  const pct = $derived(((value - min) / (max - min)) * 100);

  function set(v: number) {
    if (wrap) { const span = max - min; while (v > max) v -= span; while (v <= min) v += span; }
    onchange(Math.max(min, Math.min(max, v)));
  }

  function onkeydown(e: KeyboardEvent) {
    const map: Record<string, () => number> = {
      ArrowUp: () => value + (e.shiftKey ? bigStep : step), ArrowRight: () => value + (e.shiftKey ? bigStep : step),
      ArrowDown: () => value - (e.shiftKey ? bigStep : step), ArrowLeft: () => value - (e.shiftKey ? bigStep : step),
      PageUp: () => value + bigStep, PageDown: () => value - bigStep, Home: () => min, End: () => max,
    };
    const f = map[e.key];
    if (!f) return;
    e.preventDefault();
    set(f());
  }

  function fromPointer(e: PointerEvent) {
    const r = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    onchange(min + ratio * (max - min));
  }
</script>

<div class="slider">
  <div class="head"><span class="name" aria-hidden="true">{label}</span><span class="value" aria-hidden="true">{display}</span></div>
  <div class="row">
    <button type="button" class="step" aria-label={t('controls.decrease', { name: label })} onclick={() => set(value - step)}>−</button>
    <!-- svelte-ignore a11y_no_static_element_interactions -- pointer drag on the track moves the thumb; the thumb itself carries role=slider and full keyboard support -->
    <div class="track" bind:this={track}
      onpointerdown={(e) => { dragging = true; track.setPointerCapture(e.pointerId); fromPointer(e); }}
      onpointermove={(e) => dragging && fromPointer(e)}
      onpointerup={() => (dragging = false)} onpointercancel={() => (dragging = false)}>
      <div class="fill" style:width="{pct}%"></div>
      <div class="thumb" style:left="{pct}%" role="slider" tabindex="0" aria-label={label}
        aria-valuemin={min} aria-valuemax={max} aria-valuenow={Math.round(value * 100) / 100} aria-valuetext={valueText}
        {onkeydown}></div>
    </div>
    <button type="button" class="step" aria-label={t('controls.increase', { name: label })} onclick={() => set(value + step)}>+</button>
  </div>
</div>

<style>
  .slider { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
  .head { display: flex; justify-content: space-between; gap: var(--space-2); font-weight: 600; }
  .value { font-variant-numeric: tabular-nums; }
  .row { display: flex; align-items: center; gap: var(--space-2); }
  .step { background: var(--surface); border: 1px solid var(--border); border-radius: 50%; font-size: 1.3rem; font-weight: 700; flex: none; }
  .track { position: relative; flex: 1; height: var(--tap); touch-action: none; cursor: pointer; }
  .track::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 6px; margin-top: -3px; border-radius: 3px; background: var(--surface-2); border: 1px solid var(--border); }
  .fill { position: absolute; left: 0; top: 50%; height: 6px; margin-top: -3px; border-radius: 3px; background: var(--accent); }
  .thumb { position: absolute; top: 50%; width: 28px; height: 28px; margin: -14px 0 0 -14px; border-radius: 50%; background: var(--accent); border: 3px solid var(--surface); box-shadow: 0 0 0 1px var(--accent); }
  .thumb:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
</style>
