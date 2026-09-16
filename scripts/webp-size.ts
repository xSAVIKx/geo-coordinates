// Width and height of a WebP file from its RIFF header (lossy 'VP8 ', lossless 'VP8L' or extended 'VP8X'),
// so tests and the size report can check textures without an image library.
export function webpSize(buf: Uint8Array): { width: number; height: number } {
  const ascii = (at: number, n: number) => String.fromCharCode(...buf.subarray(at, at + n));
  if (buf.length < 30 || ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WEBP') throw new Error('webpSize: not a WebP file');
  const chunk = ascii(12, 4);
  const b = (i: number) => buf[i]!;
  if (chunk === 'VP8 ') {
    if (b(23) !== 0x9d || b(24) !== 0x01 || b(25) !== 0x2a) throw new Error('webpSize: bad VP8 start code');
    return { width: (b(26) | (b(27) << 8)) & 0x3fff, height: (b(28) | (b(29) << 8)) & 0x3fff };
  }
  if (chunk === 'VP8L') {
    if (b(20) !== 0x2f) throw new Error('webpSize: bad VP8L signature');
    const bits = (b(21) | (b(22) << 8) | (b(23) << 16) | (b(24) << 24)) >>> 0;
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') {
    return { width: 1 + (b(24) | (b(25) << 8) | (b(26) << 16)), height: 1 + (b(27) | (b(28) << 8) | (b(29) << 16)) };
  }
  throw new Error(`webpSize: unknown chunk ${chunk}`);
}
