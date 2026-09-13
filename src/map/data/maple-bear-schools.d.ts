// The slim schools module served by scripts/schools-plugin.ts (Vite and Vitest).
declare module 'virtual:maple-bear-schools' {
  /** The date the listings were read (YYYY-MM-DD). */
  export const retrieved: string;
  /** [id, name, country (ISO 3166-1 alpha-2), lat, lon] */
  export const schools: [string, string, string, number, number][];
}
