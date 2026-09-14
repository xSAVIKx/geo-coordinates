// The site's icons and social card, drawn from the header logo (site-static/icon.svg) and the lesson's own palette:
//   site-static/apple-touch-icon.png     180×180  home-screen icon (iOS), also inlined into the built file
//   site-static/favicon-32.png           32×32    PNG favicon for browsers without SVG favicons, inlined
//   site-static/icon-192.png, icon-512.png        web app manifest icons
//   site-static/icon-maskable-512.png    512×512  manifest icon with the logo inside the maskable safe zone
//   site-static/og-image.png             1200×630 social card (Open Graph / Twitter): titles in EN/PL/UK and a globe
//                                                  with Katowice marked, drawn with d3-geo from world-atlas 110m
// PNGs are reduced to a 256-colour palette when python3 with Pillow is installed.
//
//   npm run brand
import { chromium } from '@playwright/test';
import { geoGraticule, geoOrthographic, geoPath } from 'd3-geo';
import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';

const OUT = resolve('site-static');
const svg = readFileSync(join(OUT, 'icon.svg'), 'utf8');
const PAPER = '#f5f3ec';
const INK = '#16202b';
const MUTED = '#4b5766';
const ACCENT = '#1759c9';
const WARM = '#e89a2c';
// Single quotes: the stack goes inside double-quoted style attributes.
const FONT = `Lato, 'DejaVu Sans', 'Liberation Sans', sans-serif`;

/** A square icon: the logo centred on `background`, filling `scale` of the side. */
function iconHtml(size: number, scale: number, background = PAPER): string {
  const logo = size * scale;
  return `<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${background}">
    <div style="width:${logo}px;height:${logo}px;line-height:0">${svg.replace('<svg ', `<svg width="${logo}" height="${logo}" `)}</div></body>`;
}

function globeSvg(size: number): string {
  const topo = JSON.parse(readFileSync('node_modules/world-atlas/land-110m.json', 'utf8')) as Topology;
  const land = feature(topo, topo.objects.land!);
  const r = size / 2 - 4;
  const projection = geoOrthographic().scale(r).translate([size / 2, size / 2]).rotate([-22, -24]).clipAngle(90);
  const path = geoPath(projection);
  const katowice: [number, number] = [19.02, 50.26];
  const [kx, ky] = projection(katowice)!;
  const equator = path({ type: 'LineString', coordinates: Array.from({ length: 361 }, (_, i) => [i - 180, 0]) });
  const prime = path({ type: 'LineString', coordinates: Array.from({ length: 181 }, (_, i) => [0, i - 90]) });
  const graticule = path(geoGraticule().step([15, 15])());
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs><radialGradient id="sea" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#e8f2f9"/><stop offset="1" stop-color="#9fc2dc"/></radialGradient></defs>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="url(#sea)"/>
    <path d="${path(land)}" fill="#f0e7cf" stroke="#a8966f" stroke-width="1"/>
    <path d="${graticule}" fill="none" stroke="#6d88a0" stroke-width="1" stroke-opacity=".45"/>
    <path d="${equator}" fill="none" stroke="#c2410c" stroke-width="3.5" stroke-dasharray="14 7"/>
    <path d="${prime}" fill="none" stroke="#6d28d9" stroke-width="3" stroke-dasharray="4 5"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${ACCENT}" stroke-width="4"/>
    <line x1="${kx}" y1="${ky}" x2="${kx + 70}" y2="${ky - 64}" stroke="${INK}" stroke-width="2"/>
    <circle cx="${kx}" cy="${ky}" r="10" fill="${WARM}" stroke="#fff" stroke-width="4"/>
    <g transform="translate(${kx + 70} ${ky - 64})">
      <rect x="0" y="-26" width="176" height="44" rx="10" fill="#fff" stroke="${INK}" stroke-width="2"/>
      <text x="88" y="4" text-anchor="middle" font-family="${FONT}" font-size="24" font-weight="700" fill="${INK}">50°N, 19°E</text>
    </g>
  </svg>`;
}

function ogHtml(): string {
  return `<body style="margin:0;width:1200px;height:630px;overflow:hidden;background:${PAPER};font-family:${FONT};color:${INK};position:relative">
    <div style="position:absolute;right:-40px;top:40px">${globeSvg(600)}</div>
    <div style="position:absolute;left:72px;top:60px;width:590px">
      <div style="display:flex;align-items:center;gap:18px">
        <div style="width:64px;height:64px">${svg.replace('<svg ', '<svg width="64" height="64" ')}</div>
        <div style="font-size:22px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${ACCENT}">Interactive geography lesson</div>
      </div>
      <div style="margin-top:30px;font-size:78px;line-height:1;font-weight:900;letter-spacing:-.02em">Coordinates on the globe</div>
      <div style="margin-top:24px;font-size:34px;line-height:1.35;color:${MUTED};font-weight:600">Współrzędne na kuli ziemskiej<br>Координати на земній кулі</div>
      <div style="margin-top:32px;display:flex;gap:10px;flex-wrap:wrap;font-size:21px;font-weight:700">
        ${['Latitude &amp; longitude', 'Day and night', 'Practice &amp; print'].map((c) => `<span style="padding:8px 16px;border-radius:999px;background:#e5edfb;color:${ACCENT}">${c}</span>`).join('')}
      </div>
    </div>
    <div style="position:absolute;left:72px;bottom:44px;font-size:22px;font-weight:700;color:${MUTED}">xsavikx.github.io/geo-coordinates · EN · PL · UK</div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:12px;background:linear-gradient(90deg,${ACCENT} 0 70%,${WARM} 70%)"></div>
  </body>`;
}

const JOBS = [
  { name: 'favicon-32.png', w: 32, h: 32, html: iconHtml(32, 1, 'transparent'), transparent: true },
  { name: 'apple-touch-icon.png', w: 180, h: 180, html: iconHtml(180, 0.8), transparent: false },
  { name: 'icon-192.png', w: 192, h: 192, html: iconHtml(192, 0.8), transparent: false },
  { name: 'icon-512.png', w: 512, h: 512, html: iconHtml(512, 0.8), transparent: false },
  { name: 'icon-maskable-512.png', w: 512, h: 512, html: iconHtml(512, 0.62), transparent: false },
  { name: 'og-image.png', w: 1200, h: 630, html: ogHtml(), transparent: false },
];

const browser = await chromium.launch();
const paths: string[] = [];
for (const job of JOBS) {
  const page = await browser.newPage({ viewport: { width: job.w, height: job.h }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"></head>${job.html}</html>`);
  await page.evaluate(() => document.fonts.ready);
  const path = join(OUT, job.name);
  await page.screenshot({ path, omitBackground: job.transparent });
  paths.push(path);
  await page.close();
}
await browser.close();

const QUANTIZE = `
import sys
from PIL import Image
for p in sys.argv[1:]:
    im = Image.open(p)
    if im.mode == 'RGBA' and im.getextrema()[3][0] < 255:
        im.save(p, optimize=True)
    else:
        im.convert('RGB').quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(p, optimize=True)
`;
const q = spawnSync('python3', ['-c', QUANTIZE, ...paths], { stdio: 'inherit' });
if (q.status !== 0) console.warn('Not quantized (needs python3 with Pillow): the PNGs are full-colour.');
for (const p of paths) console.log(`${p}: ${(statSync(p).size / 1024).toFixed(1)} KiB`);
