export function readString(key: string): string | null {
  try { return globalThis.localStorage?.getItem(key) ?? null; } catch { return null; }
}
export function writeString(key: string, value: string): void {
  try { globalThis.localStorage?.setItem(key, value); } catch { /* storage unavailable */ }
}
export function readJSON<T>(key: string, fallback: T): T {
  const raw = readString(key);
  if (raw === null) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}
/**
 * A stored JSON object, or `{}` for anything else. Storage can hold anything (cleared or corrupted data, a value an
 * older version wrote): JSON that parses fine but is not a plain object (null, an array, a string…) would throw on
 * property access, so callers still check each field they read.
 */
export function readRecord(key: string): Record<string, unknown> {
  const value = readJSON<unknown>(key, null);
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}
export function writeJSON(key: string, value: unknown): void {
  writeString(key, JSON.stringify(value));
}
