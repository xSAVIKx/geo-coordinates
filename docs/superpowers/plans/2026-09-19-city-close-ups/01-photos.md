# Part 1 — Data build: the twelve boxes and their photos (spec §9.1)

Task 1 produces committed data files and one runtime module. Nothing the page draws changes yet. Read the spec §3 and §4 first, and the README's "Be honest about what each box can show" and "Photo sources" tables.

Conventions for this part:
- Run TypeScript scripts with `node --experimental-strip-types scripts/<name>.ts` (Node 24; imports between scripts use the `.ts` extension, as `scripts/size-check.ts` does).
- Python scripts need Python 3.10+ and Pillow with WebP, and **nothing else**: there is no numpy, no rasterio and no GDAL on this machine, and none may be added. Check with
  `python3 -c "from PIL import features, __version__; print(__version__, features.check('webp'))"` → `12.3.0 True`.
- Raw downloads live in the git-ignored `.cache/`. Committed outputs live in `src/map/data/`.
- Network is available in this task. Everything after Task 2 must work with no network at all.
- Before committing: `npm run check && npm test` must pass.

---

### Task 1: The twelve boxes and the five photo sources

Build `src/map/data/city/boxes.json` (the single source of truth for both data builds and the page), the twelve WebP photos with their manifest, and the runtime `src/map/cityBoxes.ts`.

**Files:**
- Create: `scripts/city-boxes.ts`
- Create: `scripts/cog.py`
- Create: `scripts/tiles.py`
- Create: `scripts/build-city-photos.py`
- Create (generated, committed): `src/map/data/city/boxes.json`, `src/map/data/city/photos/<id>.webp` × 12, `src/map/data/city/photos/manifest.json`
- Create: `src/map/cityBoxes.ts`
- Modify: `package.json` (scripts `data:city-boxes`, `data:city-photos`)
- Test: `tests/unit/city-boxes.test.ts`, `tests/unit/city-photos-data.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks. `src/map/geometry.ts`'s `GeoBounds` (`{ west, south, east, north }`) and `src/geo/types.ts`'s `LatLon` (`{ lat, lon }`).
- Produces (exact names later tasks rely on):
  ```ts
  // scripts/city-boxes.ts (build-time only)
  export type PhotoSourceKey = 'gugik' | 'ign' | 'gsi' | 'naip' | 'sentinel';
  export interface CityBoxSpec { id: string; lat: number; lon: number; note: boolean;
    source: PhotoSourceKey; photoWidth: number; photoHeight: number; quality: number }
  export const CITY_BOX_WIDTH_M = 6000;
  export const CITY_BOX_HEIGHT_M = 4000;
  export const CITY_BOX_SPECS: readonly CityBoxSpec[];
  export interface BoxBounds { west: number; south: number; east: number; north: number }
  export function boxAround(lat: number, lon: number, widthM: number, heightM: number): BoxBounds;
  export interface BoxesFile { widthM: number; heightM: number; boxes: (CityBoxSpec & BoxBounds)[] }
  export function boxesFile(): BoxesFile;

  // src/map/cityBoxes.ts (runtime)
  export type CityBoxId = 'katowice' | 'greenwich' | 'mitaddelmundo' | 'rovaniemi' | 'warsaw' | 'krakow'
    | 'paris' | 'manhattan' | 'delhi' | 'sydney' | 'tokyo' | 'giza';
  export interface CityBox { id: CityBoxId; lat: number; lon: number; bounds: GeoBounds; fitZoom: number; note: boolean }
  export const CITY_BOXES: readonly CityBox[];
  export const CITY_BOX_IDS: readonly CityBoxId[];
  export const CITY_STREET_ZOOM = 24;
  export const CITY_PHOTO_ZOOM = 40;
  export const CITY_PHOTO_FULL_ZOOM = 80;
  export function fitZoom(b: GeoBounds): number;
  export function cityBoxById(id: string): CityBox | null;
  export function cityBoxAt(p: LatLon, zoom: number): CityBox | null;
  export function visibleCityBox(view: GeoBounds, zoom: number): CityBox | null;

  // src/map/data/city/photos/manifest.json
  interface PhotoEntry { file: string; width: number; height: number;
    bounds: [west: number, south: number, east: number, north: number];
    source: 'gugik' | 'ign' | 'gsi' | 'naip' | 'sentinel'; sourceName: string; licence: string;
    scene: string; captured: string; cloud: number | null; groundM: number; bytes: number; mime: 'image/webp' }
  interface PhotoManifest { generatedBy: string; photos: Record<string, PhotoEntry> }
  ```

---

- [ ] **Step 1: `scripts/city-boxes.ts` — the twelve boxes**

The centres are the spec §3 table. The source and committed size per box are planning rulings R4 and R5.

```ts
// The twelve city close-up boxes (Places up close spec §3): 6 x 4 km, centred on the named feature.
// This file is the single source of truth for the box geometry. It writes src/map/data/city/boxes.json,
// which scripts/build-city-photos.py, scripts/build-city-streets.ts and src/map/cityBoxes.ts all read, so the
// photo, the streets and the page can never disagree about where a box is.
//
// Usage: node --experimental-strip-types scripts/city-boxes.ts   (npm run data:city-boxes)
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export type PhotoSourceKey = 'gugik' | 'ign' | 'gsi' | 'naip' | 'sentinel';

export interface CityBoxSpec {
  id: string;
  lat: number;
  lon: number;
  /** One of the three teaching places with a coordinate line painted on the ground (spec §1). */
  note: boolean;
  source: PhotoSourceKey;
  photoWidth: number;
  photoHeight: number;
  /** WebP quality: 65 for the detailed orthophotos, 80 for the small Sentinel tiles (planning ruling R4). */
  quality: number;
}

export const CITY_BOX_WIDTH_M = 6000;
export const CITY_BOX_HEIGHT_M = 4000;
const OUT = 'src/map/data/city/boxes.json';

// 3:2 like the 6 x 4 km box. Katowice is the school's own box and gets the largest size (ruling R4).
const ORTHO_BIG = { photoWidth: 1440, photoHeight: 960, quality: 65 } as const;
const ORTHO = { photoWidth: 1200, photoHeight: 800, quality: 65 } as const;
// 600 x 400 is exactly Sentinel-2's own 10 m per pixel over this box: never enlarge it (ruling R4).
const SENTINEL = { photoWidth: 600, photoHeight: 400, quality: 80 } as const;

export const CITY_BOX_SPECS: readonly CityBoxSpec[] = [
  { id: 'katowice', lat: 50.26, lon: 19.02, note: false, source: 'gugik', ...ORTHO_BIG },
  { id: 'greenwich', lat: 51.4779, lon: -0.0015, note: true, source: 'sentinel', ...SENTINEL },
  { id: 'mitaddelmundo', lat: -0.0022, lon: -78.4558, note: true, source: 'sentinel', ...SENTINEL },
  { id: 'rovaniemi', lat: 66.5436, lon: 25.8475, note: true, source: 'sentinel', ...SENTINEL },
  { id: 'warsaw', lat: 52.2297, lon: 21.0122, note: false, source: 'gugik', ...ORTHO },
  { id: 'krakow', lat: 50.0647, lon: 19.945, note: false, source: 'gugik', ...ORTHO },
  { id: 'paris', lat: 48.8584, lon: 2.2945, note: false, source: 'ign', ...ORTHO },
  { id: 'manhattan', lat: 40.7484, lon: -73.9857, note: false, source: 'naip', ...ORTHO },
  { id: 'delhi', lat: 28.6129, lon: 77.2295, note: false, source: 'sentinel', ...SENTINEL },
  { id: 'sydney', lat: -33.8568, lon: 151.2153, note: false, source: 'sentinel', ...SENTINEL },
  { id: 'tokyo', lat: 35.6595, lon: 139.7004, note: false, source: 'gsi', ...ORTHO },
  { id: 'giza', lat: 29.9792, lon: 31.1342, note: false, source: 'sentinel', ...SENTINEL },
];

export interface BoxBounds { west: number; south: number; east: number; north: number }

/** Metres per degree of latitude, and of longitude at `lat`, on a sphere of the WGS 84 mean radius. */
const M_PER_DEG_LAT = 111_320;

/**
 * A box `widthM` x `heightM` metres centred on (lat, lon), in degrees. The longitude half-width is divided by
 * cos(lat), so the box is the given size in metres at every latitude — which is what makes every photo's pixel
 * square in metres and lets all twelve share one 3:2 shape (planning ruling R15).
 */
export function boxAround(lat: number, lon: number, widthM: number, heightM: number): BoxBounds {
  const dLat = heightM / 2 / M_PER_DEG_LAT;
  const dLon = widthM / 2 / (M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  const r = (v: number) => Math.round(v * 1e7) / 1e7;   // 1e-7 deg is about 1 cm: far finer than any source
  return { west: r(lon - dLon), south: r(lat - dLat), east: r(lon + dLon), north: r(lat + dLat) };
}

export interface BoxesFile { widthM: number; heightM: number; boxes: (CityBoxSpec & BoxBounds)[] }

export function boxesFile(): BoxesFile {
  return {
    widthM: CITY_BOX_WIDTH_M,
    heightM: CITY_BOX_HEIGHT_M,
    boxes: CITY_BOX_SPECS.map((s) => ({ ...s, ...boxAround(s.lat, s.lon, CITY_BOX_WIDTH_M, CITY_BOX_HEIGHT_M) })),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(dirname(OUT), { recursive: true });
  const json = JSON.stringify(boxesFile(), null, 1);
  writeFileSync(OUT, `${json}\n`);
  console.log(`${OUT}: ${CITY_BOX_SPECS.length} boxes, ${json.length} B`);
}
```

Then:
```bash
node --experimental-strip-types scripts/city-boxes.ts
```
Expected: `src/map/data/city/boxes.json: 12 boxes, …`. Open the file and check Katowice reads
`"west": 18.9778459, "south": 50.2420338, "east": 19.0621541, "north": 50.2779662`.

- [ ] **Step 2: `scripts/tiles.py` — Web Mercator tile mosaics**

Three of the five sources are Web Mercator tile services (GUGiK WMTS, IGN WMTS, GSI XYZ). One helper serves all three.

```python
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
```

- [ ] **Step 3: `scripts/cog.py` — a Cloud-Optimized GeoTIFF window reader**

Sentinel-2's true-colour asset is a tiled Deflate GeoTIFF on S3. There is no rasterio on this machine, so the reader is 120 lines of `struct`, `zlib` and HTTP range requests. The structure below was read off the real file during planning: classic TIFF (`II*\0`), tags 322/323 = 1024 × 1024 tiles, 259 = 8 (Deflate), 317 = 2 (horizontal predictor), 277 = 3 samples, 33550 = pixel scale, 33922 = tie point.

```python
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
    return x, y if northern else y + 10000000.0


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
```

`cog.py` and `tiles.py` are plain modules beside each other in `scripts/`, not a package, so `build-city-photos.py`
imports them as `from cog import …` / `from tiles import …` and must be run with `scripts/` on the path (Step 4's
npm script does that with a `cd`).

- [ ] **Step 4: `scripts/build-city-photos.py` — the five sources and the manifest**

```python
#!/usr/bin/env python3
"""Builds the twelve city close-up photos in src/map/data/city/photos/ (Places up close spec §4).

Each box uses the best open source that covers it (planning ruling R4); src/map/data/city/boxes.json says which.
Every photo comes out equirectangular in the box's own lon/lat frame, north up, 3:2, at the size boxes.json fixes.

  gugik     GUGiK ORTOFOTOMAPA, Poland. WMTS, LAYER=ORTOFOTOMAPA, TILEMATRIXSET=EPSG:3857.
            Capabilities: AccessConstraints "brak ograniczen"; Fees points at the Geoportal regulations.
            Credit: "Ortofotomapa: Glowny Urzad Geodezji i Kartografii, geoportal.gov.pl"
  ign       IGN BD ORTHO, France, via data.geopf.fr. WMTS, LAYER=ORTHOIMAGERY.ORTHOPHOTOS, TILEMATRIXSET=PM.
            Credit: "Orthophotos: (c) IGN / Geoplateforme (data.geopf.fr), Licence Ouverte Etalab 2.0"
  gsi       GSI seamlessphoto, Japan. XYZ tiles. Processed tiles must say so.
            Credit: "Aerial photo: Geospatial Information Authority of Japan, seamlessphoto tiles (processed)"
  naip      USGS / USDA NAIP, United States. ArcGIS ImageServer exportImage, already in EPSG:4326. Public domain.
            Credit: "Aerial photo: USDA-FSA National Agriculture Imagery Program (NAIP), via USGS (public domain)"
  sentinel  Copernicus Sentinel-2 L2A via the Earth Search STAC API on AWS; the "visual" (TCI) COG at 10 m.
            Credit, verbatim and in English everywhere: "Contains modified Copernicus Sentinel data <years>"

Usage:
  python3 scripts/build-city-photos.py [--only <id>,<id>] [--refresh]     (npm run data:city-photos)
Needs Python 3.10+ and Pillow with WebP. No numpy, no rasterio, no GDAL. Raw JSON answers are cached under
.cache/city/ (git-ignored); --refresh ignores the cache. The outputs are committed; `npm run build` never runs this.
"""
import json
import math
import os
import sys
import urllib.request

from PIL import Image

from cog import Cog, utm_forward, utm_zone
from tiles import UA, fetch, mosaic, to_equirect, zoom_for

BOXES = os.path.join('src', 'map', 'data', 'city', 'boxes.json')
OUT = os.path.join('src', 'map', 'data', 'city', 'photos')
CACHE = os.path.join('.cache', 'city')
STAC = 'https://earth-search.aws.element84.com/v1/search'
SENTINEL_WINDOW = ('2024-09-01T00:00:00Z', '2026-09-19T00:00:00Z')

SOURCES = {
    'gugik': {
        'name': 'GUGiK ORTOFOTOMAPA (geoportal.gov.pl)',
        'licence': 'Ortofotomapa: Glowny Urzad Geodezji i Kartografii, geoportal.gov.pl',
        'template': ('https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMTS/StandardResolution'
                     '?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTOFOTOMAPA&STYLE=default'
                     '&FORMAT=image/jpeg&TILEMATRIXSET=EPSG:3857&TILEMATRIX=EPSG:3857:{z}&TILEROW={y}&TILECOL={x}'),
        'max_zoom': 18,
    },
    'ign': {
        'name': 'IGN BD ORTHO (data.geopf.fr)',
        'licence': 'Orthophotos: (c) IGN / Geoplateforme (data.geopf.fr), Licence Ouverte Etalab 2.0',
        'template': ('https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0'
                     '&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg'
                     '&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}'),
        'max_zoom': 19,
    },
    'gsi': {
        'name': 'GSI seamlessphoto (cyberjapandata.gsi.go.jp)',
        'licence': 'Aerial photo: Geospatial Information Authority of Japan, seamlessphoto tiles (processed)',
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


def stac_search(box, refresh):
    """The clearest recent Sentinel-2 L2A scene covering the box (spec §4 "picks the clearest recent scene")."""
    body = json.dumps({
        'collections': ['sentinel-2-l2a'],
        'bbox': [box['west'], box['south'], box['east'], box['north']],
        'datetime': f'{SENTINEL_WINDOW[0]}/{SENTINEL_WINDOW[1]}',
        'query': {'eo:cloud_cover': {'lt': 5}},
        'sortby': [{'field': 'properties.eo:cloud_cover', 'direction': 'asc'}],
        'limit': 5,
    }).encode()

    def call():
        req = urllib.request.Request(STAC, data=body,
                                     headers={'Content-Type': 'application/json', 'User-Agent': UA})
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.load(r)

    found = cached_json(f'stac-{box["id"]}.json', call, refresh)
    if not found.get('features'):
        raise RuntimeError(f'{box["id"]}: no Sentinel-2 scene under 5 % cloud in the window')
    return found['features'][0]


def build_sentinel(box, refresh):
    f = stac_search(box, refresh)
    url = f['assets']['visual']['href']
    cog = Cog(url)
    zone = utm_zone(box['lon'])
    northern = box['lat'] >= 0
    xs, ys = [], []
    for la in (box['south'], box['north']):
        for lo in (box['west'], box['east']):
            x, y = utm_forward(lo, la, zone, northern)
            xs.append(x)
            ys.append(y)
    px0 = int((min(xs) - cog.origin_x) / cog.res) - 2
    px1 = int((max(xs) - cog.origin_x) / cog.res) + 2
    py0 = int((cog.origin_y - max(ys)) / cog.res) - 2
    py1 = int((cog.origin_y - min(ys)) / cog.res) + 2
    cog.prefetch(px0, py0, px1, py1)
    w, h = box['photoWidth'], box['photoHeight']
    im = Image.new('RGB', (w, h))
    dst = im.load()
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
            dst[i, j] = tuple(
                int((c00[k] * (1 - ax) + c10[k] * ax) * (1 - ay) + (c01[k] * (1 - ax) + c11[k] * ax) * ay)
                for k in range(3))
    p = f['properties']
    print(f'    scene {f["id"]}, {p["datetime"][:10]}, cloud {p["eo:cloud_cover"]:.3f} %, '
          f'{cog.bytes_fetched / 1024 / 1024:.1f} MiB fetched', flush=True)
    return im, {'scene': f['id'], 'captured': p['datetime'][:10], 'cloud': round(p['eo:cloud_cover'], 4)}


def build_naip(box):
    """NAIP's exportImage returns the window already in EPSG:4326 at the size asked for: no resampling here."""
    w, h = box['photoWidth'], box['photoHeight']
    url = ('https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPPlus/ImageServer/exportImage'
           f'?bbox={box["west"]},{box["south"]},{box["east"]},{box["north"]}'
           f'&bboxSR=4326&size={w},{h}&imageSR=4326&format=png&f=image')
    import io
    im = Image.open(io.BytesIO(fetch(url))).convert('RGB')
    if im.size != (w, h):
        raise RuntimeError(f'{box["id"]}: NAIP returned {im.size}, expected {(w, h)}')
    return im, {'scene': 'USGSNAIPPlus', 'captured': '', 'cloud': None}


def build_tiles(box, source):
    b = (box['west'], box['south'], box['east'], box['north'])
    ground = box['widthM'] / box['photoWidth']
    z = zoom_for(box['lat'], ground, source['max_zoom'])
    im, span, ox, oy = mosaic(source['template'], z, b)
    return to_equirect(im, span, ox, oy, b, box['photoWidth'], box['photoHeight']), \
        {'scene': f'zoom {z}', 'captured': '', 'cloud': None}


def main():
    # Run from scripts/ (so `from cog import …` resolves) but work from the repository root, where every path
    # in this file is relative to.
    os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    args = sys.argv[1:]
    refresh = '--refresh' in args
    only = None
    if '--only' in args:
        only = set(args[args.index('--only') + 1].split(','))
    with open(BOXES, encoding='utf-8') as f:
        boxes_file = json.load(f)
    os.makedirs(OUT, exist_ok=True)
    manifest_path = os.path.join(OUT, 'manifest.json')
    photos = {}
    if os.path.exists(manifest_path):
        with open(manifest_path, encoding='utf-8') as f:
            photos = json.load(f)['photos']

    years = set()
    for box in boxes_file['boxes']:
        box = {**box, 'widthM': boxes_file['widthM'], 'heightM': boxes_file['heightM']}
        if only and box['id'] not in only:
            continue
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
        if extra['captured']:
            years.add(extra['captured'][:4])
        photos[box['id']] = {
            'file': file, 'width': im.width, 'height': im.height,
            'bounds': [box['west'], box['south'], box['east'], box['north']],
            'source': box['source'], 'sourceName': source['name'], 'licence': source['licence'],
            'scene': extra['scene'], 'captured': extra['captured'], 'cloud': extra['cloud'],
            'groundM': round(boxes_file['widthM'] / im.width, 2), 'bytes': size, 'mime': 'image/webp',
        }
        print(f'    {path}: {im.width} x {im.height}, {size / 1024:.1f} KiB, '
              f'{photos[box["id"]]["groundM"]} m/px', flush=True)

    span = f'{min(years)}-{max(years)}' if len(years) > 1 else (next(iter(years)) if years else '')
    for p in photos.values():
        if p['source'] == 'sentinel':
            p['licence'] = SOURCES['sentinel']['licence'].format(years=span)
    ordered = {b['id']: photos[b['id']] for b in boxes_file['boxes'] if b['id'] in photos}
    with open(manifest_path, 'w', encoding='utf-8') as f:
        json.dump({'generatedBy': 'scripts/build-city-photos.py', 'photos': ordered}, f, indent=1)
        f.write('\n')
    total = sum(p['bytes'] for p in ordered.values())
    print(f'{manifest_path}: {len(ordered)} photos, {total / 1024:.1f} KiB total '
          f'({total * 4 / 3 / 1024:.1f} KiB as base64)')


if __name__ == '__main__':
    main()
```

Add to `package.json` `"scripts"`:
```json
"data:city-boxes": "node --experimental-strip-types scripts/city-boxes.ts",
"data:city-photos": "cd scripts && python3 build-city-photos.py"
```
The `cd scripts` is what lets `from cog import …` and `from tiles import …` resolve; `main()`'s first line puts the
working directory back at the repository root, which every path in the script is relative to.

- [ ] **Step 5: Run the build, one source at a time, and look at every photo**

```bash
npm run data:city-photos -- --only katowice
npm run data:city-photos -- --only warsaw,krakow
npm run data:city-photos -- --only paris
npm run data:city-photos -- --only tokyo
npm run data:city-photos -- --only manhattan
npm run data:city-photos -- --only greenwich,mitaddelmundo,rovaniemi,delhi,sydney,giza
```
Expected, from the planning measurements: Katowice about 300 KiB at 1440 × 960 and 4.17 m/px; each of Warsaw,
Kraków, Paris, Tokyo, Manhattan about 200–250 KiB at 1200 × 800 and 5.0 m/px; each Sentinel box about 50–70 KiB at
600 × 400 and 10.0 m/px; the total under 1.9 MiB.

Then **open all twelve** (`Read` the `.webp` files directly) and write in the report, per box:
1. Is the named feature in the middle of the frame? (The Eiffel Tower, the pyramids, the Observatory courtyard,
   the equator monument, the Arctic Circle site, the school's own block in Katowice.)
2. Cloud, haze, snow or deep shadow over the middle of the box.
3. For the six orthophoto boxes: are individual buildings readable? For the six Sentinel boxes: are the main roads,
   the built-up areas and the water readable?
4. Any seam, black edge or missing tile (a tile that failed silently).
If a box fails 1–4, re-run it: for Sentinel with `--refresh` (which re-searches and may pick the next scene), for a
tile source at one zoom level higher. If a source is unusable, change that box's `source` to `'sentinel'` in
`scripts/city-boxes.ts`, re-run `data:city-boxes` and `data:city-photos --only <id>`, and say so in the report.
**Never raise `photoWidth` above what the source can resolve.**

- [ ] **Step 6: Confirm the GUGiK attribution wording**

The capabilities say `AccessConstraints: brak ograniczeń` and `Fees: Korzystanie z usługi danych przestrzennych
oznacza akceptację bez ograniczeń i zastrzeżeń Regulaminu dostępnego na stronie internetowej Geoportalu
http://www.geoportal.gov.pl/`. Fetch that regulations page, find the clause about naming the source, and check it
against the credit this plan uses: `Ortofotomapa: Główny Urząd Geodezji i Kartografii, geoportal.gov.pl`. If the
regulations ask for different or longer wording, use theirs, update `SOURCES['gugik']['licence']`, re-run
`data:city-photos --only katowice,warsaw,krakow` (the manifest carries the licence string) and **say so in the
report** so Tasks 3 and 7 copy the same text into the licence comment, `LICENSE-CONTENT.md`, the README and the
footer.

- [ ] **Step 7: `src/map/cityBoxes.ts` — the boxes at runtime**

```ts
import boxesJson from './data/city/boxes.json';
import { boundsIntersect, type GeoBounds } from './geometry';
import type { LatLon } from '../geo/types';

/*
 * The twelve city close-up boxes (Places up close spec §3). The geometry comes from
 * src/map/data/city/boxes.json, which scripts/city-boxes.ts writes and both data builds read, so the photo, the
 * streets and the page can never disagree about where a box is.
 */
export type CityBoxId = 'katowice' | 'greenwich' | 'mitaddelmundo' | 'rovaniemi' | 'warsaw' | 'krakow'
  | 'paris' | 'manhattan' | 'delhi' | 'sydney' | 'tokyo' | 'giza';

export interface CityBox {
  id: CityBoxId;
  lat: number;
  lon: number;
  bounds: GeoBounds;
  /** The flat zoom at which the box just fills a 960 x 480 view (both axes). */
  fitZoom: number;
  /** One of the three teaching places with a coordinate line painted on the ground (spec §1). */
  note: boolean;
}

/** Streets fade in from here (spec §5); below it a box is not "in view" at all, which is what keeps the Atlas baselines still (planning ruling R3). */
export const CITY_STREET_ZOOM = 24;
/** The photo starts to fade in here and is fully mixed at CITY_PHOTO_FULL_ZOOM (spec §5). */
export const CITY_PHOTO_ZOOM = 40;
export const CITY_PHOTO_FULL_ZOOM = 80;

/**
 * The flat zoom at which `b` just fills the 960 x 480 view: zoom 1 spans 360° across the width and 180° down the
 * height, so the smaller of the two ratios is the fit. Measured for the twelve: 2 659 (Rovaniemi, the widest box
 * in degrees) to 5 009 (every box whose 4 km height binds first).
 */
export function fitZoom(b: GeoBounds): number {
  return Math.min(360 / (b.east - b.west), 180 / (b.north - b.south));
}

export const CITY_BOXES: readonly CityBox[] = boxesJson.boxes.map((b) => {
  const bounds: GeoBounds = { west: b.west, south: b.south, east: b.east, north: b.north };
  return { id: b.id as CityBoxId, lat: b.lat, lon: b.lon, bounds, fitZoom: fitZoom(bounds), note: b.note };
});

export const CITY_BOX_IDS: readonly CityBoxId[] = CITY_BOXES.map((b) => b.id);

export function cityBoxById(id: string): CityBox | null {
  return CITY_BOXES.find((b) => b.id === id) ?? null;
}

const inside = (b: GeoBounds, p: LatLon) => p.lon >= b.west && p.lon <= b.east && p.lat >= b.south && p.lat <= b.north;

/**
 * The box the view's centre is standing in, or null. Used for the teaching note, the credit line and the map's
 * text description — the things that describe where the pupil *is*, not what is painted.
 */
export function cityBoxAt(p: LatLon, zoom: number): CityBox | null {
  if (zoom < CITY_STREET_ZOOM) return null;
  return CITY_BOXES.find((b) => inside(b.bounds, p)) ?? null;
}

/**
 * The box to draw for a view covering `view`, or null. Boxes are 250 km apart at the closest (Warsaw and Kraków),
 * and a view deep enough to reach CITY_STREET_ZOOM spans at most 15°, so at most one box can ever match.
 */
export function visibleCityBox(view: GeoBounds, zoom: number): CityBox | null {
  if (zoom < CITY_STREET_ZOOM) return null;
  return CITY_BOXES.find((b) => boundsIntersect(view, b.bounds)) ?? null;
}
```

- [ ] **Step 8: The failing tests**

`tests/unit/city-boxes.test.ts`:
```ts
import { describe, expect, test } from 'vitest';
import boxesJson from '../../src/map/data/city/boxes.json';
import { boxAround, CITY_BOX_HEIGHT_M, CITY_BOX_SPECS, CITY_BOX_WIDTH_M } from '../../scripts/city-boxes';
import {
  CITY_BOXES, CITY_BOX_IDS, CITY_PHOTO_ZOOM, CITY_STREET_ZOOM, cityBoxAt, cityBoxById, fitZoom, visibleCityBox,
} from '../../src/map/cityBoxes';

const RAD = Math.PI / 180;
const box = (id: string) => CITY_BOXES.find((b) => b.id === id)!;

describe('city boxes', () => {
  test('the twelve of spec §3, in its order, three of them with a teaching note', () => {
    expect(CITY_BOX_IDS).toEqual(['katowice', 'greenwich', 'mitaddelmundo', 'rovaniemi', 'warsaw', 'krakow',
      'paris', 'manhattan', 'delhi', 'sydney', 'tokyo', 'giza']);
    expect(CITY_BOXES.filter((b) => b.note).map((b) => b.id)).toEqual(['greenwich', 'mitaddelmundo', 'rovaniemi']);
    expect(cityBoxById('katowice')).toBe(box('katowice'));
    expect(cityBoxById('atlantis')).toBeNull();
  });

  test('every box is 6 x 4 km in metres, whatever its latitude', () => {
    for (const b of CITY_BOXES) {
      const heightM = (b.bounds.north - b.bounds.south) * 111_320;
      const widthM = (b.bounds.east - b.bounds.west) * 111_320 * Math.cos(b.lat * RAD);
      expect(heightM, b.id).toBeCloseTo(CITY_BOX_HEIGHT_M, 0);
      expect(widthM, b.id).toBeCloseTo(CITY_BOX_WIDTH_M, 0);
      expect((b.bounds.west + b.bounds.east) / 2, b.id).toBeCloseTo(b.lon, 6);
      expect((b.bounds.south + b.bounds.north) / 2, b.id).toBeCloseTo(b.lat, 6);
    }
  });

  test('boxes.json is exactly what scripts/city-boxes.ts produces (run npm run data:city-boxes if this fails)', () => {
    expect(boxesJson.widthM).toBe(CITY_BOX_WIDTH_M);
    expect(boxesJson.heightM).toBe(CITY_BOX_HEIGHT_M);
    expect(boxesJson.boxes.map((b) => b.id)).toEqual(CITY_BOX_SPECS.map((s) => s.id));
    for (const s of CITY_BOX_SPECS) {
      const b = boxesJson.boxes.find((x) => x.id === s.id)!;
      const { west, south, east, north, ...spec } = b;
      expect(spec, s.id).toEqual({ ...s });
      expect({ west, south, east, north }, s.id).toEqual(boxAround(s.lat, s.lon, CITY_BOX_WIDTH_M, CITY_BOX_HEIGHT_M));
    }
  });

  test('fit zoom: the box just fills a 960 x 480 view', () => {
    expect(Math.round(fitZoom(box('katowice').bounds))).toBe(4270);
    expect(Math.round(fitZoom(box('rovaniemi').bounds))).toBe(2659);          // the widest box in degrees
    expect(Math.round(fitZoom(box('mitaddelmundo').bounds))).toBe(5009);      // height-bound, like most boxes
    expect(Math.max(...CITY_BOXES.map((b) => fitZoom(b.bounds)))).toBeLessThan(6000);  // under FLAT_MAX_ZOOM
  });

  test('membership needs the street zoom, so nothing is in a box at the Atlas baseline zoom of 12', () => {
    const k = box('katowice');
    expect(cityBoxAt({ lat: 50.26, lon: 19.02 }, 12)).toBeNull();
    expect(visibleCityBox({ west: 4, south: 35, east: 34, north: 65 }, 12)).toBeNull();
    expect(cityBoxAt({ lat: 50.26, lon: 19.02 }, CITY_STREET_ZOOM)).toBe(k);
    expect(cityBoxAt({ lat: 50.26, lon: 19.02 }, CITY_PHOTO_ZOOM)).toBe(k);
    // Just outside the box's own bounds, at a zoom that would allow it.
    expect(cityBoxAt({ lat: 50.26, lon: k.bounds.east + 0.001 }, 4000)).toBeNull();
    expect(visibleCityBox(k.bounds, 4000)).toBe(k);
    expect(visibleCityBox({ west: 20, south: 50, east: 21, north: 51 }, 4000)).toBeNull();
  });

  test('no two boxes overlap, so at most one is ever in view', () => {
    for (let i = 0; i < CITY_BOXES.length; i++) {
      for (let j = i + 1; j < CITY_BOXES.length; j++) {
        const a = CITY_BOXES[i]!.bounds, b = CITY_BOXES[j]!.bounds;
        expect(a.east < b.west || b.east < a.west || a.north < b.south || b.north < a.south,
          `${CITY_BOXES[i]!.id} vs ${CITY_BOXES[j]!.id}`).toBe(true);
      }
    }
  });
});
```

`tests/unit/city-photos-data.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import boxesJson from '../../src/map/data/city/boxes.json';
import manifest from '../../src/map/data/city/photos/manifest.json';
import { webpSize } from '../../scripts/webp-size';

const DIR = 'src/map/data/city/photos/';
// Planning ruling R22: the ceilings the 8 MiB budget is built on.
const MAX_BYTES: Record<string, number> = { katowice: 340 * 1024, sentinel: 90 * 1024, ortho: 260 * 1024 };
const entries = Object.entries(manifest.photos);

describe('city photos', () => {
  test('one photo per box, in the boxes.json order, matching its box exactly', () => {
    expect(entries.map(([id]) => id)).toEqual(boxesJson.boxes.map((b) => b.id));
    for (const [id, p] of entries) {
      const b = boxesJson.boxes.find((x) => x.id === id)!;
      expect(p.bounds, id).toEqual([b.west, b.south, b.east, b.north]);
      expect([p.width, p.height], id).toEqual([b.photoWidth, b.photoHeight]);
      expect(p.source, id).toBe(b.source);
      expect(p.mime, id).toBe('image/webp');
    }
  });

  test('the files on disk are the size and shape the manifest claims, and 3:2 like the box', () => {
    for (const [id, p] of entries) {
      const file = readFileSync(DIR + p.file);
      expect(webpSize(file), id).toEqual({ width: p.width, height: p.height });
      expect(p.bytes, id).toBe(file.length);
      expect(p.width / p.height, id).toBeCloseTo(1.5, 6);
    }
  });

  test('ground resolution is what the source can really give; Sentinel boxes are never enlarged', () => {
    for (const [id, p] of entries) {
      expect(p.groundM, id).toBeCloseTo(boxesJson.widthM / p.width, 2);
      if (p.source === 'sentinel') {
        expect([p.width, p.height], id).toEqual([600, 400]);   // exactly 10 m per pixel: the source's own
        expect(p.groundM, id).toBeCloseTo(10, 1);
      } else {
        expect(p.groundM, id).toBeLessThanOrEqual(5.01);
      }
    }
    expect(manifest.photos.katowice.groundM).toBeCloseTo(4.17, 2);
  });

  test('every photo records a source, a name and a licence, and stays inside its byte ceiling', () => {
    for (const [id, p] of entries) {
      expect(['gugik', 'ign', 'gsi', 'naip', 'sentinel'], id).toContain(p.source);
      expect(p.sourceName.length, id).toBeGreaterThan(8);
      expect(p.licence.length, id).toBeGreaterThan(20);
      if (p.source === 'sentinel') {
        expect(p.licence, id).toMatch(/^Contains modified Copernicus Sentinel data \d{4}(-\d{4})?$/);
        expect(p.cloud, id).toBeLessThan(5);
        expect(p.captured, id).toMatch(/^\d{4}-\d\d-\d\d$/);
      }
      const cap = id === 'katowice' ? MAX_BYTES.katowice! : p.source === 'sentinel' ? MAX_BYTES.sentinel! : MAX_BYTES.ortho!;
      expect(p.bytes, `${id} (${(p.bytes / 1024).toFixed(1)} KiB)`).toBeLessThanOrEqual(cap);
    }
  });

  test('all twelve together stay inside the photo half of the budget', () => {
    const total = entries.reduce((n, [, p]) => n + p.bytes, 0);
    // Planning ruling R22: 1.9 MiB raw, about 2.5 MiB once base64 puts it in the page.
    expect(total, `${(total / 1024 / 1024).toFixed(2)} MiB`).toBeLessThan(1.9 * 1024 * 1024);
  });

  test('at least six boxes are sharp enough to show buildings', () => {
    const sharp = entries.filter(([, p]) => p.groundM <= 5.01);
    expect(sharp.map(([id]) => id).sort()).toEqual(['katowice', 'krakow', 'manhattan', 'paris', 'tokyo', 'warsaw']);
  });
});
```

- [ ] **Step 9: Run the tests**

```bash
npx vitest run tests/unit/city-boxes.test.ts tests/unit/city-photos-data.test.ts
```
Expected: PASS. If a photo is over its ceiling, lower that box's `quality` by 5 in `scripts/city-boxes.ts`
(never below 55), re-run `data:city-boxes` and `data:city-photos --only <id>`, and look at the photo again.

- [ ] **Step 10: Check the whole suite and commit**

```bash
npm run check && npm test
git add scripts/city-boxes.ts scripts/cog.py scripts/tiles.py scripts/build-city-photos.py \
  src/map/data/city/boxes.json src/map/data/city/photos src/map/cityBoxes.ts \
  tests/unit/city-boxes.test.ts tests/unit/city-photos-data.test.ts package.json
git commit -m "feat(data): twelve city close-up boxes and their aerial photos"
```

**Report:** the twelve boxes with source, size, ground resolution and bytes; the total and what it becomes as
base64; the Sentinel scenes' dates and cloud cover; what you saw in each of the twelve photos (Step 5's four
questions); the GUGiK attribution wording you confirmed in Step 6; and any box whose source had to change.
