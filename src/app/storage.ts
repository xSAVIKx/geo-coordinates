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
export function writeJSON(key: string, value: unknown): void {
  writeString(key, JSON.stringify(value));
}
