import { describe, expect, test } from 'vitest';
import type { Position } from 'geojson';
import { coastlineWater, relationPolygons, waterAreaM2, type Box } from '../../scripts/build-city-streets';

/*
 * The two pieces of scripts/build-city-streets.ts that turn OpenStreetMap's water into shapes a map can fill.
 * They exist because the release shipped Sydney Harbour, the Hudson, the East River and the Seine as dry land:
 * ruling R16 asked Overpass for closed `natural=water` ways only, and the big water of a city is never one.
 *
 * `coastlineWater` is the hard half. OSM has no polygon for the sea anywhere — a coast is an open line with the
 * land on its left — so inside a 6 x 4 km box a harbour is a few lines that cross the box and nothing else. The
 * cases below are a unit box with a coast through it, which is small enough to check by hand and covers every
 * branch the twelve real boxes between them do not.
 */
const BOX: Box = [0, 0, 1, 1];
/** Area of a water result as a share of the box, through the same measure the data test uses. */
const share = (polys: Position[][][], box: Box = BOX): number => {
  const topo = {
    type: 'Topology' as const,
    objects: {
      water: {
        type: 'GeometryCollection' as const,
        geometries: polys.map((rings) => ({ type: 'Polygon' as const, arcs: rings.map((_r, i) => [i]) })),
      },
    },
    arcs: polys.flat().map((r) => r.map((p) => [p[0]!, p[1]!] as [number, number])),
  };
  // One polygon per entry, its rings in order: rebuild the arc indexes to match the flattened arc list.
  let next = 0;
  for (const g of topo.objects.water.geometries) g.arcs = g.arcs.map(() => [next++]);
  return waterAreaM2(topo as never, box) / ((box[2] - box[0]) * (box[3] - box[1]) * 111320 * 111320);
};

describe('water built from coastlines', () => {
  // Land on the left: running west to east, the land is north and the water is south.
  const westToEast: Position[] = [[-0.5, 0.5], [1.5, 0.5]];
  const eastToWest: Position[] = [[1.5, 0.5], [-0.5, 0.5]];

  test('a coast across the box fills the side the water is on, and only that side', () => {
    const south = coastlineWater([westToEast], BOX);
    expect(south).toHaveLength(1);
    expect(share(south)).toBeCloseTo(0.5, 2);
    // Every vertex of the ring is at or below the coast: the northern half is land.
    expect(south[0]![0]!.every((p) => p[1]! <= 0.5 + 1e-9)).toBe(true);
  });

  test('the same coast drawn the other way puts the water on the other side', () => {
    const north = coastlineWater([eastToWest], BOX);
    expect(north).toHaveLength(1);
    expect(share(north)).toBeCloseTo(0.5, 2);
    expect(north[0]![0]!.every((p) => p[1]! >= 0.5 - 1e-9)).toBe(true);
  });

  test('ways are joined end to end before they are closed, whichever order they arrive in', () => {
    const halves: Position[][] = [[[0.5, 0.5], [1.5, 0.5]], [[-0.5, 0.5], [0.5, 0.5]]];
    expect(share(coastlineWater(halves, BOX))).toBeCloseTo(share(coastlineWater([westToEast], BOX)), 6);
  });

  test('an island inside the water becomes a hole in it, not a second shape', () => {
    // A closed coast wound anticlockwise is land (the land is on its left), 0.2 x 0.2 of the box.
    const island: Position[] = [[0.4, 0.1], [0.6, 0.1], [0.6, 0.3], [0.4, 0.3], [0.4, 0.1]];
    const out = coastlineWater([westToEast, island], BOX);
    expect(out).toHaveLength(1);
    expect(out[0]).toHaveLength(2);
    expect(share(out)).toBeCloseTo(0.5 - 0.04, 2);
  });

  test('a coast that stops inside the box gives nothing rather than an invented shoreline', () => {
    // Overpass did not return the way that continues this one, so where the water is cannot be known.
    expect(coastlineWater([[[-0.5, 0.5], [0.5, 0.5]]], BOX)).toEqual([]);
    expect(coastlineWater([], BOX)).toEqual([]);
  });

  test('two coasts across the box leave the strip between them dry', () => {
    // Water south of y=0.2 and north of y=0.8; the middle three fifths are land.
    const out = coastlineWater([[[-0.5, 0.2], [1.5, 0.2]], [[1.5, 0.8], [-0.5, 0.8]]], BOX);
    expect(out).toHaveLength(2);
    expect(share(out)).toBeCloseTo(0.4, 2);
  });
});

describe('water built from multipolygon relations', () => {
  const rel = (members: { role: string; points: Position[] }[]) => ({
    type: 'relation' as const, id: 1, tags: { type: 'multipolygon', natural: 'water' },
    members: members.map((m) => ({ type: 'way', ref: 0, role: m.role, geometry: m.points.map((p) => ({ lon: p[0]!, lat: p[1]! })) })),
  });

  test('member ways are chained into an outline, and an inner role becomes a hole', () => {
    const out = relationPolygons(rel([
      { role: 'outer', points: [[0.1, 0.1], [0.9, 0.1]] },
      { role: 'outer', points: [[0.9, 0.1], [0.9, 0.9], [0.1, 0.9], [0.1, 0.1]] },
      { role: 'inner', points: [[0.4, 0.4], [0.6, 0.4], [0.6, 0.6], [0.4, 0.6], [0.4, 0.4]] },
    ]), BOX);
    expect(out).toHaveLength(1);
    expect(out[0]).toHaveLength(2);
    expect(share(out)).toBeCloseTo(0.64 - 0.04, 2);
  });

  test('a member with no role at all is an outer, which is what type=multipolygon means', () => {
    const out = relationPolygons(rel([{ role: '', points: [[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8], [0.2, 0.2]] }]), BOX);
    expect(share(out)).toBeCloseTo(0.36, 2);
  });

  test('a relation is clipped to the box, however far past it the water runs', () => {
    const out = relationPolygons(rel([{ role: 'outer', points: [[-5, -5], [5, -5], [5, 5], [-5, 5], [-5, -5]] }]), BOX);
    // Not exactly 1: `share` divides by a flat box while `waterAreaM2` scales each row for its own latitude,
    // which over a whole degree of this unit box is 4 parts in 100 000. A real box is a thirtieth as tall.
    expect(share(out)).toBeCloseTo(1, 3);
  });

  test('an outline with no closed ring is dropped rather than closed on a guess', () => {
    expect(relationPolygons(rel([{ role: 'outer', points: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9]] }]), BOX)).toEqual([]);
  });
});
