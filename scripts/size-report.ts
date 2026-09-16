// A byte breakdown of dist/geo-coordinates.html for scripts/size-check.ts: each embedded texture, the app script
// (code plus the vector map data bundled into it), styles, and everything else.
export interface SizePart { name: string; bytes: number }

const bytes = (s: string) => Buffer.byteLength(s, 'utf8');

export function sizeBreakdown(html: string): SizePart[] {
  const parts: SizePart[] = [];
  let rest = html.replace(/<script type="application\/x-geo-texture" id="geo-texture-([a-z-]+)"[^>]*>[^<]*<\/script>\n?/g, (m, id: string) => {
    parts.push({ name: `texture ${id}`, bytes: bytes(m) });
    return '';
  });
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
