export const TEST_MODE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');

export function expose(name: string, value: unknown): void {
  if (TEST_MODE || import.meta.env.DEV) (window as unknown as Record<string, unknown>)[name] = value;
}

/** A `?test` page's switch such as `gl=off` (see src/map/texture/): null outside test mode, so real users never hit one. */
export function testFlag(name: string): string | null {
  return TEST_MODE ? new URLSearchParams(location.search).get(name) : null;
}
