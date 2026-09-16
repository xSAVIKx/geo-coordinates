import { MERCATOR_MAX_LAT, RAD, type GeoBounds, type ViewCtx } from '../geometry';

/*
 * Map styles spec §4 "Single source of truth": the texture layer reads the view from the same ViewCtx (and so the same
 * d3 projection) the SVG layers draw with, so the image and the vectors cannot drift.
 */
export type ProjectionCode = 0 | 1 | 2 | 3;
export const PROJECTION_CODE = { grid: 0, 'equal-earth': 1, mercator: 2, globe: 3 } as const;

export interface TextureView {
  projection: ProjectionCode;
  width: number;
  height: number;
  scale: number;
  origin: [number, number];
  rotate: [number, number];
  maxLat: number;
  zoom: number;
  bounds: GeoBounds;
}

export function textureView(ctx: ViewCtx): TextureView {
  const p = ctx.projection;
  if (ctx.kind === 'globe') {
    const [lambda = 0, phi = 0] = p.rotate();
    const [tx, ty] = p.translate();
    return { projection: 3, width: ctx.width, height: ctx.height, scale: p.scale(), origin: [tx, ty], rotate: [lambda * RAD, phi * RAD], maxLat: Math.PI / 2, zoom: ctx.zoom, bounds: ctx.bounds };
  }
  const kind = ctx.flatProjection ?? 'grid';
  const o = p([0, 0])!;
  return { projection: PROJECTION_CODE[kind], width: ctx.width, height: ctx.height, scale: p.scale(), origin: [o[0], o[1]], rotate: [0, 0], maxLat: (kind === 'mercator' ? MERCATOR_MAX_LAT : 90) * RAD, zoom: ctx.zoom, bounds: ctx.bounds };
}
