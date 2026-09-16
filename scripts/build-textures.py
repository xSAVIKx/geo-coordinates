#!/usr/bin/env python3
"""Builds the map-style textures in src/map/data/textures/ (Map styles spec §3).

Sources (public domain):
  Natural Earth "Cross Blended Hypso with Shaded Relief and Water", HYP_50M_SR_W, version 2.0.0
    https://naciscdn.org/naturalearth/50m/raster/HYP_50M_SR_W.zip             10800 x 5400, 30 px per degree
  NASA Earth Observatory, Blue Marble Next Generation, July 2004 (world.topo.bathy.200407)
    https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73751/world.topo.bathy.200407.3x5400x2700.jpg
    https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73751/world.topo.bathy.200407.3x21600x10800.jpg (60 px/deg)
  NASA Earth Observatory, Black Marble 2016 (3 km)
    https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg
  (If a NASA URL has moved, find the record on https://visibleearth.nasa.gov/ by the file name.)

Usage:
  python3 scripts/build-textures.py [raw-dir] [--download]        (npm run data:textures)
Needs Python 3.10+ and Pillow 10+ with WebP support. No numpy. raw-dir defaults to .cache/textures (git-ignored,
~330 MB); --download fetches missing files. The outputs are committed; `npm run build` never runs this script.

Outputs (equirectangular, north up; WebP quality 80, method 6):
  physical-world    4096 x 2048  HYP_50M_SR_W, Lanczos
  physical-region    720 x  420  HYP_50M_SR_W cropped to REGION at its native 30 px/deg
  satellite-day     4096 x 2048  world.topo.bathy 5400 x 2700, Lanczos
  satellite-region  1440 x  840  world.topo.bathy 21600 x 10800 cropped to REGION at its native 60 px/deg
  satellite-night   4096 x 2048  BlackMarble_2016_3km, Lanczos
and manifest.json (sizes, bounds, sources, bytes), read by the page (src/map/texture/assets.ts) and the tests.
"""
import json
import os
import sys
import urllib.request
import zipfile

from PIL import Image, features

Image.MAX_IMAGE_PIXELS = None

OUT = os.path.join('src', 'map', 'data', 'textures')
REGION_JSON = os.path.join('src', 'map', 'data', 'central-europe.json')
WORLD = [-180, -90, 180, 90]

HYP = 'HYP_50M_SR_W.tif'
BM_SMALL = 'world.topo.bathy.200407.3x5400x2700.jpg'
BM_LARGE = 'world.topo.bathy.200407.3x21600x10800.jpg'
NIGHT = 'BlackMarble_2016_3km.jpg'
URLS = {
    'HYP_50M_SR_W.zip': 'https://naciscdn.org/naturalearth/50m/raster/HYP_50M_SR_W.zip',
    BM_SMALL: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73751/' + BM_SMALL,
    BM_LARGE: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73751/' + BM_LARGE,
    NIGHT: 'https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/' + NIGHT,
}
NE_CREDIT = 'Natural Earth HYP_50M_SR_W 2.0.0 (public domain), https://www.naturalearthdata.com/'
BM_CREDIT = 'NASA Earth Observatory, Blue Marble Next Generation, July 2004 (public domain), https://earthobservatory.nasa.gov/'
NIGHT_CREDIT = 'NASA Earth Observatory, Black Marble 2016 (public domain), https://earthobservatory.nasa.gov/'


def ensure(raw, name, download):
    path = os.path.join(raw, name)
    if os.path.exists(path):
        return path
    if name == HYP:
        zpath = ensure(raw, 'HYP_50M_SR_W.zip', download)
        with zipfile.ZipFile(zpath) as z:
            member = next(m for m in z.namelist() if m.endswith('HYP_50M_SR_W.tif'))
            with z.open(member) as src, open(path, 'wb') as dst:
                dst.write(src.read())
        return path
    if not download:
        sys.exit(f'Missing {path} (run with --download or fetch {URLS[name]})')
    print(f'Downloading {URLS[name]} ...', flush=True)
    urllib.request.urlretrieve(URLS[name], path)
    return path


def region_box():
    with open(REGION_JSON, encoding='utf-8') as f:
        r = json.load(f)['region']
    return [r['west'], r['south'], r['east'], r['north']]


def crop(im, px_per_deg, box):
    """The part of a whole-world equirectangular image inside box (west, south, east, north), at its own resolution."""
    if im.width != 360 * px_per_deg or im.height != 180 * px_per_deg:
        sys.exit(f'Expected a {360 * px_per_deg} x {180 * px_per_deg} source, got {im.size}')
    w, s, e, n = box
    return im.crop(((w + 180) * px_per_deg, (90 - n) * px_per_deg, (e + 180) * px_per_deg, (90 - s) * px_per_deg))


def world(im, width=4096):
    return im.resize((width, width // 2), Image.LANCZOS)


def save(textures, tid, im, bounds, source):
    file = f'{tid}.webp'
    path = os.path.join(OUT, file)
    im.convert('RGB').save(path, 'WEBP', quality=80, method=6)
    size = os.path.getsize(path)
    textures[tid] = {'file': file, 'width': im.width, 'height': im.height, 'bounds': bounds, 'source': source,
                     'bytes': size, 'mime': 'image/webp'}
    print(f'{path}: {im.width} x {im.height}, {size / 1024:.1f} KiB', flush=True)


def main():
    args = sys.argv[1:]
    download = '--download' in args
    raw = next((a for a in args if not a.startswith('--')), os.path.join('.cache', 'textures'))
    if not features.check('webp'):
        sys.exit('Pillow was built without WebP support')
    os.makedirs(raw, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    box = region_box()
    textures = {}

    hyp = Image.open(ensure(raw, HYP, download)).convert('RGB')
    save(textures, 'physical-world', world(hyp), WORLD, NE_CREDIT)
    save(textures, 'physical-region', crop(hyp, 30, box), box, f'{NE_CREDIT}; native 30 px/deg crop')
    del hyp

    day = Image.open(ensure(raw, BM_SMALL, download)).convert('RGB')
    save(textures, 'satellite-day', world(day), WORLD, f'{BM_CREDIT}; 5400 x 2700 source')
    del day
    large = Image.open(ensure(raw, BM_LARGE, download)).convert('RGB')
    save(textures, 'satellite-region', crop(large, 60, box), box, f'{BM_CREDIT}; 21600 x 10800 source, native 60 px/deg crop')
    del large

    night = Image.open(ensure(raw, NIGHT, download)).convert('RGB')
    save(textures, 'satellite-night', world(night), WORLD, f'{NIGHT_CREDIT}; 13500 x 6750 source')
    del night

    manifest = {'generatedBy': 'scripts/build-textures.py', 'textures': textures}
    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=2)
        f.write('\n')
    total = sum(t['bytes'] for t in textures.values())
    print(f'total {total / 1024:.1f} KiB ({total * 4 / 3 / 1024:.1f} KiB as base64)')


if __name__ == '__main__':
    main()
