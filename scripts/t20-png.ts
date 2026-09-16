/*
 * A minimal PNG reader for the Task 20 review scripts: 8-bit RGB / RGBA, non-interlaced — which is what Chromium's
 * screenshots are. Node has no image decoder and the project has no image dependency, so the few lines it takes to
 * unfilter a scanline are cheaper than adding one. Throw-away tooling for the design pass.
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export interface Pixels { width: number; height: number; data: Uint8Array }

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

export const PNG = {
  /** The image at `path` as tightly packed RGBA rows. */
  read(path: string): Pixels {
    return PNG.decode(readFileSync(path));
  },
  /** The same, from bytes already in hand — a Playwright screenshot buffer, say. */
  decode(buf: Buffer): Pixels {
    let pos = 8, width = 0, height = 0, channels = 0;
    const idat: Buffer[] = [];
    while (pos < buf.length) {
      const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), body = buf.subarray(pos + 8, pos + 8 + len);
      pos += 12 + len;
      if (type === 'IHDR') {
        width = body.readUInt32BE(0); height = body.readUInt32BE(4);
        const depth = body[8]!, colour = body[9]!, interlace = body[12]!;
        if (depth !== 8 || interlace !== 0 || (colour !== 2 && colour !== 6)) throw new Error(`unsupported PNG (depth ${depth}, colour ${colour}, interlace ${interlace})`);
        channels = colour === 6 ? 4 : 3;
      } else if (type === 'IDAT') idat.push(body);
      else if (type === 'IEND') break;
    }
    const raw = inflateSync(Buffer.concat(idat));
    const stride = width * channels;
    const out = new Uint8Array(width * height * 4);
    const line = new Uint8Array(stride), prev = new Uint8Array(stride);
    for (let y = 0; y < height; y++) {
      const filter = raw[y * (stride + 1)]!;
      const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
      for (let i = 0; i < stride; i++) {
        const x = src[i]!, a = i >= channels ? line[i - channels]! : 0, b = prev[i]!, c = i >= channels ? prev[i - channels]! : 0;
        line[i] = (filter === 0 ? x : filter === 1 ? x + a : filter === 2 ? x + b : filter === 3 ? x + ((a + b) >> 1) : x + paeth(a, b, c)) & 0xff;
      }
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4, s = x * channels;
        out[o] = line[s]!; out[o + 1] = line[s + 1]!; out[o + 2] = line[s + 2]!; out[o + 3] = channels === 4 ? line[s + 3]! : 255;
      }
      prev.set(line);
    }
    return { width, height, data: out };
  },
};
