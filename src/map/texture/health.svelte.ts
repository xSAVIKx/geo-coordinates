import type { TextureStyle } from '../mapStyle';
import { INITIAL_HEALTH, nextHealth, type HealthEvent, type RenderHealth } from './fallback';

/**
 * The page session's render health, shared by every map view: the fallback tier, which texture styles have their
 * images decoded, and which style is decoding now (the "Loading map…" status).
 */
export const renderHealth = $state<{ state: RenderHealth; ready: Record<TextureStyle, boolean>; loading: TextureStyle | null }>({
  state: INITIAL_HEALTH, ready: { physical: false, satellite: false }, loading: null,
});

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
}
