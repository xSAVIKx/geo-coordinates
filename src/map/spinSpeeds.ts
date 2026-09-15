// How fast "Spin the Earth" runs, as the real time one simulated day (one turn) takes. 12 s is the lab's original
// speed; the first option is the real Earth, which turns 15° an hour and so barely moves on screen.
const DAY_MS = 86_400_000;

export interface SpinSpeed { dayMs: number; unit: 'hour' | 'minute' | 'second'; amount: number }

export const SPIN_SPEEDS: readonly SpinSpeed[] = [
  { dayMs: DAY_MS, unit: 'hour', amount: 24 },
  { dayMs: 60_000, unit: 'minute', amount: 1 },
  { dayMs: 12_000, unit: 'second', amount: 12 },
  { dayMs: 3_000, unit: 'second', amount: 3 },
  { dayMs: 1_000, unit: 'second', amount: 1 },
];
export const DEFAULT_SPIN_SPEED = 2;

/** Simulated minutes per real millisecond. */
export const minutesPerMs = (s: SpinSpeed): number => 1440 / s.dayMs;
/** How many times faster than the real Earth. */
export const speedFactor = (s: SpinSpeed): number => DAY_MS / s.dayMs;
