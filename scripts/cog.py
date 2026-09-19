"""Reading a window out of a Cloud-Optimized GeoTIFF with HTTP range requests, in pure Python.

Sentinel-2 L2A "visual" assets (TCI) on https://sentinel-cogs.s3.us-west-2.amazonaws.com are classic little-endian
TIFFs: 10980 x 10980, 3 x uint8, 1024 x 1024 tiles, Deflate (tag 259 = 8) with the horizontal predictor
(tag 317 = 2), in a UTM projection given by tag 33550 (pixel scale) and 33922 (tie point). Only the tiles that
cover the wanted box are fetched, so one box costs about 4-10 MB instead of the scene's ~200 MB.

Needs Python 3.10+. No numpy, no rasterio, no GDAL.
"""
import math
import struct
import urllib.request
import zlib

UA = 'geo-coordinates-lesson/1.0 (school lesson build; yurii@serhiichuk.dev)'

TYPE_FMT = {1: 'B', 3: 'H', 4: 'I', 11: 'f', 12: 'd', 16: 'Q'}
TYPE_SIZE = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 11: 4, 12: 8, 16: 8}

# WGS 84 for the UTM forward below.
A = 6378137.0
F = 1 / 298.257223563
E2 = F * (2 - F)
K0 = 0.9996


def utm_zone(lon):
    return int((lon + 180) // 6) + 1


def utm_from_epsg(epsg):
    """(zone, northern) for a WGS 84 / UTM EPSG code: 326xx is north, 327xx is south.

    The scene's own code is the only safe answer. An MGRS tile is not always in the zone its centre longitude
    suggests — Greenwich (lon -0.0015, so "zone 31") is served by tile 30UXC in EPSG:32630 — and a box on the
    equator (Mitad del Mundo) can be covered by either hemisphere's grid, which differ by a 10 000 km false
    northing. Guessing either one from the box's own lat/lon reads the wrong pixels, silently.
    """
    if 32601 <= epsg <= 32660:
        return epsg - 32600, True
    if 32701 <= epsg <= 32760:
        return epsg - 32700, False
    raise RuntimeError(f'EPSG:{epsg} is not a WGS 84 / UTM projection')


def utm_forward(lon, lat, zone, northern=True):
    """WGS 84 lon/lat to UTM easting/northing (Snyder's series; millimetre accuracy inside a zone)."""
    lon0 = math.radians(zone * 6 - 183)
    p = math.radians(lat)
    l = math.radians(lon) - lon0
    ep2 = E2 / (1 - E2)
    n = A / math.sqrt(1 - E2 * math.sin(p) ** 2)
    t = math.tan(p) ** 2
    c = ep2 * math.cos(p) ** 2
    a = math.cos(p) * l
    m = A * ((1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256) * p
             - (3 * E2 / 8 + 3 * E2 ** 2 / 32 + 45 * E2 ** 3 / 1024) * math.sin(2 * p)
             + (15 * E2 ** 2 / 256 + 45 * E2 ** 3 / 1024) * math.sin(4 * p)
             - (35 * E2 ** 3 / 3072) * math.sin(6 * p))
    x = K0 * n * (a + (1 - t + c) * a ** 3 / 6 + (5 - 18 * t + t * t + 72 * c - 58 * ep2) * a ** 5 / 120) + 500000.0
    y = K0 * (m + n * math.tan(p) * (a ** 2 / 2 + (5 - t + 9 * c + 4 * c * c) * a ** 4 / 24
                                     + (61 - 58 * t + t * t + 600 * c - 330 * ep2) * a ** 6 / 720))
    return x, (y if northern else y + 10000000.0)


def _range(url, start, end):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Range': f'bytes={start}-{end}'})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def read_ifd(buf, bo, off):
    """Tag -> tuple of values for the IFD at `off`, for every tag whose data is inside `buf`."""
    n = struct.unpack(bo + 'H', buf[off:off + 2])[0]
    tags = {}
    for i in range(n):
        e = off + 2 + i * 12
        tag, typ, cnt = struct.unpack(bo + 'HHI', buf[e:e + 8])
        raw = buf[e + 8:e + 12]
        size = TYPE_SIZE.get(typ, 0) * cnt
        if size <= 4:
            data = raw[:size]
        else:
            p = struct.unpack(bo + 'I', raw)[0]
            data = buf[p:p + size] if p + size <= len(buf) else None
        tags[tag] = struct.unpack(bo + TYPE_FMT[typ] * cnt, data) if data is not None and typ in TYPE_FMT else None
    return tags


def geokey(tags, key):
    """One GeoTIFF GeoKey (tag 34735) whose value is stored inline, or None.

    The directory is a flat list of 4-shorts records after a 4-short header: (key, location, count, value);
    location 0 means the value is the fourth short itself, which is the case for ProjectedCSTypeGeoKey (3072).
    """
    d = tags.get(34735)
    if not d or len(d) < 4:
        return None
    for i in range(4, len(d) - 3, 4):
        if d[i] == key and d[i + 1] == 0 and d[i + 2] == 1:
            return d[i + 3]
    return None


class Cog:
    """A COG's first (full-resolution) image, with tiles fetched on demand."""

    def __init__(self, url, header_bytes=262144):
        self.url = url
        head = _range(url, 0, header_bytes - 1)
        if head[:2] not in (b'II', b'MM') or struct.unpack('<H' if head[:2] == b'II' else '>H', head[2:4])[0] != 42:
            raise RuntimeError(f'{url}: not a classic little-endian TIFF')
        bo = '<' if head[:2] == b'II' else '>'
        t = read_ifd(head, bo, struct.unpack(bo + 'I', head[4:8])[0])
        self.width, self.height = t[256][0], t[257][0]
        self.tile_w, self.tile_h = t[322][0], t[323][0]
        self.offsets, self.counts = t[324], t[325]
        self.samples = t[277][0]
        self.compression = t[259][0]
        self.predictor = (t.get(317) or (1,))[0]
        if self.compression != 8:
            raise RuntimeError(f'{url}: compression {self.compression} is not Deflate')
        if self.predictor not in (1, 2):
            raise RuntimeError(f'{url}: predictor {self.predictor} is not supported')
        scale, tie = t[33550], t[33922]
        self.res = scale[0]                 # metres per pixel (square)
        self.origin_x, self.origin_y = tie[3], tie[4]
        self.epsg = geokey(t, 3072)         # ProjectedCSTypeGeoKey: which UTM grid these metres are in
        if self.epsg is None:
            raise RuntimeError(f'{url}: no ProjectedCSTypeGeoKey (3072) in the GeoTIFF keys')
        self.across = (self.width + self.tile_w - 1) // self.tile_w
        self._tiles = {}
        self.bytes_fetched = 0

    def tile(self, tx, ty):
        key = (tx, ty)
        cached = self._tiles.get(key)
        if cached is not None:
            return cached
        i = ty * self.across + tx
        raw = _range(self.url, self.offsets[i], self.offsets[i] + self.counts[i] - 1)
        self.bytes_fetched += len(raw)
        data = bytearray(zlib.decompress(raw))
        if self.predictor == 2:
            stride = self.tile_w * self.samples
            for row in range(self.tile_h):
                b = row * stride
                for c in range(self.samples, stride):
                    data[b + c] = (data[b + c] + data[b + c - self.samples]) & 0xFF
        out = bytes(data)
        self._tiles[key] = out
        return out

    def pixel(self, x, y):
        if x < 0 or y < 0 or x >= self.width or y >= self.height:
            return (0, 0, 0)
        d = self.tile(x // self.tile_w, y // self.tile_h)
        o = ((y % self.tile_h) * self.tile_w + (x % self.tile_w)) * self.samples
        return d[o], d[o + 1], d[o + 2]

    def prefetch(self, px0, py0, px1, py1):
        for ty in range(max(0, py0) // self.tile_h, min(self.height - 1, py1) // self.tile_h + 1):
            for tx in range(max(0, px0) // self.tile_w, min(self.width - 1, px1) // self.tile_w + 1):
                self.tile(tx, ty)
