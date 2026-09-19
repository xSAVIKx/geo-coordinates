import { expect, test } from 'vitest';
import { formatBreakdown, sizeBreakdown } from '../../scripts/size-report';

test('the built file is broken down into textures, app script, styles and the rest, adding up to the whole', () => {
  const html = '<!doctype html><head><style>a{}</style><script type="module">let x="é";</script></head><body>'
    + '<script type="application/x-geo-texture" id="geo-texture-satellite-day" data-width="2" data-height="1">QUJD</script>\n</body>';
  const parts = sizeBreakdown(html);
  expect(parts.map((p) => p.name)).toEqual(['texture satellite-day', 'app script and vector data', 'styles', 'html and head']);
  expect(parts[0]!.bytes).toBe(Buffer.byteLength('<script type="application/x-geo-texture" id="geo-texture-satellite-day" data-width="2" data-height="1">QUJD</script>\n'));
  expect(parts[1]!.bytes).toBe(Buffer.byteLength('<script type="module">let x="é";</script>'));
  expect(parts.reduce((n, p) => n + p.bytes, 0)).toBe(Buffer.byteLength(html));
  const text = formatBreakdown(parts, Buffer.byteLength(html));
  expect(text).toMatch(/texture satellite-day\s+0\.1 KiB/);
});

test('city photos and street data get a line each, named by their place', () => {
  const html = [
    '<html><body>',
    '<script type="application/x-geo-texture" id="geo-texture-physical-world">AAAA</script>',
    '<script type="application/x-geo-photo" id="geo-photo-katowice" data-width="1440" data-height="960">BBBB</script>',
    '<script type="application/x-geo-city" id="geo-city-katowice">BBBB</script>',
    '<script type="module">const a = 1;</script>',
    '<style>body{margin:0}</style>',
    '</body></html>',
  ].join('\n');
  const names = sizeBreakdown(html).map((p) => p.name);
  expect(names).toEqual(['texture physical-world', 'photo katowice', 'streets katowice',
    'app script and vector data', 'styles', 'html and head']);
  const photo = sizeBreakdown(html).find((p) => p.name === 'photo katowice')!;
  expect(photo.bytes).toBeGreaterThan(90);          // the tag plus its four base64 characters
});
