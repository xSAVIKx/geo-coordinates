// Icons for the single built file. They are written into the page as data: URIs, so the favicon and the home-screen
// icon work offline and never make the page ask the network for anything; the manifest icons and the social card
// are ordinary files published next to the page (site-static/, copied by the Pages workflow).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

export const ICONS_MARKER = '<!-- site-icons -->';

/** The <link> tags for the favicon (SVG, with a 32 px PNG fallback) and the Apple touch icon. */
export function iconLinks(dir: string): string {
  const svg = readFileSync(join(dir, 'icon.svg'), 'utf8').trim();
  const png = (name: string) => `data:image/png;base64,${readFileSync(join(dir, name)).toString('base64')}`;
  return [
    `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(svg)}" />`,
    `<link rel="icon" type="image/png" sizes="32x32" href="${png('favicon-32.png')}" />`,
    `<link rel="apple-touch-icon" sizes="180x180" href="${png('apple-touch-icon.png')}" />`,
  ].join('\n    ');
}

export function siteIcons(dir = 'site-static'): Plugin {
  return {
    name: 'site-icons',
    transformIndexHtml(html) {
      if (!html.includes(ICONS_MARKER)) throw new Error(`site-icons: ${ICONS_MARKER} missing from the page head`);
      return html.replace(ICONS_MARKER, iconLinks(dir));
    },
  };
}
