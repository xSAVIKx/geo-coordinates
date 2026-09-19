// A byte breakdown of dist/geo-coordinates.html for scripts/size-check.ts: each embedded texture, the app script
// (code plus the vector map data bundled into it), styles, and everything else.
export interface SizePart { name: string; bytes: number }

// Places up close spec §7: the single file stays under 8 MiB (textures, city photos and street data included).
// The single source of truth for the size budget — scripts/size-check.ts (a top-level programme that calls
// process.exit and so cannot itself be imported) and tests/e2e/routes.spec.ts both import this rather than
// hand-keeping their own copy of the number, which drifted twice before this module existed.
export const SIZE_LIMIT_BYTES = 8_388_608;

const bytes = (s: string) => Buffer.byteLength(s, 'utf8');

export function sizeBreakdown(html: string): SizePart[] {
  const parts: SizePart[] = [];
  const strip = (s: string, re: RegExp, name: (id: string) => string) =>
    s.replace(re, (m, id: string) => { parts.push({ name: name(id), bytes: bytes(m) }); return ''; });
  let rest = strip(html, /<script type="application\/x-geo-texture" id="geo-texture-([a-z-]+)"[^>]*>[^<]*<\/script>\n?/g, (id) => `texture ${id}`);
  rest = strip(rest, /<script type="application\/x-geo-photo" id="geo-photo-([a-z]+)"[^>]*>[^<]*<\/script>\n?/g, (id) => `photo ${id}`);
  rest = strip(rest, /<script type="application\/x-geo-city" id="geo-city-([a-z]+)"[^>]*>[^<]*<\/script>\n?/g, (id) => `streets ${id}`);
  let js = 0;
  rest = rest.replace(/<script type="module"[^>]*>[\s\S]*?<\/script>/g, (m) => { js += bytes(m); return ''; });
  let css = 0;
  rest = rest.replace(/<style[^>]*>[\s\S]*?<\/style>/g, (m) => { css += bytes(m); return ''; });
  parts.push({ name: 'app script and vector data', bytes: js }, { name: 'styles', bytes: css }, { name: 'html and head', bytes: bytes(rest) });
  return parts;
}

export function formatBreakdown(parts: SizePart[], total: number): string {
  const kib = (n: number) => `${(n / 1024).toFixed(1)} KiB`;
  const width = Math.max(...parts.map((p) => p.name.length));
  return [...parts.map((p) => `  ${p.name.padEnd(width)}  ${kib(p.bytes).padStart(10)}  ${((p.bytes / total) * 100).toFixed(1).padStart(5)} %`), `  ${'total'.padEnd(width)}  ${kib(total).padStart(10)}`].join('\n');
}
