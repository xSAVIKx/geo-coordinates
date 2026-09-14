import { geoDistance } from 'd3-geo';
import { describe, expect, test } from 'vitest';
import data from '../../src/map/data/maple-bear-schools.json';
import { retrieved, schools as slim } from 'virtual:maple-bear-schools';
import { schoolsModuleCode, slimSchools } from '../../scripts/schools-plugin.ts';
import { makeFlatCtx, makeGlobeCtx } from '../../src/map/geometry';
import { gridCluster } from '../../src/map/gridCluster';
import { FLAT_MAX_ZOOM, GLOBE_MAX_ZOOM, MapState } from '../../src/map/mapState.svelte';
import { CHOSEN_CLEARANCE, chosenSchoolMark, clearOfChosen, clusterClick, clusterSchools, clusterZoomTarget, isolatingFlatZoom, isolatingGlobeZoom, SCHOOL_CELL, SCHOOL_CELL_DEEP, SCHOOL_DEEP_ZOOM, schoolCell, SCHOOLS } from '../../src/map/schools';

const katowice = () => SCHOOLS.find((s) => s.id === 'pl-katowice')!;
const total = (clusters: { members: unknown[] }[]) => clusters.reduce((n, c) => n + c.members.length, 0);

describe('slim schools module', () => {
  test('bundles only id, name, country and position, for every school', () => {
    expect(retrieved).toBe(data.retrieved);
    expect(slim).toHaveLength(data.schools.length);
    expect(slim).toEqual(slimSchools(data).schools);
    expect(slim[0]).toHaveLength(5);
    const code = schoolsModuleCode(data);
    expect(code).not.toContain('https://');
    expect(code.length).toBeLessThan(JSON.stringify(data).length * 0.45);
    expect(SCHOOLS.find((s) => s.id === 'pl-katowice')).toEqual({ id: 'pl-katowice', name: 'Maple Bear Katowice', country: 'PL', lat: 50.2604, lon: 19.0185 });
  });
});

describe('gridCluster', () => {
  test('groups points in a cell and merges close neighbours across a cell edge', () => {
    const pts: [number, number][] = [[1, 1], [2, 2], [9.5, 1], [10.5, 1], [35, 35]];
    const clusters = gridCluster(pts, (p) => p, 10, 10);
    expect(clusters.map((c) => c.members.length).sort()).toEqual([1, 4]);
    const big = clusters.find((c) => c.members.length === 4)!;
    expect(big.x).toBeCloseTo((1 + 2 + 9.5 + 10.5) / 4);
  });

  test('skips points without a position and keeps far points apart', () => {
    const pts: ([number, number] | null)[] = [[0, 0], null, [100, 100]];
    const clusters = gridCluster(pts, (p) => p, 10);
    expect(clusters).toHaveLength(2);
  });
});

describe('school clusters', () => {
  test('world zoom: every school counted, grouped into count badges', () => {
    const ctx = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1.2, 'grid');
    const clusters = clusterSchools(ctx);
    expect(total(clusters)).toBe(SCHOOLS.length);
    expect(clusters.length).toBeLessThan(80);
    expect(clusters.length).toBeGreaterThan(10);
    // Brazil's schools make up the biggest badges.
    const biggest = [...clusters].sort((a, b) => b.members.length - a.members.length)[0]!;
    expect(biggest.members.length).toBeGreaterThan(40);
    expect(biggest.members.filter((s) => s.country === 'BR').length / biggest.members.length).toBeGreaterThan(0.95);
    // After merging, no two badges are drawn on top of each other.
    for (const a of clusters) for (const b of clusters) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y) / 1.2, `${a.key} ${b.key}`).toBeGreaterThanOrEqual(0.8 * SCHOOL_CELL - 1e-9);
  });

  test('high zoom over Katowice: the school stands alone', () => {
    const ctx = makeFlatCtx(960, 480, katowice(), 60, 1.2, 'grid');
    const clusters = clusterSchools(ctx);
    const own = clusters.find((c) => c.members.some((s) => s.id === 'pl-katowice'))!;
    expect(own.members).toHaveLength(1);
    const xy = ctx.project(katowice())!;
    expect(own.x).toBeCloseTo(xy[0], 6);
    expect(own.y).toBeCloseTo(xy[1], 6);
  });

  test('a pan never regroups the flat map (only shifts the groups)', () => {
    for (const projection of ['grid', 'equal-earth', 'mercator'] as const) {
      const a = makeFlatCtx(960, 480, { lat: 50, lon: 15 }, 6, 1.1, projection);
      const b = makeFlatCtx(960, 480, { lat: 47.3, lon: 21.7 }, 6, 1.1, projection);
      const ka = clusterSchools(a, null, Infinity), kb = clusterSchools(b, null, Infinity);
      const groups = (cs: typeof ka) => cs.map((c) => c.members.map((s) => s.id).join(',')).sort();
      expect(groups(kb)).toEqual(groups(ka));
      const shift = [a.project(katowice())!, b.project(katowice())!];
      const ca = ka.find((c) => c.key === 'pl-katowice' || c.members.some((s) => s.id === 'pl-katowice'))!;
      const cb = kb.find((c) => c.key === ca.key)!;
      expect(cb.x - ca.x).toBeCloseTo(shift[1]![0] - shift[0]![0], 6);
      expect(cb.y - ca.y).toBeCloseTo(shift[1]![1] - shift[0]![1], 6);
    }
  });

  test('the globe groups only the front side', () => {
    const ctx = makeGlobeCtx(500, [-19, -50], 1, 1);
    const clusters = clusterSchools(ctx);
    const ids = new Set(clusters.flatMap((c) => c.members.map((s) => s.id)));
    expect(ids.has('pl-katowice')).toBe(true);
    // Every school on the far side (more than 90° from the middle of the disc) is left out.
    const far = SCHOOLS.filter((s) => geoDistance([s.lon, s.lat], [19, 50]) > Math.PI / 2);
    expect(far.length).toBeGreaterThan(50);
    expect(far.some((s) => ids.has(s.id))).toBe(false);
    expect(total(clusters)).toBe(SCHOOLS.length - far.length);
    // Zoomed in on the globe, Katowice stands alone too.
    const near = clusterSchools(makeGlobeCtx(500, [-19.02, -50.26], 0.6, 40));
    expect(near.find((c) => c.members.some((s) => s.id === 'pl-katowice'))!.members).toHaveLength(1);
  });

  test('a click on a badge zooms in on its group, or lists it when zooming cannot pull it apart', () => {
    const ctx = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1.2, 'grid');
    const biggest = [...clusterSchools(ctx)].sort((a, b) => b.members.length - a.members.length)[0]!;
    const target = clusterClick(ctx, biggest.key, FLAT_MAX_ZOOM)!;
    expect(target.kind).toBe('zoom');
    if (target.kind !== 'zoom') return;
    expect(target.zoom).toBeGreaterThanOrEqual(2);
    expect(target.zoom).toBeLessThanOrEqual(8);
    expect(target.center.lat).toBeLessThan(0); // Brazil
    expect(clusterClick(ctx, 'no-such-school', FLAT_MAX_ZOOM)).toBeNull();
    // Schools at one spot (Bengaluru's city-level entries) are listed at once, sorted by name.
    const same = SCHOOLS.filter((s) => s.lat === SCHOOLS.find((x) => x.id === 'in-jakkur-bengaluru')!.lat && s.lon === SCHOOLS.find((x) => x.id === 'in-jakkur-bengaluru')!.lon);
    expect(same.length).toBeGreaterThan(10);
    const at20 = makeFlatCtx(960, 480, same[0]!, 20, 1.2, 'grid');
    const group = clusterSchools(at20).find((c) => c.members.some((m) => m.id === 'in-jakkur-bengaluru'))!;
    const listed = clusterClick(at20, group.key, FLAT_MAX_ZOOM)!;
    expect(listed.kind).toBe(group.members.every((m) => same.includes(m)) ? 'list' : 'zoom');
    const atMax = makeFlatCtx(960, 480, same[0]!, FLAT_MAX_ZOOM, 1.2, 'grid');
    const g80 = clusterSchools(atMax).find((c) => c.members.some((m) => m.id === 'in-jakkur-bengaluru'))!;
    const l80 = clusterClick(atMax, g80.key, FLAT_MAX_ZOOM)!;
    expect(l80.kind).toBe('list');
    if (l80.kind === 'list') expect(l80.members.map((m) => m.id).sort()).toEqual(g80.members.map((m) => m.id).sort());
    expect(clusterZoomTarget(same, atMax, FLAT_MAX_ZOOM).zoom).toBe(FLAT_MAX_ZOOM);
    const globe = makeGlobeCtx(500, [50, 15], 1, 1);
    const gBiggest = [...clusterSchools(globe)].sort((a, b) => b.members.length - a.members.length)[0]!;
    expect(clusterClick(globe, gBiggest.key, GLOBE_MAX_ZOOM)!.kind).toBe('zoom');
  });

  test('cells shrink from zoom 40, so schools a street apart separate', () => {
    expect(schoolCell(SCHOOL_DEEP_ZOOM - 0.1)).toBe(SCHOOL_CELL);
    expect(schoolCell(SCHOOL_DEEP_ZOOM)).toBe(SCHOOL_CELL_DEEP);
    // Two São Paulo address-level schools: grouped at zoom 39.9, apart at 40 or deeper.
    const lone = (zoom: number) => {
      const ctx = makeFlatCtx(960, 480, { lat: -23.6, lon: -46.7 }, zoom, 1.2, 'grid');
      return clusterSchools(ctx, null, Infinity).filter((c) => c.members.length === 1).length;
    };
    expect(lone(SCHOOL_DEEP_ZOOM)).toBeGreaterThan(lone(SCHOOL_DEEP_ZOOM - 0.1));
    // The globe uses its flat-equivalent zoom (twice its own).
    const g = makeGlobeCtx(500, [46.7, 23.6], 1.2, SCHOOL_DEEP_ZOOM / 2);
    expect(g.zoom).toBe(SCHOOL_DEEP_ZOOM);
  });

  test('every school, chosen from the list, is drawn alone in view on the flat map and the globe', () => {
    const failures: string[] = [];
    for (const [projection, px] of [['grid', 1.675], ['grid', 2.8], ['mercator', 1.675], ['equal-earth', 1.2]] as const) {
      for (const s of SCHOOLS) {
        const zoom = isolatingFlatZoom(s, projection, px, FLAT_MAX_ZOOM);
        const state = new MapState();
        state.chooseProjection(projection);
        state.setFlatView(s, zoom);
        const ctx = makeFlatCtx(960, 480, state.flat.center, state.flat.zoom, px, projection);
        const clusters = clusterSchools(ctx, s.id, Infinity);
        const mark = chosenSchoolMark(ctx, s.id);
        if (clusters.some((c) => c.members.some((m) => m.id === s.id))) failures.push(`${projection}/${px} ${s.id}: still grouped`);
        if (!mark || mark.x < 0 || mark.x > 960 || mark.y < 0 || mark.y > 480) failures.push(`${projection}/${px} ${s.id}: not in view`);
        if (total(clusters) !== SCHOOLS.length - 1) failures.push(`${projection}/${px} ${s.id}: ${total(clusters)} others`);
      }
    }
    for (const s of SCHOOLS) {
      const gz = isolatingGlobeZoom(s, 1, GLOBE_MAX_ZOOM);
      const ctx = makeGlobeCtx(500, [-s.lon, -Math.max(-60, Math.min(60, s.lat))], 1, gz);
      const mark = chosenSchoolMark(ctx, s.id);
      if (!mark || mark.x < 0 || mark.x > 500 || mark.y < 0 || mark.y > 500) failures.push(`globe ${s.id}: not in view`);
      if (clusterSchools(ctx, s.id).some((c) => c.members.some((m) => m.id === s.id))) failures.push(`globe ${s.id}: still grouped`);
    }
    expect(failures).toEqual([]);
  }, 60_000);

  test('a group at the chosen school is drawn clear of it', () => {
    const c = (x: number, y: number) => ({ key: `k${x},${y}`, x, y, members: [] });
    const moved = clearOfChosen([c(100, 100), c(110, 100), c(300, 300)], { x: 100, y: 100 }, 2);
    expect(Math.hypot(moved[0]!.x - 100, moved[0]!.y - 100)).toBeCloseTo(CHOSEN_CLEARANCE * 2);
    expect(moved[0]!.y).toBeLessThan(100);
    expect(Math.hypot(moved[1]!.x - 100, moved[1]!.y - 100)).toBeCloseTo(CHOSEN_CLEARANCE * 2);
    expect(Math.hypot(moved[1]!.x - moved[0]!.x, moved[1]!.y - moved[0]!.y)).toBeGreaterThanOrEqual(CHOSEN_CLEARANCE * 2 * 0.9 - 1e-9);
    expect(moved[2]).toMatchObject({ x: 300, y: 300 });
    expect(clearOfChosen(moved, null, 2)).toBe(moved);
    // Two groups next to it do not end up on top of each other.
    const two = clearOfChosen([c(99, 101), c(98, 102)], { x: 100, y: 100 }, 1);
    expect(Math.hypot(two[0]!.x - two[1]!.x, two[0]!.y - two[1]!.y)).toBeGreaterThanOrEqual(CHOSEN_CLEARANCE * 0.9 - 1e-9);
  });

  test('MapState.chooseSchool: both maps on the school, marked as chosen, the point moved; sizes a hidden view from the drawn one', () => {
    const state = new MapState();
    state.applyScene({ views: ['globe', 'flat'], point: { lat: 0, lon: 0 }, pointEditable: true, precision: 'auto', schoolsToggle: true });
    state.viewPx = { flat: null, globe: 1 }; // a phone showing the globe
    const s = state.chooseSchool('sg-adam')!;
    expect(state.chosenSchool).toBe(s.id);
    expect(state.layers.schools).toBe(true);
    expect(state.flat.center.lat).toBeCloseTo(s.lat, 3);
    expect(state.rotate[0]).toBeCloseTo(-s.lon, 6);
    expect(state.globeZoom).toBeGreaterThan(3);
    expect(Math.abs(state.point!.lat - s.lat)).toBeLessThan(1 / 60);
    expect(state.chooseSchool('no-such-school')).toBeNull();
    state.applyScene({ views: ['flat'] });
    expect(state.chosenSchool).toBeNull();
  });

  test('choosing a school zooms far enough for it to stand alone', () => {
    for (const px of [1, 2.8]) {
      const zoom = isolatingFlatZoom(katowice(), 'grid', px, FLAT_MAX_ZOOM);
      expect(zoom).toBeGreaterThanOrEqual(6);
      expect(zoom).toBeLessThanOrEqual(FLAT_MAX_ZOOM);
      const clusters = clusterSchools(makeFlatCtx(960, 480, katowice(), zoom, px, 'grid'));
      expect(clusters.find((c) => c.members.some((s) => s.id === 'pl-katowice'))!.members).toHaveLength(1);
    }
    const gz = isolatingGlobeZoom(katowice(), 1, GLOBE_MAX_ZOOM);
    const k = katowice();
    const g = clusterSchools(makeGlobeCtx(500, [-k.lon, -k.lat], 1, gz));
    expect(g.find((c) => c.members.some((s) => s.id === 'pl-katowice'))!.members).toHaveLength(1);
    expect(SCHOOL_CELL).toBeGreaterThanOrEqual(40);
  });
});
