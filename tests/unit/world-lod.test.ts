import { describe, expect, test } from 'vitest';
import { decodeArcs, levelOfDetail, polygonParts, type ArcTopology } from '../../src/map/world';

describe('decodeArcs', () => {
  test('a quantized topology is delta-decoded, then scaled and shifted', () => {
    const topo: ArcTopology = { transform: { scale: [0.5, 0.25], translate: [-180, -90] }, arcs: [[[0, 0], [2, 4], [2, 4]]] };
    expect(decodeArcs(topo)).toEqual([[[-180, -90], [-179, -89], [-178, -88]]]);
  });

  // `transform` is optional because an unquantized topology already stores absolute coordinates, one point at a
  // time: summing those would silently bend every shape into a running total.
  test('a topology without a transform keeps its coordinates as they are', () => {
    const topo: ArcTopology = { arcs: [[[10, 50], [11, 51], [12, 50]], [[-3, 40], [-2, 41]]] };
    expect(decodeArcs(topo)).toEqual([[[10, 50], [11, 51], [12, 50]], [[-3, 40], [-2, 41]]]);
  });

  test('the decoded arcs are a fresh copy, never the source arrays', () => {
    const topo: ArcTopology = { arcs: [[[10, 50], [11, 51]]] };
    const decoded = decodeArcs(topo);
    decoded[0]![0]![0] = 99;
    expect(topo.arcs[0]![0]![0]).toBe(10);
  });
});

describe('levelOfDetail', () => {
  // Six points 0.05° apart along the equator. Half a pixel is 0.1875° at zoom 1, so only every fourth point (and
  // the arc's end) survives there; at zoom 24 it is 0.0078°, and every point stays.
  const dense = (): ArcTopology => ({ arcs: [[[0, 0], [0.05, 0], [0.1, 0], [0.15, 0], [0.2, 0], [0.25, 0]]] });

  test('serves the highest level the zoom has reached, thins its arcs and builds once per level', () => {
    let built = 0;
    const data = levelOfDetail(dense(), [1, 3, 8, 24], (t) => { built++; return { points: t.arcs[0]!.length }; });
    expect(data(1).points).toBe(3);
    expect(data(2)).toBe(data(1));
    expect(built).toBe(1);
    expect(data(24).points).toBe(6);
    expect(data(100)).toBe(data(24));
    expect(built).toBe(2);
  });

  test('a zoom below the first level still gets the coarsest one, and the copy drops the transform', () => {
    const seen: ArcTopology[] = [];
    const data = levelOfDetail({ transform: { scale: [1, 1], translate: [0, 0] }, arcs: [[[0, 0], [1, 1]]] }, [4, 8], (t) => { seen.push(t); return t; });
    expect(data(0.5)).toBe(data(4));
    expect(seen).toHaveLength(1);
    expect(seen[0]!.transform).toBeUndefined();
    expect(seen[0]!.arcs).toEqual([[[0, 0], [1, 1]]]);
  });

  test('nothing is decoded until a level is asked for', () => {
    const topo = { arcs: [[[0, 0], [1, 1]]], get transform(): undefined { throw new Error('decoded too early'); } } as unknown as ArcTopology;
    expect(() => levelOfDetail(topo, [1], (t) => t)).not.toThrow();
  });
});

describe('polygonParts', () => {
  const square: GeoJSON.Position[] = [[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]; // clockwise: d3's outline
  const hole: GeoJSON.Position[] = [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8], [0.2, 0.2]];

  test('keeps a well-wound outline and its hole as they are', () => {
    const parts = polygonParts({ type: 'MultiPolygon', coordinates: [[square, hole]] });
    expect(parts).toHaveLength(1);
    expect(parts[0]!.coordinates).toEqual([square, hole]);
    expect(parts[0]!.bounds).toEqual({ west: 0, south: 0, east: 1, north: 1 });
  });

  test('turns a ring that thinning left the wrong way round, and drops one with no area left', () => {
    const parts = polygonParts({ type: 'MultiPolygon', coordinates: [[[...square].reverse(), [...hole].reverse()]] });
    expect(parts[0]!.coordinates).toEqual([square, hole]);
    const flat: GeoJSON.Position[] = [[0, 0], [1, 1], [0, 0], [0, 0]];
    expect(polygonParts({ type: 'MultiPolygon', coordinates: [[flat]] })).toEqual([]);
    expect(polygonParts({ type: 'MultiPolygon', coordinates: [[square, flat]] })[0]!.coordinates).toEqual([square]);
  });
});
