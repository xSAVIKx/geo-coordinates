import { DIALOG_SELECTOR, presenterAction, TYPING_SELECTOR } from './presenterKeys';

/**
 * Presenter mode (spec §3.4): fullscreen when the browser allows it, viewport-based type, AAA contrast
 * tokens, thicker map lines and an optional pointer highlight. The look lives in tokens.css / base.css
 * under :root[data-presenter="true"]; this module owns the state, the keys and fullscreen.
 */
export const presenter = $state({ on: false, laser: false });

/**
 * How much bigger than the 16px baseline the interface is drawn: the root font size / 16. It folds in the
 * large-text setting, the big-screen step-ups (1.25× from 2560px, 1.5× from 3000px), the browser's own default size and presenter mode,
 * so the maps can size their labels and markers the same way the HTML around them grows. Also exposed to
 * CSS as --ui-scale (presenter mode thickens map lines with it).
 */
export const ui = $state({ scale: 1 });

function root(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.documentElement;
}

function apply(): void {
  const el = root();
  if (el) el.dataset.presenter = String(presenter.on);
  measure();
}

function measure(): void {
  const el = root();
  if (!el) return;
  const fs = parseFloat(getComputedStyle(el).fontSize);
  const scale = Number.isFinite(fs) && fs > 0 ? Math.round((fs / 16) * 1000) / 1000 : 1;
  if (scale !== ui.scale) ui.scale = scale;
  if (el.style.getPropertyValue('--ui-scale') !== String(scale)) el.style.setProperty('--ui-scale', String(scale));
}

function setOn(on: boolean): void {
  presenter.on = on;
  if (!on) presenter.laser = false;
  apply();
}

// Fullscreen requests settle asynchronously, so they run one after another, each bringing fullscreen in line
// with the latest state; `fullscreenchange` events caused by our own requests are not mistaken for the user
// leaving fullscreen (P pressed twice quickly must not end with presenter mode switched off).
let pending = 0;
let queue: Promise<void> = Promise.resolve();

async function syncFullscreen(): Promise<void> {
  try {
    if (presenter.on && !document.fullscreenElement && document.fullscreenEnabled) await document.documentElement.requestFullscreen();
    else if (!presenter.on && document.fullscreenElement) await document.exitFullscreen();
  } catch {
    // Fullscreen refused (a headless browser, an iframe without permission, no user gesture): the
    // presenter look still applies.
  }
}

export function togglePresenter(): Promise<void> {
  setOn(!presenter.on);
  pending++;
  queue = queue.then(syncFullscreen).finally(() => { pending--; });
  return queue;
}

export function toggleLaser(): void {
  if (presenter.on) presenter.laser = !presenter.laser;
}

export function installPresenter(): () => void {
  const onKey = (e: KeyboardEvent) => {
    const el = e.target instanceof Element ? e.target : null;
    const action = presenterAction(e, {
      presenting: presenter.on,
      inTyping: !!el?.closest(TYPING_SELECTOR),
      inDialog: !!el?.closest(DIALOG_SELECTOR),
    });
    if (!action) return;
    e.preventDefault();
    if (action === 'exit') {
      // First in line (capture on window): the class quiz's own Esc must not also end the quiz.
      e.stopPropagation();
      if (presenter.on) void togglePresenter();
    } else if (action === 'toggle') void togglePresenter();
    else toggleLaser();
  };
  // Leaving fullscreen by any route (Esc, the browser's own UI) leaves presenter mode.
  const onFullscreen = () => { if (pending === 0 && !document.fullscreenElement && presenter.on) setOn(false); };
  const observer = new MutationObserver(measure);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-large-text', 'data-presenter'] });
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', measure);
  document.addEventListener('fullscreenchange', onFullscreen);
  apply();
  return () => {
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', measure);
    document.removeEventListener('fullscreenchange', onFullscreen);
    observer.disconnect();
  };
}

measure();
