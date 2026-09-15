// Third-party licence notices for the single built file. The MIT and ISC licences of the libraries and data bundled
// into dist/geo-coordinates.html ask for their copyright and permission notice to go with every copy, so this Vite
// plugin writes them into the file itself, as an HTML comment right after the doctype. The packages are the ones
// whose modules actually end up in the bundle (found from the rendered chunks), so the list follows the code.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import type { Plugin } from 'vite';

export interface Notice { name: string; version: string; license: string; text: string; url?: string }

/** Data bundled without a package of its own: the map data world-atlas, the world borders (Poland point of view) and the Central Europe detail are made from. */
export const DATA_NOTICES: Notice[] = [{
  name: 'Natural Earth', version: 'map data', license: 'Public domain', url: 'https://www.naturalearthdata.com/',
  text: 'Made with Natural Earth. Free vector and raster map data @ naturalearthdata.com. Natural Earth data is in the public domain.',
}];

/** The package a bundled module belongs to (its innermost node_modules folder), or null for the project's own code. */
export function packageDir(moduleId: string): string | null {
  const id = moduleId.replace(/^\0/, '').split('?')[0]!;
  const marker = `${sep}node_modules${sep}`;
  const at = id.lastIndexOf(marker);
  if (at < 0) return null;
  const rest = id.slice(at + marker.length).split(sep);
  const name = rest[0]!.startsWith('@') ? rest.slice(0, 2) : rest.slice(0, 1);
  return join(id.slice(0, at + marker.length), ...name);
}

/** A package's notice: name, version and licence from package.json, and the text of its LICENSE file. */
export function readNotice(dir: string): Notice {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { name: string; version: string; license?: string; homepage?: string };
  const file = readdirSync(dir).find((f) => /^licen[cs]e(\.(md|txt))?$/i.test(f));
  const text = file ? readFileSync(join(dir, file), 'utf8').trim() : '';
  if (!text) throw new Error(`licence-notices: ${pkg.name} has no LICENSE file to copy`);
  return { name: pkg.name, version: pkg.version, license: pkg.license ?? 'see licence text', text, url: pkg.homepage };
}

/** The comment itself. `--` may not appear inside an HTML comment, so any run of dashes in a licence text is spaced out. */
export function noticeComment(notices: readonly Notice[]): string {
  const safe = (s: string) => s.replace(/-{2,}/g, (m) => m.split('').join(' ')).replace(/\r\n/g, '\n');
  const blocks = notices.map((n) => [`${n.name} ${n.version} (${n.license})${n.url ? ` ${n.url}` : ''}`, '', safe(n.text)].join('\n'));
  return `<!--\nThird-party licences\n\nThis page bundles the following libraries and data.\n\n${blocks.join('\n\n- - -\n\n')}\n-->`;
}

/** Puts the comment right after the doctype (or at the very start when there is none). */
export function injectNotices(html: string, comment: string): string {
  const doctype = /^\s*<!doctype html>\s*\n?/i.exec(html);
  return doctype ? `${doctype[0].trimEnd()}\n${comment}\n${html.slice(doctype[0].length)}` : `${comment}\n${html}`;
}

export function licenceNotices(): Plugin {
  const dirs = new Set<string>();
  return {
    name: 'licence-notices',
    apply: 'build',
    enforce: 'post',
    renderChunk(_code, chunk) {
      for (const id of chunk.moduleIds) {
        const dir = packageDir(id);
        if (dir && existsSync(join(dir, 'package.json'))) dirs.add(dir);
      }
      return null;
    },
    generateBundle(_options, bundle) {
      const notices = [...dirs].map(readNotice).sort((a, b) => a.name.localeCompare(b.name));
      const comment = noticeComment([...notices, ...DATA_NOTICES]);
      for (const file of Object.values(bundle)) {
        if (file.type === 'asset' && file.fileName.endsWith('.html')) file.source = injectNotices(String(file.source), comment);
      }
    },
  };
}
