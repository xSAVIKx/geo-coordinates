import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ICONS_MARKER, iconLinks } from '../../scripts/site-head';
import { manifestHref } from '../../src/app/siteManifest';

const CANONICAL = 'https://xsavikx.github.io/geo-coordinates/';
const html = readFileSync('geo-coordinates.html', 'utf8');
const meta = (attr: 'name' | 'property', key: string): string[] =>
  [...html.matchAll(new RegExp(`<meta ${attr}="${key}"(?: media="[^"]*")? content="([^"]*)"`, 'g'))].map((m) => m[1]!);

/** Width and height from a PNG's IHDR chunk. */
function pngSize(path: string): [number, number] {
  const b = readFileSync(path);
  expect(b.subarray(1, 4).toString('latin1')).toBe('PNG');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('page head', () => {
  it('has a title, a search description of at most 160 characters and a canonical URL', () => {
    expect(html).toMatch(/<title>[^<]{10,}<\/title>/);
    const [description] = meta('name', 'description');
    expect(description!.length).toBeGreaterThan(50);
    expect(description!.length).toBeLessThanOrEqual(160);
    expect(html).toContain(`<link rel="canonical" href="${CANONICAL}" />`);
  });

  it('has an Open Graph and Twitter card whose image is the 1200×630 published card', () => {
    for (const key of ['og:type', 'og:site_name', 'og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt', 'og:locale']) {
      expect(meta('property', key), key).toHaveLength(1);
    }
    expect(meta('property', 'og:url')).toEqual([CANONICAL]);
    expect(meta('property', 'og:locale:alternate')).toEqual(['pl_PL', 'uk_UA']);
    expect(meta('name', 'twitter:card')).toEqual(['summary_large_image']);
    const image = meta('property', 'og:image')[0]!;
    expect(meta('name', 'twitter:image')).toEqual([image]);
    expect(image.startsWith(CANONICAL)).toBe(true);
    const file = `site-static/${image.slice(CANONICAL.length)}`;
    expect(pngSize(file)).toEqual([1200, 630]);
    expect(meta('property', 'og:image:width')).toEqual(['1200']);
    expect(meta('property', 'og:image:height')).toEqual(['630']);
  });

  it('has theme colours for light and dark', () => {
    expect(meta('name', 'theme-color')).toEqual(['#f5f3ec', '#0e131a']);
  });

  it('has valid LearningResource structured data in all three languages', () => {
    const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]!;
    const data = JSON.parse(json) as Record<string, unknown>;
    expect(data['@type']).toBe('LearningResource');
    expect(data.url).toBe(CANONICAL);
    expect(data.inLanguage).toEqual(['en', 'pl', 'uk']);
  });

  it('marks where the build writes the icons', () => {
    expect(html).toContain(ICONS_MARKER);
  });
});

describe('icons', () => {
  it('inlines an SVG favicon, a 32 px PNG favicon and a 180 px Apple touch icon as data URIs', () => {
    const links = iconLinks('site-static');
    expect(links).toMatch(/<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,%3Csvg/);
    const pngs = [...links.matchAll(/sizes="(\d+)x\1" href="data:image\/png;base64,([^"]+)"/g)];
    expect(pngs.map((m) => m[1])).toEqual(['32', '180']);
    for (const [, size, data] of pngs) {
      const b = Buffer.from(data!, 'base64');
      expect([b.readUInt32BE(16), b.readUInt32BE(20)]).toEqual([Number(size), Number(size)]);
    }
    expect(links.length).toBeLessThan(16_000);
  });

  it('has a web app manifest whose icons exist at their stated sizes', () => {
    const manifest = JSON.parse(readFileSync('site-static/site.webmanifest', 'utf8')) as { icons: { src: string; sizes: string; purpose?: string }[]; start_url: string };
    expect(manifest.start_url).toBe('./');
    for (const icon of manifest.icons) {
      expect(existsSync(`site-static/${icon.src}`), icon.src).toBe(true);
      if (icon.sizes !== 'any') {
        const [w, h] = icon.sizes.split('x').map(Number);
        expect(pngSize(`site-static/${icon.src}`)).toEqual([w, h]);
      }
    }
    expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });

  it('is published by the Pages workflow', () => {
    expect(readFileSync('.github/workflows/pages.yml', 'utf8')).toContain('cp site-static/* site/');
  });
});

describe('manifestHref', () => {
  it('links the manifest only on the canonical page', () => {
    const manifest = `${CANONICAL}site.webmanifest`;
    expect(manifestHref(CANONICAL, CANONICAL)).toBe(manifest);
    expect(manifestHref(CANONICAL, `${CANONICAL}#pl/topic-3/explore/2`)).toBe(manifest);
    expect(manifestHref(CANONICAL, `${CANONICAL}index.html?test#en/`)).toBe(manifest);
    expect(manifestHref(CANONICAL, 'file:///home/me/geo-coordinates.html#en/')).toBeNull();
    expect(manifestHref(CANONICAL, 'https://example.org/copy/#en/')).toBeNull();
    expect(manifestHref(null, CANONICAL)).toBeNull();
  });
});
