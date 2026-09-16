import { expect, test } from 'vitest';
import { render } from 'svelte/server';
import { makeFlatCtx } from '../../src/map/geometry';
import Layers from '../../src/map/layers/Layers.svelte';
import { mapState } from '../../src/map/mapState.svelte';
import StaticMap from '../../src/map/StaticMap.svelte';
import { markReady, resetHealth } from '../../src/map/texture/health.svelte';

/*
 * Map styles spec §3: the worksheet is paper, and paper is always Atlas. A StaticMap has no WebGL layer under it
 * (TextureLayer.svelte is mounted only by the interactive FlatMap and Globe), so its Layers must keep drawing the
 * sea, land, lakes, rivers and coasts even while a texture style is the one on screen.
 */

const ctx = () => makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 2);
const hasLand = (body: string) => /class="ocean[ "]/.test(body) && /class="land[ "]/.test(body);

test('a worksheet map still draws sea and land while a texture style is chosen and ready', () => {
  markReady('physical');
  const out = render(StaticMap, { props: { scene: { views: ['flat'], mapStyle: 'physical' }, label: 'map 1' } });
  expect(hasLand(out.body)).toBe(true);
  resetHealth();
});

test('a view that does draw a texture under its SVG leaves the Atlas surfaces out', () => {
  markReady('physical');
  mapState.setStylePreference('physical');
  expect(hasLand(render(Layers, { props: { ctx: ctx(), idPrefix: 'u' } }).body)).toBe(false);
  expect(hasLand(render(Layers, { props: { ctx: ctx(), idPrefix: 'u', style: 'atlas' } }).body)).toBe(true);
  mapState.setStylePreference('atlas');
  resetHealth();
});
