import { describe, expect, test } from 'vitest';
import { leavesPresenter, presenterAction, type KeyLike } from '../../src/app/presenterKeys';

const idle = { presenting: false, inTyping: false, inDialog: false };
const on = { presenting: true, inTyping: false, inDialog: false };

describe('presenterAction', () => {
  test('P toggles presenter mode in both directions, either case', () => {
    expect(presenterAction({ key: 'p', code: 'KeyP' }, idle)).toBe('toggle');
    expect(presenterAction({ key: 'P', code: 'KeyP' }, on)).toBe('toggle');
  });

  test('L toggles the pointer only while presenting', () => {
    expect(presenterAction({ key: 'l', code: 'KeyL' }, idle)).toBeNull();
    expect(presenterAction({ key: 'l', code: 'KeyL' }, on)).toBe('laser');
  });

  test('a Cyrillic layout still reaches P and L through the physical key', () => {
    expect(presenterAction({ key: 'з', code: 'KeyP' }, idle)).toBe('toggle');
    expect(presenterAction({ key: 'д', code: 'KeyL' }, on)).toBe('laser');
    // A Latin letter on the P key (e.g. Dvorak "l") means that letter, not P.
    expect(presenterAction({ key: 'l', code: 'KeyP' }, idle)).toBeNull();
  });

  test('Esc leaves presenter mode, but not from a dialog or the schools popover', () => {
    expect(presenterAction({ key: 'Escape' }, on)).toBe('exit');
    expect(presenterAction({ key: 'Escape' }, { ...on, inTyping: true })).toBe('exit');
    expect(presenterAction({ key: 'Escape' }, { ...on, inDialog: true })).toBeNull();
    expect(presenterAction({ key: 'Escape' }, idle)).toBeNull();
  });

  test('letters are ignored while typing, in sliders and in dialogs', () => {
    expect(presenterAction({ key: 'p', code: 'KeyP' }, { ...idle, inTyping: true })).toBeNull();
    expect(presenterAction({ key: 'l', code: 'KeyL' }, { ...on, inTyping: true })).toBeNull();
    expect(presenterAction({ key: 'p', code: 'KeyP' }, { ...on, inDialog: true })).toBeNull();
  });

  test.each<KeyLike>([
    { key: 'p', ctrlKey: true }, { key: 'p', altKey: true }, { key: 'p', metaKey: true },
    { key: 'p', repeat: true }, { key: 'p', isComposing: true },
  ])('modified or repeated keys do nothing: %o', (e) => {
    expect(presenterAction(e, on)).toBeNull();
  });

  test('other keys (arrows, Space) are left to Explore and the class quiz', () => {
    for (const key of ['ArrowLeft', 'ArrowRight', ' ', 'Enter', 'q']) expect(presenterAction({ key }, on)).toBeNull();
  });
});

describe('leavesPresenter', () => {
  const base = { on: true, granted: true, fullscreen: false, pending: 0 };
  test('fullscreen left by the browser (Esc, its own UI) ends presenter mode once no request of ours is settling', () => {
    expect(leavesPresenter(base)).toBe(true);
    expect(leavesPresenter({ ...base, pending: 1 })).toBe(false); // checked again when that request settles
  });
  test('a refused fullscreen request keeps presenter mode on without fullscreen', () => {
    expect(leavesPresenter({ ...base, granted: false })).toBe(false);
  });
  test('nothing to do while still in fullscreen or already off', () => {
    expect(leavesPresenter({ ...base, fullscreen: true })).toBe(false);
    expect(leavesPresenter({ ...base, on: false })).toBe(false);
  });
});
