// The GitHub Pages site, made from the single built file.
//
// dist/geo-coordinates.html stays the one offline file: every map texture, city photo and city street block is
// inside it as base64 (scripts/textures-plugin.ts, scripts/city-plugin.ts). The hosted page does not need that.
// About 5 MiB of the 6.7 MiB file is those blocks, and a visitor must download all of it before the lesson shows,
// although most visitors never open a texture style or a close-up. So this script takes each block out of the page,
// writes its bytes to data/<block id>-<hash>.<ext> next to the page, and leaves the block empty with a `data-src`
// that names the file. src/map/texture/dataBlock.ts reads either form. The hash in the name changes when the bytes
// change, so a browser never keeps an old copy of a file under a name that a new page uses.
//
// The app script moves out too, to app-<hash>.js. The browser compiles an inline script on the main thread while
// the page cannot respond; it compiles a script file off the main thread while it downloads, and it can cache
// the compiled code for the next visit. The script is the same text in both places.
//
// Usage: node --experimental-strip-types scripts/build-site.ts [out-dir]   (default: site)
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface SiteFile { path: string; bytes: Buffer }

const EXT: Record<string, string> = { 'application/x-geo-texture': 'webp', 'application/x-geo-photo': 'webp', 'application/x-geo-city': 'bin' };
const BLOCK = /<script type="(application\/x-geo-(?:texture|photo|city))" id="([a-z0-9-]+)"([^>]*)>([A-Za-z0-9+/=\s]*)<\/script>/g;

const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex').slice(0, 10);

/** The page with every data block emptied and pointed at its own file, and the files themselves. */
export function splitDataBlocks(html: string): { html: string; files: SiteFile[] } {
  const files: SiteFile[] = [];
  const out = html.replace(BLOCK, (_m, type: string, id: string, attrs: string, b64: string) => {
    const bytes = Buffer.from(b64.replace(/\s+/g, ''), 'base64');
    const path = `data/${id}-${hash(bytes)}.${EXT[type]}`;
    files.push({ path, bytes });
    return `<script type="${type}" id="${id}"${attrs} data-src="${path}"></script>`;
  });
  return { html: out, files };
}

const APP = /<script type="module">([\s\S]*?)<\/script>/;

/** The page with its one inline app script moved to its own file, and that file. */
export function splitAppScript(html: string): { html: string; file: SiteFile } {
  const m = APP.exec(html);
  if (!m) throw new Error('build-site: no inline app script found in the page');
  const bytes = Buffer.from(m[1]!, 'utf8');
  const path = `app-${hash(bytes)}.js`;
  return { html: html.replace(APP, () => `<script type="module" src="${path}"></script>`), file: { path, bytes } };
}

/** Everything the hosted page needs: the page itself and the files it links. */
export function splitPage(html: string): { html: string; files: SiteFile[] } {
  const data = splitDataBlocks(html);
  const app = splitAppScript(data.html);
  return { html: app.html, files: [app.file, ...data.files] };
}

function main(outDir: string): void {
  const html = readFileSync('dist/geo-coordinates.html', 'utf8');
  const { html: page, files } = splitPage(html);
  if (files.length < 2) throw new Error('build-site: no data blocks found in dist/geo-coordinates.html');
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, 'data'), { recursive: true });
  writeFileSync(join(outDir, 'index.html'), page);
  for (const f of files) writeFileSync(join(outDir, f.path), f.bytes);
  copyFileSync('dist/translation-review.html', join(outDir, 'translation-review.html'));
  // Icons, the web app manifest, the social card, the sitemap and anything else in site-static/.
  for (const name of readdirSync('site-static')) copyFileSync(join('site-static', name), join(outDir, name));
  const kib = (n: number) => `${(n / 1024).toFixed(1)} KiB`;
  console.log(`${outDir}/index.html: ${kib(Buffer.byteLength(page))} (the offline file is ${kib(Buffer.byteLength(html))})`);
  console.log(`${outDir}/${files[0]!.path}: ${kib(files[0]!.bytes.length)}`);
  const data = files.slice(1);
  console.log(`${outDir}/data: ${data.length} files, ${kib(data.reduce((s, f) => s + f.bytes.length, 0))}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv[2] ?? 'site');
