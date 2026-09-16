import { describe, expect, test } from 'vitest';
import { drawnStyle, effectiveStyle, INITIAL_HEALTH, nextHealth, styleUnavailable, type FailReason, type HealthEvent, type RenderHealth } from '../../src/map/texture/fallback';

const run = (...events: HealthEvent[]): RenderHealth => events.reduce(nextHealth, INITIAL_HEALTH);
const fail = (reason: FailReason): HealthEvent => ({ type: 'fail', reason });

describe('fallback chain: WebGL → canvas → Atlas', () => {
  test('starts on WebGL with 4096 px textures', () => {
    expect(INITIAL_HEALTH).toEqual({ tier: 'webgl', maxTexture: 4096, waitingForRestore: false, vectorFailed: false, reasons: [] });
  });
  test.each(['no-webgl', 'shader', 'oom', 'render'] as const)('%s on WebGL moves to canvas', (reason) => {
    expect(run(fail(reason))).toMatchObject({ tier: 'canvas', reasons: [reason] });
  });
  test('a texture too large first tries 2048 px, then the canvas', () => {
    expect(run(fail('texture-size'))).toMatchObject({ tier: 'webgl', maxTexture: 2048 });
    expect(run(fail('texture-size'), fail('texture-size'))).toMatchObject({ tier: 'canvas', maxTexture: 2048, reasons: ['texture-size', 'texture-size'] });
  });
  test('an image that cannot be decoded goes straight to Atlas (the canvas needs the same images)', () => {
    expect(run(fail('decode')).tier).toBe('atlas');
  });
  test('a lost context waits; restored it stays on WebGL; not restored in time it moves to canvas', () => {
    expect(run({ type: 'context-lost' })).toMatchObject({ tier: 'webgl', waitingForRestore: true });
    expect(run({ type: 'context-lost' }, { type: 'context-restored' })).toMatchObject({ tier: 'webgl', waitingForRestore: false });
    expect(run({ type: 'context-lost' }, { type: 'restore-timeout' })).toMatchObject({ tier: 'canvas', waitingForRestore: false, reasons: ['context-lost'] });
    // A late timeout after a restore changes nothing.
    expect(run({ type: 'context-lost' }, { type: 'context-restored' }, { type: 'restore-timeout' }).tier).toBe('webgl');
  });
  test.each(['no-canvas', 'render', 'oom', 'texture-size', 'decode'] as const)('%s on the canvas moves to Atlas', (reason) => {
    expect(run(fail('no-webgl'), fail(reason)).tier).toBe('atlas');
  });
  test('Atlas is final for the page session', () => {
    const atlas = run(fail('decode'));
    expect(run(fail('decode'), { type: 'context-restored' }, fail('no-webgl'))).toEqual(atlas);
  });
  test('a vector layer failure is remembered without touching the raster tier', () => {
    expect(run({ type: 'vector-fail' })).toMatchObject({ tier: 'webgl', vectorFailed: true });
  });
});

describe('which style can be drawn', () => {
  const canvas = run(fail('no-webgl')), atlas = run(fail('decode')), vector = run({ type: 'vector-fail' });
  test('effective style', () => {
    expect(effectiveStyle('satellite', INITIAL_HEALTH)).toBe('satellite');
    expect(effectiveStyle('satellite', canvas)).toBe('satellite');
    expect(effectiveStyle('physical', atlas)).toBe('atlas');
    expect(effectiveStyle('satellite', atlas)).toBe('atlas');
    expect(effectiveStyle('political', atlas)).toBe('political');
    expect(effectiveStyle('political', vector)).toBe('atlas');
    expect(effectiveStyle('physical', vector)).toBe('atlas');
    expect(effectiveStyle('satellite', vector)).toBe('satellite');
    expect(effectiveStyle('atlas', atlas)).toBe('atlas');
  });
  test('a texture style draws Atlas until its images are decoded', () => {
    const none = { physical: false, satellite: false };
    expect(drawnStyle('physical', none)).toBe('atlas');
    expect(drawnStyle('physical', { physical: true, satellite: false })).toBe('physical');
    expect(drawnStyle('political', none)).toBe('political');
  });
  test('the "showing Atlas" note shows only when a chosen style fell back', () => {
    expect(styleUnavailable('satellite', atlas)).toBe(true);
    expect(styleUnavailable('satellite', canvas)).toBe(false);
    expect(styleUnavailable('atlas', atlas)).toBe(false);
    expect(styleUnavailable('political', vector)).toBe(true);
  });
});
