export const TEST_MODE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('test');

export function expose(name: string, value: unknown): void {
  if (TEST_MODE || import.meta.env.DEV) (window as unknown as Record<string, unknown>)[name] = value;
}
