import { readString, writeString } from '../app/storage';

/*
 * The "Places up close" switch (Places up close spec §6): default on, saved per pupil. It is a *display* switch,
 * not a download switch — the photos and the street data are in the file either way — so turning it off leaves the
 * map exactly as it was before this feature and changes nothing about the page's size.
 *
 * Its own storage key, not a field of geo-coords:settings, for the same reason the map style has one: the settings
 * record is asserted exactly by tests/unit/storage.test.ts (planning ruling R9).
 */
export const CLOSE_UPS_KEY = 'geo-coords:close-ups';

/** A saved value: only the exact string 'off' turns the feature off, so a cleared or corrupted value is "on". */
export const parseCloseUps = (v: unknown): boolean => v !== 'off';

export const closeUpSetting = $state<{ on: boolean }>({ on: true });

export function initCloseUps(): void {
  closeUpSetting.on = parseCloseUps(readString(CLOSE_UPS_KEY));
}

export function setCloseUps(on: boolean): void {
  closeUpSetting.on = on;
  writeString(CLOSE_UPS_KEY, on ? 'on' : 'off');
}
