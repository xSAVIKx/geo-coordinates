export const liveRegion = $state({ polite: '', assertive: '' });

const lastAt = new Map<string, number>();
const pending = new Map<string, ReturnType<typeof setTimeout>>();

export function announce(message: string, politeness: 'polite' | 'assertive' = 'polite'): void {
  liveRegion[politeness] = '';
  setTimeout(() => { liveRegion[politeness] = message; }, 30);
}

export function announceThrottled(channel: string, message: string, intervalMs = 500): void {
  const now = Date.now();
  const prev = lastAt.get(channel) ?? 0;
  clearTimeout(pending.get(channel));
  if (now - prev >= intervalMs) { lastAt.set(channel, now); announce(message); return; }
  pending.set(channel, setTimeout(() => { lastAt.set(channel, Date.now()); announce(message); }, intervalMs - (now - prev)));
}
