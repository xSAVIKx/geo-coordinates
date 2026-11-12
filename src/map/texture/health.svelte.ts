import type { TextureStyle } from '../mapStyle';
import { INITIAL_HEALTH, nextHealth, type HealthEvent, type RenderHealth } from './fallback';

/**
 * The page session's render health, shared by every map view: the fallback tier, which texture styles have their
 * images decoded, and which style is decoding now (the "Loading map…" status).
 */
export const renderHealth = $state<{
  state: RenderHealth; ready: Record<TextureStyle, boolean>; loading: TextureStyle | null;
  /** A data file for the map could not be downloaded (MapStyleNote.svelte says so). The tier does not change. */
  downloadFailed: boolean;
  /** Bumped by "Try again": the texture layers download again what they still need. */
  attempt: number;
}>({
  state: INITIAL_HEALTH, ready: { physical: false, satellite: false }, loading: null, downloadFailed: false, attempt: 0,
});

/** "Try again" after a failed download. */
export function retryDownloads(): void {
  renderHealth.downloadFailed = false;
  renderHealth.attempt++;
}

export function reportHealth(e: HealthEvent): void {
  const next = nextHealth(renderHealth.state, e);
  if (next !== renderHealth.state) renderHealth.state = next;
}

export function markReady(style: TextureStyle): void {
  if (!renderHealth.ready[style]) renderHealth.ready[style] = true;
}

/** Tests only. */
export function resetHealth(): void {
  renderHealth.state = INITIAL_HEALTH;
  renderHealth.ready = { physical: false, satellite: false };
  renderHealth.loading = null;
  renderHealth.downloadFailed = false;
  renderHealth.attempt = 0;
}
