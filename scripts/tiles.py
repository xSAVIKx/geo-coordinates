"""Web Mercator tile mosaics for scripts/build-city-photos.py.

A WMTS or XYZ service hands out 256 px tiles on the standard Web Mercator pyramid: at level z the whole world is
2**z tiles across, the top-left corner is (-20037508.34, +20037508.34) in EPSG:3857 metres, and one pixel is
156543.03392 / 2**z of those metres. GUGiK's capabilities give the same grid through ScaleDenominator x 0.28 mm,
so the three services differ only in their URL template.

Needs Python 3.10+ and Pillow. No numpy, no GDAL.
"""
import io
import math
import time
import urllib.error
import urllib.request

from PIL import Image

UA = 'geo-coordinates-lesson/1.0 (school lesson build; yurii@serhiichuk.dev)'
R = 6378137.0
ORIGIN = 20037508.342789244
TILE = 256


def merc(lon, lat):
    """EPSG:3857 metres for a WGS 84 lon/lat."""
    return lon * math.pi / 180 * R, math.log(math.tan(math.pi / 4 + lat * math.pi / 360)) * R


def pixel_span(z):
    """EPSG:3857 metres per pixel at zoom z."""
    return 2 * ORIGIN / (2 ** z) / TILE


def ground_span(z, lat):
    """Ground metres per pixel at zoom z and latitude lat (Mercator stretches by 1/cos(lat))."""
    return pixel_span(z) * math.cos(lat * math.pi / 180)


def zoom_for(lat, target_ground_m, max_zoom):
    """The smallest zoom whose ground resolution is at least twice as fine as `target_ground_m`.

    Fetching at about 2x the output resolution and reducing with Lanczos is what makes the committed photo
    genuinely resolved instead of a sharpened upscale (README, "Be honest about what each box can show").
    """
    want = target_ground_m / 2
    z = 0
    while z < max_zoom and ground_span(z, lat) > want:
        z += 1
    return z


def fetch(url, tries=3, delay=1.0):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read()
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt == tries - 1:
                raise RuntimeError(f'{url}: {e}') from e
            time.sleep(delay * (attempt + 1))
    raise AssertionError('unreachable')


def mosaic(template, z, box, max_tiles=600):
    """Every tile of level z covering `box` (west, south, east, north), pasted into one image.

    `template` takes {z}, {x} (column) and {y} (row). Returns (image, span, originX, originY) where span is
    EPSG:3857 metres per pixel and (originX, originY) is the mosaic's top-left corner in the same metres.
    """
    west, south, east, north = box
    span = pixel_span(z)
    x0, y0 = merc(west, north)
    x1, y1 = merc(east, south)
    c0 = int((x0 + ORIGIN) // (TILE * span))
    c1 = int((x1 + ORIGIN) // (TILE * span))
    r0 = int((ORIGIN - y0) // (TILE * span))
    r1 = int((ORIGIN - y1) // (TILE * span))
    count = (c1 - c0 + 1) * (r1 - r0 + 1)
    if count > max_tiles:
        raise RuntimeError(f'{count} tiles at zoom {z} is more than the {max_tiles} allowed; use a lower zoom')
    im = Image.new('RGB', ((c1 - c0 + 1) * TILE, (r1 - r0 + 1) * TILE))
    got = 0
    for c in range(c0, c1 + 1):
        for r in range(r0, r1 + 1):
            data = fetch(template.format(z=z, x=c, y=r))
            im.paste(Image.open(io.BytesIO(data)).convert('RGB'), ((c - c0) * TILE, (r - r0) * TILE))
            got += 1
    print(f'    {got} tiles at zoom {z} ({ground_span(z, (south + north) / 2):.2f} m/px on the ground)', flush=True)
    return im, span, -ORIGIN + c0 * TILE * span, ORIGIN - r0 * TILE * span


def to_equirect(im, span, ox, oy, box, out_w, out_h):
    """Resample a Web Mercator mosaic onto the box's own lon/lat grid, north up (planning ruling R15)."""
    west, south, east, north = box
    out = Image.new('RGB', (out_w, out_h))
    dst = out.load()
    src = im.load()
    w1, h1 = im.width - 1, im.height - 1
    for j in range(out_h):
        lat = north - (j + 0.5) * (north - south) / out_h
        my = math.log(math.tan(math.pi / 4 + lat * math.pi / 360)) * R
        fy = (oy - my) / span - 0.5
        y0 = math.floor(fy)
        ay = fy - y0
        ya, yb = min(max(y0, 0), h1), min(max(y0 + 1, 0), h1)
        for i in range(out_w):
            lon = west + (i + 0.5) * (east - west) / out_w
            fx = (lon * math.pi / 180 * R - ox) / span - 0.5
            x0 = math.floor(fx)
            ax = fx - x0
            xa, xb = min(max(x0, 0), w1), min(max(x0 + 1, 0), w1)
            c00, c10, c01, c11 = src[xa, ya], src[xb, ya], src[xa, yb], src[xb, yb]
            dst[i, j] = (
                int((c00[0] * (1 - ax) + c10[0] * ax) * (1 - ay) + (c01[0] * (1 - ax) + c11[0] * ax) * ay),
                int((c00[1] * (1 - ax) + c10[1] * ax) * (1 - ay) + (c01[1] * (1 - ax) + c11[1] * ax) * ay),
                int((c00[2] * (1 - ax) + c10[2] * ax) * (1 - ay) + (c01[2] * (1 - ax) + c11[2] * ax) * ay),
            )
    return out
