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

/*
 * The other half of the same guarantee, and the one the worksheet really rests on: Graticule, Daylight and Places
 * each behave differently per style, and each used to read `mapState.drawnMapStyle` for itself instead of taking
 * the style Layers hands it. That made paper Atlas only because `paperScene()` *also* forces `mapStyle: 'atlas'`
 * on the StaticMap's own MapState — two guards that read as one, so removing either would have looked safe.
 *
 * Here the shared MapState is on a non-Atlas style and the prop says 'atlas', so only a child that honours the
 * prop can pass: no grid casing (Graticule), no country or physical names (Places), and the SVG night shading
 * back on (Daylight, which Satellite otherwise leaves to the Black Marble image).
 */
// A world map drawn big enough for the style layers to have room for their names (1 view unit per CSS px).
const bigCtx = () => makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1);
const props = () => ({ ctx: bigCtx(), idPrefix: 'u' });
// Svelte's scoped-style hash is appended to every class it styles, so match the word, not the whole attribute.
const has = (cls: string) => (body: string) => new RegExp(`class="(?:[^"]* )?${cls}[ "]`).test(body);
const casing = has('grid-casing');
const countryNames = has('country-name');
const physicalNames = has('physical-name');
const nightShading = has('night');

test('Graticule and Places follow the style prop, not the shared MapState', () => {
  markReady('physical');
  mapState.setStylePreference('political');
  const styled = render(Layers, { props: props() }).body;
  expect(casing(styled), 'the live map casings its grid').toBe(true);
  expect(countryNames(styled), 'and writes country names').toBe(true);
  const paper = render(Layers, { props: { ...props(), style: 'atlas' as const } }).body;
  expect(casing(paper), 'paper keeps the bare Atlas grid').toBe(false);
  expect(countryNames(paper), 'and no country names').toBe(false);

  mapState.setStylePreference('physical');
  expect(physicalNames(render(Layers, { props: props() }).body)).toBe(true);
  expect(physicalNames(render(Layers, { props: { ...props(), style: 'atlas' as const } }).body)).toBe(false);
  mapState.setStylePreference('atlas');
  resetHealth();
});

test('Daylight follows the style prop: Satellite paints its own night, paper does not', () => {
  markReady('satellite');
  mapState.setStylePreference('satellite');
  mapState.layers.daylight = true;
  mapState.sun = { utcMinutes: 720, dayOfYear: 172, year: 2026 };
  expect(nightShading(render(Layers, { props: props() }).body), 'Satellite leaves the night to the image').toBe(false);
  expect(nightShading(render(Layers, { props: { ...props(), style: 'atlas' as const } }).body), 'paper shades it in SVG').toBe(true);
  mapState.layers.daylight = false;
  mapState.sun = null;
  mapState.setStylePreference('atlas');
  resetHealth();
});
