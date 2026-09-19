#!/usr/bin/env python3
"""Builds the twelve city close-up photos in src/map/data/city/photos/ (Places up close spec §4).

Each box uses the best open source that covers it (planning ruling R4); src/map/data/city/boxes.json says which.
Every photo comes out equirectangular in the box's own lon/lat frame, north up, 3:2, at the size boxes.json fixes.

  gugik     GUGiK ORTOFOTOMAPA, Poland. WMTS, LAYER=ORTOFOTOMAPA, TILEMATRIXSET=EPSG:3857.
            Capabilities: AccessConstraints "brak ograniczen"; Fees points at the Geoportal regulations.
            Credit: "Ortofotomapa: Glowny Urzad Geodezji i Kartografii, geoportal.gov.pl"
  ign       IGN BD ORTHO, France, via data.geopf.fr. WMTS, LAYER=ORTHOIMAGERY.ORTHOPHOTOS, TILEMATRIXSET=PM.
            Credit: "Orthophotos: (c) IGN / Geoplateforme (data.geopf.fr), Licence Ouverte Etalab 2.0"
  gsi       GSI seamlessphoto, Japan. XYZ tiles. Processed tiles must say so. Ruling R20 keeps the formula in
            the language the service publishes it in, so the credit carries the Japanese half first.
            Credit: "<kuchu shashin>: <Kokudo Chiriin seamless kuchu shashin (kako)> / Aerial photo: Geospatial
            Information Authority of Japan, seamlessphoto tiles (processed)" (the real line is in SOURCES below)
  naip      USGS / USDA NAIP, United States. ArcGIS ImageServer exportImage, already in EPSG:4326. Public domain.
            Credit: "Aerial photo: USDA-FSA National Agriculture Imagery Program (NAIP), via USGS (public domain)"
  sentinel  Copernicus Sentinel-2 L2A via the Earth Search STAC API on AWS; the "visual" (TCI) COG at 10 m.
            Credit, verbatim and in English everywhere: "Contains modified Copernicus Sentinel data <years>"

Usage:
  python3 scripts/build-city-photos.py [--only <id>,<id>] [--refresh]     (npm run data:city-photos)
Needs Python 3.10+ and Pillow with WebP. No numpy, no rasterio, no GDAL. Raw JSON answers are cached under
.cache/city/ (git-ignored); --refresh ignores the cache. The outputs are committed; `npm run build` never runs this.
"""
import io
import json
import math
import os
import sys
import urllib.request

from PIL import Image

from cog import Cog, utm_forward, utm_from_epsg
from tiles import UA, fetch, mosaic, to_equirect, zoom_for

BOXES = os.path.join('src', 'map', 'data', 'city', 'boxes.json')
OUT = os.path.join('src', 'map', 'data', 'city', 'photos')
CACHE = os.path.join('.cache', 'city')
STAC = 'https://earth-search.aws.element84.com/v1/search'
SENTINEL_WINDOW = ('2024-09-01T00:00:00Z', '2026-09-19T00:00:00Z')
# How many clearest scenes to consider per box, and how much of the box a scene may leave as nodata before the
# next candidate is tried instead (see build_sentinel).
STAC_CANDIDATES = 12
MAX_NODATA = 0.002
# eo:cloud_cover is the whole 110 km granule's figure, not the 6 x 4 km box's. Under 5 % is what every box gets
# where it exists; Mitad del Mundo, in the Andes above Quito, has never had a Sentinel-2 granule that clear
# (7.03 % is the record since 2018), so the ceiling is raised one step at a time rather than the box being
# dropped or the number being massaged. Whatever is used goes into the manifest as it stands.
CLOUD_CEILINGS = (5, 15, 40)
# The scene a box takes instead of the clearest one, and why. Cloud cover says nothing about snow or about the
# sun's height, and both of those decide whether a pupil can read the picture. All three figures below were
# checked against the rendered box, not guessed; each of these scenes covers its box completely.
SCENE_OVERRIDES = {
    # Every granule over Rovaniemi clearer than this one is a spring scene with the forest still half white,
    # where the Arctic Circle site, the airport and the roads all vanish into the snow (7 % of the box white,
    # against 0.1 % here). 0.22 % granule cloud, 11 September 2025.
    'rovaniemi': 'S2A_35WMP_20250911_0_L2A',
    # The clearest Sydney granule is a midwinter one with the sun 27° up, and the CBD's towers lay a black bar
    # across Darling Harbour and the Quay. This one is 0.001 percentage points cloudier and the sun is 46° up,
    # so the bridge, the Opera House point and the Botanic Garden all read. 15 September 2025.
    'sydney': 'S2B_56HLH_20250915_0_L2A',
    # The box exists for the pyramids, and under a September sun 61 degrees up they were not in it: limestone and
    # desert sand are the same brightness from above, the box read 204/255 mean with its 99th percentile at 254,
    # and the two large pyramids were barely separable from the plateau they stand on. This scene is January,
    # with the sun 33.8 degrees up, so each pyramid lays a shadow the length of itself across the sand and the
    # shape a pupil came to see is the thing that reads. 0.002 % granule cloud, 2 January 2025.
    'giza': 'S2A_36RUU_20250102_0_L2A',
}
# A tile mosaic is fetched at about twice the output resolution (tiles.zoom_for) and resampled onto the box's
# lon/lat grid at twice the output size, then reduced with Lanczos: a box filter over the extra detail instead of
# point-sampling it, which is what keeps the committed photo genuinely resolved and free of aliasing speckle.
SUPERSAMPLE = 2

SOURCES = {
    'gugik': {
        'name': 'GUGiK ORTOFOTOMAPA (geoportal.gov.pl)',
        'licence': 'Ortofotomapa: Główny Urząd Geodezji i Kartografii, geoportal.gov.pl',
        'template': ('https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMTS/StandardResolution'
                     '?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTOFOTOMAPA&STYLE=default'
                     '&FORMAT=image/jpeg&TILEMATRIXSET=EPSG:3857&TILEMATRIX=EPSG:3857:{z}&TILEROW={y}&TILECOL={x}'),
        'max_zoom': 18,
    },
    'ign': {
        'name': 'IGN BD ORTHO (data.geopf.fr)',
        'licence': 'Orthophotos: © IGN / Géoplateforme (data.geopf.fr), Licence Ouverte Etalab 2.0',
        'template': ('https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0'
                     '&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg'
                     '&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'),
        'max_zoom': 19,
    },
    'gsi': {
        'name': 'GSI seamlessphoto (cyberjapandata.gsi.go.jp)',
        'licence': '空中写真: 国土地理院シームレス空中写真（加工）/ Aerial photo: Geospatial Information Authority of Japan, seamlessphoto tiles (processed)',
        'template': 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
        'max_zoom': 18,
    },
    'naip': {
        'name': 'USDA-FSA NAIP via USGS (imagery.nationalmap.gov)',
        'licence': 'Aerial photo: USDA-FSA National Agriculture Imagery Program (NAIP), via USGS (public domain)',
        'max_zoom': None,
    },
    'sentinel': {
        'name': 'Copernicus Sentinel-2 L2A (Earth Search on AWS)',
        'licence': 'Contains modified Copernicus Sentinel data {years}',
        'max_zoom': None,
    },
}


def cached_json(name, make, refresh):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if os.path.exists(path) and not refresh:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    value = make()
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(value, f)
    return value


def stac_search(box, ceiling, refresh):
    """Recent Sentinel-2 L2A scenes over the box, clearest first (spec §4 "picks the clearest recent scene")."""
    body = json.dumps({
        'collections': ['sentinel-2-l2a'],
        'bbox': [box['west'], box['south'], box['east'], box['north']],
        'datetime': f'{SENTINEL_WINDOW[0]}/{SENTINEL_WINDOW[1]}',
        'query': {'eo:cloud_cover': {'lt': ceiling}},
        'sortby': [{'field': 'properties.eo:cloud_cover', 'direction': 'asc'}],
        'limit': STAC_CANDIDATES,
    }).encode()

    def call():
        req = urllib.request.Request(STAC, data=body,
                                     headers={'Content-Type': 'application/json', 'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.load(r)

    found = cached_json(f'stac-{box["id"]}-{ceiling}.json', call, refresh)
    return found.get('features') or []


def stac_candidates(box, refresh):
    """Candidate scenes, clearest first; the cloud ceiling is raised a step only once the clearer ones run out."""
    want = SCENE_OVERRIDES.get(box['id'])
    seen = set()
    for ceiling in CLOUD_CEILINGS:
        for f in stac_search(box, ceiling, refresh):
            # A few older items point "visual" at the JPEG 2000 original on the requester-pays s3://sentinel-s2-l2a
            # bucket instead of the public COG. Only the COG can be range-read, so those candidates are passed over.
            if f['id'] in seen or not f['assets']['visual']['href'].startswith('https://'):
                continue
            if want and f['id'] != want:
                continue
            seen.add(f['id'])
            yield f


def sentinel_window(box, cog, zone, northern):
    """The scene pixels the box needs, with two pixels of margin for the bilinear sample."""
    xs, ys = [], []
    for la in (box['south'], box['north']):
        for lo in (box['west'], box['east']):
            x, y = utm_forward(lo, la, zone, northern)
            xs.append(x)
            ys.append(y)
    return (int((min(xs) - cog.origin_x) / cog.res) - 2, int((cog.origin_y - max(ys)) / cog.res) - 2,
            int((max(xs) - cog.origin_x) / cog.res) + 2, int((cog.origin_y - min(ys)) / cog.res) + 2)


def sentinel_image(box, cog, zone, northern):
    """The box, sampled out of the scene's UTM grid onto its own lon/lat grid.

    Also returns the share of the box that is nodata (pure black, outside the granule's swath) and the share that
    is bright and colourless — cloud or snow. eo:cloud_cover describes the whole 110 km granule, so this is the
    only figure that says anything about the 6 x 4 km a pupil will actually look at.
    """
    w, h = box['photoWidth'], box['photoHeight']
    im = Image.new('RGB', (w, h))
    dst = im.load()
    black = white = 0
    for j in range(h):
        lat = box['north'] - (j + 0.5) * (box['north'] - box['south']) / h
        for i in range(w):
            lon = box['west'] + (i + 0.5) * (box['east'] - box['west']) / w
            x, y = utm_forward(lon, lat, zone, northern)
            fx = (x - cog.origin_x) / cog.res - 0.5
            fy = (cog.origin_y - y) / cog.res - 0.5
            x0, y0 = math.floor(fx), math.floor(fy)
            ax, ay = fx - x0, fy - y0
            c00, c10 = cog.pixel(x0, y0), cog.pixel(x0 + 1, y0)
            c01, c11 = cog.pixel(x0, y0 + 1), cog.pixel(x0 + 1, y0 + 1)
            px = tuple(
                int((c00[k] * (1 - ax) + c10[k] * ax) * (1 - ay) + (c01[k] * (1 - ax) + c11[k] * ax) * ay)
                for k in range(3))
            if px == (0, 0, 0):
                black += 1
            elif min(px) > 150 and max(px) - min(px) < 25:
                white += 1
            dst[i, j] = px
    return im, black / (w * h), white / (w * h)


def build_sentinel(box, refresh):
    """The first candidate scene (SCENE_OVERRIDES, else the clearest) that really covers the box, with no nodata.

    Cloud cover alone is not enough to choose by. The STAC search returns every granule whose footprint merely
    *touches* the box, and Sentinel-2's MGRS granules overlap, so the clearest answer is often a tile whose edge
    cuts the box (Greenwich sits on the 30/31 boundary) or whose swath leaves the box half black. Both are
    checked here against the file itself, and the next-clearest candidate is tried instead.
    """
    rejected = []
    for f in stac_candidates(box, refresh):
        cog = Cog(f['assets']['visual']['href'])
        # The scene's own UTM grid, read off the file's GeoTIFF keys. Never guessed from the box's longitude: see
        # cog.utm_from_epsg for the two ways guessing goes wrong (Greenwich's zone, the equator's false northing).
        zone, northern = utm_from_epsg(cog.epsg)
        px0, py0, px1, py1 = sentinel_window(box, cog, zone, northern)
        if px0 < 0 or py0 < 0 or px1 >= cog.width or py1 >= cog.height:
            rejected.append(f'{f["id"]} (EPSG:{cog.epsg}) stops short of the box: pixels {px0}..{px1} x '
                            f'{py0}..{py1} of {cog.width} x {cog.height}')
            continue
        cog.prefetch(px0, py0, px1, py1)
        im, black, white = sentinel_image(box, cog, zone, northern)
        if black > MAX_NODATA:
            rejected.append(f'{f["id"]} is {black * 100:.1f} % nodata over the box')
            continue
        p = f['properties']
        for why in rejected:
            print(f'    skipped {why}', flush=True)
        print(f'    scene {f["id"]}, {p["datetime"][:10]}, cloud {p["eo:cloud_cover"]:.3f} % of the granule, '
              f'{white * 100:.1f} % white over the box, {cog.bytes_fetched / 1024 / 1024:.1f} MiB fetched',
              flush=True)
        return im, {'scene': f['id'], 'captured': p['datetime'][:10], 'cloud': round(p['eo:cloud_cover'], 4)}
    want = SCENE_OVERRIDES.get(box['id'])
    if want:
        raise RuntimeError(f'{box["id"]}: SCENE_OVERRIDES asks for {want}, which no search under '
                           f'{CLOUD_CEILINGS[-1]} % cloud offered as a usable COG over this box')
    why = '; tried:\n      ' + '\n      '.join(rejected) if rejected else ''
    raise RuntimeError(f'{box["id"]}: no Sentinel-2 candidate under {CLOUD_CEILINGS[-1]} % cloud covers the box{why}')


def build_naip(box):
    """NAIP's exportImage returns the window already in EPSG:4326 at the size asked for: no resampling here."""
    w, h = box['photoWidth'], box['photoHeight']
    url = ('https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer/exportImage'
           f'?bbox={box["west"]},{box["south"]},{box["east"]},{box["north"]}'
           f'&bboxSR=4326&size={w},{h}&imageSR=4326&format=png&f=image')
    im = Image.open(io.BytesIO(fetch(url))).convert('RGB')
    if im.size != (w, h):
        raise RuntimeError(f'{box["id"]}: NAIP returned {im.size}, expected {(w, h)}')
    return im, {'scene': 'USGSNAIPPlus', 'captured': '', 'cloud': None}


def build_tiles(box, source):
    b = (box['west'], box['south'], box['east'], box['north'])
    w, h = box['photoWidth'], box['photoHeight']
    ground = box['widthM'] / w
    z = zoom_for(box['lat'], ground, source['max_zoom'])
    im, span, ox, oy = mosaic(source['template'], z, b)
    big = to_equirect(im, span, ox, oy, b, w * SUPERSAMPLE, h * SUPERSAMPLE)
    return big.resize((w, h), Image.LANCZOS), {'scene': f'zoom {z}', 'captured': '', 'cloud': None}


def build_one(box, refresh, photos):
    """Build one box's photo, save it and record its manifest entry in `photos`."""
    source = SOURCES[box['source']]
    print(f'  {box["id"]} <- {source["name"]}', flush=True)
    if box['source'] == 'sentinel':
        im, extra = build_sentinel(box, refresh)
    elif box['source'] == 'naip':
        im, extra = build_naip(box)
    else:
        im, extra = build_tiles(box, source)
    file = f'{box["id"]}.webp'
    path = os.path.join(OUT, file)
    im.save(path, 'WEBP', quality=box['quality'], method=6)
    size = os.path.getsize(path)
    photos[box['id']] = {
        'file': file, 'width': im.width, 'height': im.height,
        'bounds': [box['west'], box['south'], box['east'], box['north']],
        'source': box['source'], 'sourceName': source['name'], 'licence': source['licence'],
        'scene': extra['scene'], 'captured': extra['captured'], 'cloud': extra['cloud'],
        'groundM': round(box['widthM'] / im.width, 2), 'bytes': size, 'mime': 'image/webp',
    }
    print(f'    {path}: {im.width} x {im.height}, {size / 1024:.1f} KiB, '
          f'{photos[box["id"]]["groundM"]} m/px', flush=True)


def write_manifest(path, boxes_file, photos):
    """The manifest, in boxes.json order, with the Copernicus credit finished off."""
    # The credit names the years of the scenes actually committed, so it is taken from the whole manifest and not
    # only from this run: `--only` must never narrow the credit on the other boxes.
    years = {p['captured'][:4] for p in photos.values() if p['source'] == 'sentinel' and p['captured']}
    span = f'{min(years)}-{max(years)}' if len(years) > 1 else (next(iter(years)) if years else '')
    for p in photos.values():
        if p['source'] == 'sentinel':
            p['licence'] = SOURCES['sentinel']['licence'].format(years=span)
    ordered = {b['id']: photos[b['id']] for b in boxes_file['boxes'] if b['id'] in photos}
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({'generatedBy': 'scripts/build-city-photos.py', 'photos': ordered}, f, indent=1, ensure_ascii=False)
        f.write('\n')
    total = sum(p['bytes'] for p in ordered.values())
    print(f'{path}: {len(ordered)} photos, {total / 1024:.1f} KiB total '
          f'({total * 4 / 3 / 1024:.1f} KiB as base64)')


def main():
    # Run from scripts/ (so `from cog import ...` resolves) but work from the repository root, where every path
    # in this file is relative to.
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    args = sys.argv[1:]
    refresh = '--refresh' in args
    only = set(args[args.index('--only') + 1].split(',')) if '--only' in args else None
    with open(BOXES, encoding='utf-8') as f:
        boxes_file = json.load(f)
    if only:
        unknown = only - {b['id'] for b in boxes_file['boxes']}
        if unknown:
            raise SystemExit(f'--only names {", ".join(sorted(unknown))}, which is not a box in {BOXES}')
    os.makedirs(OUT, exist_ok=True)
    manifest_path = os.path.join(OUT, 'manifest.json')
    photos = {}
    if os.path.exists(manifest_path):
        with open(manifest_path, encoding='utf-8') as f:
            photos = json.load(f)['photos']

    try:
        for b in boxes_file['boxes']:
            if not only or b['id'] in only:
                build_one({**b, 'widthM': boxes_file['widthM'], 'heightM': boxes_file['heightM']}, refresh, photos)
    finally:
        # Written even when a later box fails, so the manifest always describes the .webp files that are on disk.
        write_manifest(manifest_path, boxes_file, photos)


if __name__ == '__main__':
    main()
