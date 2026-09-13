import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import topoJson from 'world-atlas/countries-110m.json';

const topo = topoJson as unknown as Topology<{ countries: GeometryCollection; land: GeometryCollection }>;

export const land = feature(topo, topo.objects.land);
export const borders = mesh(topo, topo.objects.countries, (a, b) => a !== b);
export const sphere = { type: 'Sphere' } as const;
