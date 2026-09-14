export const liveRegion = $state({ polite: '', assertive: '' });

const lastAt = new Map<string, number>();
const pending = new Map<string, ReturnType<typeof setTimeout>>();

const clearTimers: Record<'polite' | 'assertive', ReturnType<typeof setTimeout> | undefined> = { polite: undefined, assertive: undefined };
/** How long a message stays in its live region: long enough to be read out, short enough not to be found later, out of context, at the end of the page. */
export const ANNOUNCE_CLEAR_MS = 8000;

export function announce(message: string, politeness: 'polite' | 'assertive' = 'polite'): void {
  liveRegion[politeness] = '';
  clearTimeout(clearTimers[politeness]);
  setTimeout(() => {
    liveRegion[politeness] = message;
    clearTimers[politeness] = setTimeout(() => { if (liveRegion[politeness] === message) liveRegion[politeness] = ''; }, ANNOUNCE_CLEAR_MS);
  }, 30);
}

export function announceThrottled(channel: string, message: string, intervalMs = 500): void {
  const now = Date.now();
  const prev = lastAt.get(channel) ?? 0;
  clearTimeout(pending.get(channel));
  if (now - prev >= intervalMs) { lastAt.set(channel, now); announce(message); return; }
  pending.set(channel, setTimeout(() => { lastAt.set(channel, Date.now()); announce(message); }, intervalMs - (now - prev)));
}
