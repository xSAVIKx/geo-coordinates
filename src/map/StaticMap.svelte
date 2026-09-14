<script lang="ts">
  import { untrack } from 'svelte';
  import { makeFlatCtx } from './geometry';
  import Layers from './layers/Layers.svelte';
  import { MapState } from './mapState.svelte';
  import { provideMapState } from './mapStateContext';
  import type { SceneSpec } from './types';

  /*
   * A still flat map of one scene, for paper (the worksheet). It has its own MapState, handed to the
   * shared layer renderer through context (see mapStateContext.ts), so many can be on one page without
   * touching the interactive map. No pointer or keyboard handling; the picture is an image with a label.
   * `px`: view units per CSS px of text and marker size — 3 suits a map about 80–90 mm wide.
   */
  let { scene, label, px = 3 }: { scene: SceneSpec; label: string; px?: number } = $props();
  const W = 960, H = 480;
  const uid = `static-${Math.random().toString(36).slice(2, 8)}`;
  const state = new MapState();
  provideMapState(state);
  untrack(() => state.applyScene(scene));
  let applied = untrack(() => scene);
  $effect(() => {
    if (scene === applied) return;
    applied = scene;
    state.applyScene(scene);
  });
  const ctx = $derived(makeFlatCtx(W, H, state.flat.center, state.flat.zoom, px, 'grid'));
</script>

<svg class="static-map" viewBox="0 0 {W} {H}" role="img" aria-label={label}>
  <Layers {ctx} idPrefix={uid} />
  <rect class="frame" x="0.5" y="0.5" width={W - 1} height={H - 1} />
</svg>

<style>
  /* Black on white for paper, whatever the screen theme: the layers read these tokens. */
  .static-map {
    display: block; width: 100%; height: auto; overflow: hidden; background: #ffffff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    --stroke-scale: 1; --line-halo-width: 4px;
    --ocean: #ffffff; --ocean-deep: #ffffff; --ocean-light: #ffffff; --land: #e6e6e6; --land-stroke: #8c8c8c;
    --grid: #7a7a7a; --map-label: #000000; --ocean-label: #000000; --halo: #ffffff; --text: #000000; --surface: #ffffff;
    --accent: #000000; --equator: #000000; --prime: #000000; --antimeridian: #000000; --tropics: #333333;
    --equator-text: #000000; --prime-text: #000000; --antimeridian-text: #000000; --tropics-text: #000000;
    --marker-a: #000000; --marker-b: #000000; --marker-c: #000000; --marker-d: #000000; --marker-answer: #000000; --marker-wrong: #000000;
    --hemi-a: rgb(0 0 0 / 0.07); --hemi-b: rgb(0 0 0 / 0.12); --noon: #000000; --river: #777777; --river-label: #000000;
  }
  .frame { fill: none; stroke: #000000; stroke-width: 1px; vector-effect: non-scaling-stroke; }
</style>
