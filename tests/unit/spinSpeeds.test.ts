import { describe, expect, it } from 'vitest';
import { DEFAULT_SPIN_SPEED, SPIN_SPEEDS, minutesPerMs, speedFactor } from '../../src/map/spinSpeeds';

describe('spin speeds', () => {
  it('run from the real Earth to one day a second, slowest first', () => {
    expect(SPIN_SPEEDS.map(speedFactor)).toEqual([1, 1440, 7200, 28800, 86400]);
    const factors = SPIN_SPEEDS.map(speedFactor);
    expect([...factors].sort((a, b) => a - b)).toEqual(factors);
  });

  it('keep the original lab speed, a whole day in 12 seconds, as the default', () => {
    expect(SPIN_SPEEDS[DEFAULT_SPIN_SPEED]!.dayMs).toBe(12_000);
    expect(minutesPerMs(SPIN_SPEEDS[DEFAULT_SPIN_SPEED]!)).toBeCloseTo(0.12);
  });

  it('label each speed with the length of one day', () => {
    for (const s of SPIN_SPEEDS) {
      const ms = { hour: 3_600_000, minute: 60_000, second: 1_000 }[s.unit] * s.amount;
      expect(ms).toBe(s.dayMs);
    }
  });
});
