import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { announce, ANNOUNCE_CLEAR_MS, liveRegion } from '../../src/app/announcer.svelte';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test('an announcement is read, then leaves its live region, so it is not found later out of context', () => {
  announce('Not quite', 'assertive');
  expect(liveRegion.assertive).toBe('');
  vi.advanceTimersByTime(30);
  expect(liveRegion.assertive).toBe('Not quite');
  vi.advanceTimersByTime(ANNOUNCE_CLEAR_MS - 100);
  expect(liveRegion.assertive).toBe('Not quite');
  vi.advanceTimersByTime(200);
  expect(liveRegion.assertive).toBe('');
});

test('a newer message is not cleared by the older one\'s timer', () => {
  announce('51 degrees north, 19 degrees east');
  vi.advanceTimersByTime(ANNOUNCE_CLEAR_MS - 1000);
  announce('52 degrees north, 19 degrees east');
  vi.advanceTimersByTime(1500);
  expect(liveRegion.polite).toBe('52 degrees north, 19 degrees east');
  vi.advanceTimersByTime(ANNOUNCE_CLEAR_MS);
  expect(liveRegion.polite).toBe('');
});
