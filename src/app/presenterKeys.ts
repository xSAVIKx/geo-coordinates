/**
 * Which presenter-mode action a key press asks for (pure, so it is unit-tested without a DOM).
 *
 * - P toggles presenter mode, L toggles the pointer highlight while presenting, Esc leaves presenter mode.
 * - P and L are matched by the letter, and also by the physical key when the layout types a non-Latin letter
 *   (a Ukrainian layout types «з» / «д» on those keys), so the shortcut shown as "P" works there too.
 * - Nothing fires with Ctrl/Alt/Meta, on auto-repeat, during IME composition, or when an earlier handler
 *   already used the key.
 * - P and L never fire while the focus is somewhere that types or takes letters: text fields, selects,
 *   sliders, dialogs (Settings) and the schools popover (role="dialog").
 * - Esc is left to dialogs and the schools popover, which close themselves on it; everywhere else (a text
 *   field included) it leaves presenter mode first — the same as a browser in fullscreen, which spends the
 *   first Esc on leaving fullscreen — so the class quiz's own Esc ("end the quiz") needs a second press.
 */
export type PresenterAction = 'toggle' | 'laser' | 'exit' | null;

export interface KeyLike {
  key: string;
  code?: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
}

/** Where letters are typed or owned by the control (text fields, sliders), or where Esc belongs to a dialog. */
export const TYPING_SELECTOR = 'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="textbox"], [role="combobox"]';
export const DIALOG_SELECTOR = 'dialog, [role="dialog"], [role="alertdialog"]';

function letter(e: KeyLike, want: 'p' | 'l'): boolean {
  const k = e.key.toLowerCase();
  if (k === want) return true;
  // A non-Latin single letter (another layout): fall back to the physical key.
  return k.length === 1 && !/[a-z]/.test(k) && /\p{L}/u.test(k) && e.code === `Key${want.toUpperCase()}`;
}

export function presenterAction(e: KeyLike, ctx: { presenting: boolean; inTyping: boolean; inDialog: boolean }): PresenterAction {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.repeat || e.isComposing) return null;
  if (e.key === 'Escape') return ctx.presenting && !ctx.inDialog ? 'exit' : null;
  if (ctx.inTyping || ctx.inDialog) return null;
  if (letter(e, 'p')) return 'toggle';
  if (letter(e, 'l')) return ctx.presenting ? 'laser' : null;
  return null;
}
