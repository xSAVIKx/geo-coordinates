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
    <button type="button" class="btn icon step" aria-label={t('controls.decrease', { name: label })} onclick={() => set(value - step)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" /></svg></button>
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
    <button type="button" class="btn icon step" aria-label={t('controls.increase', { name: label })} onclick={() => set(value + step)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg></button>
  </div>
</div>

<style>
  .slider { display: flex; flex-direction: column; gap: var(--space-1); min-width: 0; }
  .head { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-2); }
  .name { font-weight: var(--weight-strong); color: var(--text-muted); }
  .value { font-variant-numeric: tabular-nums; font-weight: var(--weight-heavy); }
  .row { display: flex; align-items: center; gap: var(--space-2); }
  .step { border-radius: 50%; flex: none; }
  .step svg { fill: none; stroke: currentColor; stroke-width: 2.6; stroke-linecap: round; }
  .track { position: relative; flex: 1; height: var(--tap); touch-action: none; cursor: pointer; margin-inline: var(--space-2); }
  .track::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 8px; margin-top: -4px; border-radius: 4px; background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--border-strong); }
  .fill { position: absolute; left: 0; top: 50%; height: 8px; margin-top: -4px; border-radius: 4px; background: var(--accent); }
  .thumb { position: absolute; top: 50%; width: 30px; height: 30px; margin: -15px 0 0 -15px; border-radius: 50%; background: var(--surface); border: 3px solid var(--accent); box-shadow: var(--shadow-2); transition: transform var(--dur) var(--ease); }
  .thumb::after { content: ''; position: absolute; inset: 6px; border-radius: 50%; background: var(--accent); }
  .track:hover .thumb, .thumb:focus-visible { transform: scale(1.08); }
  .thumb:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
</style>
