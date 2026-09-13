import { readJSON, writeJSON } from './storage';

export type Theme = 'system' | 'light' | 'dark';
export interface Settings { theme: Theme; largeText: boolean; reducedMotion: boolean }

const KEY = 'geo-coords:settings';
export const settings = $state<Settings>({ theme: 'system', largeText: false, reducedMotion: false });

function systemReducedMotion(): boolean {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export function initSettings(): void {
  const s = readJSON<Partial<Settings>>(KEY, {});
  settings.theme = s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system';
  settings.largeText = s.largeText === true;
  settings.reducedMotion = typeof s.reducedMotion === 'boolean' ? s.reducedMotion : systemReducedMotion();
}

/**
 * What the app itself wrote to a root's theme attributes, and what was there before. A host page
 * (e.g. an embedding viewer) may stamp data-theme on <html> for its own theme choice; "system"
 * must leave that stamp alone, so only a value the app wrote is ever taken back.
 */
const appliedTheme = new WeakMap<HTMLElement, { theme: string; prevTheme: string | undefined; prevScheme: string }>();

export function applySettings(root: HTMLElement = document.documentElement): void {
  const applied = appliedTheme.get(root);
  if (settings.theme === 'system') {
    if (applied) {
      // Restore what was there before, unless someone else has changed it since.
      if (root.dataset.theme === applied.theme) {
        if (applied.prevTheme === undefined) delete root.dataset.theme; else root.dataset.theme = applied.prevTheme;
      }
      if (root.style.colorScheme === applied.theme) root.style.colorScheme = applied.prevScheme;
      appliedTheme.delete(root);
    }
  } else {
    appliedTheme.set(root, applied
      ? { ...applied, theme: settings.theme }
      : { theme: settings.theme, prevTheme: root.dataset.theme, prevScheme: root.style.colorScheme });
    root.dataset.theme = settings.theme; root.style.colorScheme = settings.theme;
  }
  root.dataset.largeText = String(settings.largeText);
  root.dataset.reducedMotion = String(settings.reducedMotion);
}

export function saveSettings(): void {
  writeJSON(KEY, $state.snapshot(settings));
}

export function motionReduced(): boolean {
  return settings.reducedMotion || systemReducedMotion();
}
