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

export function applySettings(root: HTMLElement = document.documentElement): void {
  if (settings.theme === 'system') { delete root.dataset.theme; root.style.colorScheme = ''; }
  else { root.dataset.theme = settings.theme; root.style.colorScheme = settings.theme; }
  root.dataset.largeText = String(settings.largeText);
  root.dataset.reducedMotion = String(settings.reducedMotion);
}

export function saveSettings(): void {
  writeJSON(KEY, $state.snapshot(settings));
}

export function motionReduced(): boolean {
  return settings.reducedMotion || systemReducedMotion();
}
