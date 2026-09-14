import { expect, test } from 'vitest';
import { EDGE_LEFT, labelWidth } from '../../src/map/brackets';
import { makeFlatCtx, makeGlobeCtx } from '../../src/map/geometry';
import { overlaps, placeLabelOptions, pointBox, selectLabelPlacements, textBox } from '../../src/map/labelLayout';
import { lineLabelSpecs, namedLines } from '../../src/map/lineLabels';
import en from '../../src/i18n/en.json';
import pl from '../../src/i18n/pl.json';
import uk from '../../src/i18n/uk.json';
import { topic1 } from '../../src/topics/t1-grid';
import { i18n } from '../../src/i18n/i18n.svelte';
import { sceneLatEdgeBoxes, sceneLineLabels } from '../../src/map/overlayText';
import { MapState } from '../../src/map/mapState.svelte';
import { bracketBoxes, CONTINENT_WIDTH, fitMapNames, hemisphereLabels, hemisphereLabelSpots, lineLabelVariants, markerLabelSize, markerLayout, noonLabel, NOON_LABEL, pathBox, placeLineLabels, viewEdgeBoxes } from '../../src/map/overlayLayout';
import { tierVisible, tierZoom } from '../../src/map/places';
import type { Overlay, SceneSpec } from '../../src/map/types';
import { TOPICS } from '../../src/topics';
import { topic6 } from '../../src/topics/t6-differences';
import { topic8 } from '../../src/topics/t8-time';
import { meanSunPoint } from '../../src/geo/sun';

const fmt = (v: number, unit: 'deg' | 'km') => (unit === 'km' ? `${v} km` : `${v}°`);
const text = (o: { label?: string; labelKey?: string }) => o.label ?? o.labelKey ?? '';
const lineCtx = (ctx: ReturnType<typeof makeFlatCtx>) => ({ kind: ctx.kind, width: ctx.width, height: ctx.height, px: ctx.px, project: (p: { lat: number; lon: number }) => ctx.project(p), rotateLambda: ctx.projection.rotate()[0] });

test('place names sit about 6 CSS px from their dot on every side', () => {
  for (const px of [1, 2.75]) {
    const size = 12 * px, w = 50 * px;
    const [right, left, above, below] = placeLabelOptions([500, 200], w, size, px);
    expect(right!.box.left - 500).toBeCloseTo(6 * px);
    expect(500 - left!.box.right).toBeCloseTo(6 * px);
    expect(200 - above!.box.bottom).toBeCloseTo(6 * px);
    expect(below!.box.top - 200).toBeCloseTo(6 * px);
    expect([right, left, above, below].map((o) => o!.side)).toEqual(['right', 'left', 'above', 'below']);
  }
});

test('a mark centred on the dot adds the four sides just past it; a mark beside the dot does not', () => {
  const px = 1;
  const ring = pointBox(500, 200, px); // the point placed on this very city
  const options = placeLabelOptions([500, 200], 50, 12, px, [ring]);
  expect(options).toHaveLength(8);
  const farRight = options[4]!;
  expect(farRight.side).toBe('right');
  expect(farRight.box.left).toBeCloseTo(ring.right + 3);
  expect(overlaps(farRight.box, ring)).toBe(false);
  // The point 9 px away (a neighbouring city): no far sides, so the name cannot drift past the point.
  expect(placeLabelOptions([509, 200], 50, 12, px, [ring])).toHaveLength(4);
});

test('tier zoom: a narrow map counts as zoomed out, down to half', () => {
  expect(tierZoom(9, 975)).toBe(9);
  expect(tierZoom(9, 640)).toBe(9);
  expect(tierZoom(9, 320)).toBe(4.5);
  expect(tierZoom(9, 100)).toBe(4.5);
  // A phone's Poland view keeps the region's cities but not the towns; a phone's Europe view no region dots.
  expect(tierVisible('region', tierZoom(9, 349))).toBe(true);
  expect(tierVisible('local', tierZoom(9, 349))).toBe(false);
  expect(tierVisible('region', tierZoom(3.5, 349))).toBe(false);
  expect(tierVisible('region', tierZoom(3.5, 975))).toBe(true);
});

test('pathBox reads absolute and relative line commands', () => {
  expect(pathBox('M10,20V60')).toEqual([{ left: 7, right: 13, top: 17, bottom: 63 }]);
  expect(pathBox('M10,20h9')).toEqual([{ left: 7, right: 22, top: 17, bottom: 23 }]);
  expect(pathBox('M0,0L5,5L-5,10Z')).toEqual([{ left: -8, right: 8, top: -3, bottom: 13 }]);
  expect(pathBox('')).toEqual([]);
});

test('marker labels are smaller on a phone-sized map', () => {
  expect(markerLabelSize({ width: 960, px: 1 })).toBe(15);
  expect(markerLabelSize({ width: 960, px: 960 / 349 })).toBe(13);
});

test('topic 6, step 2 on a Ukrainian phone: the equator name is inside the map and clear of the bracket; the prime meridian name, which no side of the bracket leaves room for, is left out', () => {
  const step = topic6.steps.find((s) => s.id === 'opposite-lat')!;
  const ms = new MapState();
  ms.applyScene(step.scene);
  const px = 960 / 349;
  const ctx = makeFlatCtx(960, 480, ms.flat.center, ms.flat.zoom, px, 'grid');
  const overlays = step.scene.overlays!;
  const markers = markerLayout(overlays, ctx, text);
  const avoid = [...bracketBoxes(overlays, ctx, fmt, markers.room), ...markers.labels];
  const labels = placeLineLabels(lineLabelSpecs(ms.layers), lineCtx(ctx), (spec) => uk[spec.labelKey as keyof typeof uk], avoid, { keep: namedLines(ms.layers, overlays) });
  const equator = labels.find((l) => l.spec.id === 'eq')!;
  expect(equator.box.left).toBeGreaterThanOrEqual(EDGE_LEFT * px - 0.5);
  expect(equator.box.right).toBeLessThanOrEqual(ctx.width);
  expect(avoid.some((a) => overlaps(equator.box, a))).toBe(false);
  expect(namedLines(ms.layers, overlays).has('pm')).toBe(false);
  expect(labels.find((l) => l.spec.id === 'pm')).toBeUndefined();
});

test('a vertical line name moves to the other side of its meridian when a bracket takes its usual side', () => {
  const ctx = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1, 'grid');
  const pm = lineLabelSpecs({ specialLines: true, tropics: false }).find((s) => s.id === 'pm')!;
  const x0 = ctx.project({ lat: 0, lon: 0 })![0];
  const name = () => 'Prime meridian 0°';
  const free = placeLineLabels([pm], lineCtx(ctx), name, []);
  expect(free[0]!.x).toBeCloseTo(x0 + 15);
  const blocked = placeLineLabels([pm], lineCtx(ctx), name, [{ left: x0 + 2, right: x0 + 30, top: 0, bottom: 480 }]);
  expect(blocked[0]!.x).toBeCloseTo(x0 - 5);
  const both = [{ left: x0 - 30, right: x0 + 30, top: 0, bottom: 480 }];
  expect(placeLineLabels([pm], lineCtx(ctx), name, both)).toEqual([]);
  // …unless the scene is about that line: then it stays, where it would normally go.
  const kept = placeLineLabels([pm], lineCtx(ctx), name, both, { keep: new Set(['pm']) });
  expect(kept).toHaveLength(1);
  expect(kept[0]!.box.left).toBeGreaterThan(x0);
});

test('line name forms: whole, split before the parenthesis, without it', () => {
  expect(lineLabelVariants('Prime meridian 0° (Greenwich)')).toEqual([['Prime meridian 0° (Greenwich)'], ['Prime meridian 0°', '(Greenwich)'], ['Prime meridian 0°']]);
  expect(lineLabelVariants('Meridian 180°')).toEqual([['Meridian 180°']]);
});

for (const [lang, dict] of [['en', en], ['uk', uk], ['pl', pl]] as const) {
  test(`topic 1 step 6 "The prime meridian" on a phone (${lang}): the prime meridian's name is on the map, inside it and clear of the edge numbers and hemisphere names`, () => {
    const step = topic1.steps.find((s) => s.id === 'prime')!;
    const ms = new MapState();
    ms.applyScene(step.scene);
    expect(namedLines(ms.layers, ms.overlays).has('pm')).toBe(true);
    i18n.lang = lang;
    try {
      // The flat map's CSS width on a 400, 375 and 320 px phone (the page's side padding taken off), and a 320 px map.
      for (const css of [375, 349, 320, 296]) {
        const px = 960 / css;
        const ctx = makeFlatCtx(960, 480, ms.flat.center, ms.flat.zoom, px, 'grid');
        const prime = sceneLineLabels(ctx, ms.layers, ms.overlays).find((l) => l.spec.id === 'pm');
        expect(prime, `${lang} ${css}`).toBeDefined();
        expect(prime!.size).toBeGreaterThanOrEqual(css < 320 ? 9 : 10);
        expect(prime!.lines[0]!.startsWith(dict['line.prime'].split(' (')[0]!)).toBe(true);
        expect(prime!.box.top, `${lang} ${css} top`).toBeGreaterThanOrEqual(0);
        expect(prime!.box.bottom, `${lang} ${css} bottom`).toBeLessThanOrEqual(ctx.height);
        const edge = sceneLatEdgeBoxes(ctx, ms.layers);
        expect(edge.some((b) => overlaps(prime!.box, b)), `${lang} ${css} edge numbers`).toBe(false);
        const hemis = hemisphereLabels(ctx, 'ew', (r) => dict[`hemi.${r}` as keyof typeof dict]);
        expect(hemis.some((h) => overlaps(prime!.box, h.box)), `${lang} ${css} hemisphere names`).toBe(false);
        // The two hemisphere names stay inside the map and apart, each in its own half.
        const [e, w] = [hemis.find((h) => h.r === 'E')!, hemis.find((h) => h.r === 'W')!];
        expect(w.box.left, `${lang} ${css} west inside`).toBeGreaterThanOrEqual(0);
        expect(e.box.right, `${lang} ${css} east inside`).toBeLessThanOrEqual(ctx.width);
        expect(overlaps(e.box, w.box), `${lang} ${css} hemisphere names apart`).toBe(false);
      }
    } finally {
      i18n.lang = 'en';
    }
  });
}

test('lab, Poland and Europe presets: the prime meridian name never runs through the latitude numbers', () => {
  const ms = new MapState();
  ms.applyScene({ views: ['globe', 'flat'], point: { lat: 50.26, lon: 19.02 }, pointEditable: true, precision: 'auto', layers: { graticuleStep: 'auto', specialLines: true, tropics: true, daylight: true }, overlays: [{ kind: 'noon-meridian' }] });
  for (const preset of ['poland', 'europe'] as const) {
    ms.setFlatPreset(preset);
    for (const cssWidth of [575, 639, 975, 349]) {
      const ctx = makeFlatCtx(960, 480, ms.flat.center, ms.flat.zoom, 960 / cssWidth, 'grid');
      const edge = sceneLatEdgeBoxes(ctx, ms.layers);
      expect(edge.length).toBeGreaterThan(0);
      for (const l of sceneLineLabels(ctx, ms.layers, ms.overlays).filter((x) => x.vertical)) {
        expect(edge.some((b) => overlaps(l.box, b)), `${preset} ${cssWidth} ${l.spec.id}`).toBe(false);
        expect(l.box.left).toBeGreaterThanOrEqual(0);
      }
    }
  }
  // The 1366 px lab's Poland view: the prime meridian runs 14 CSS px from the left side, through the column of
  // numbers, and no form of its name fits between two of them — so, not being what the lab is about, it is left out.
  const ctx = makeFlatCtx(960, 480, { lat: 52, lon: 19 }, 9, 960 / 575, 'grid');
  const pm = lineLabelSpecs({ specialLines: true, tropics: false }).filter((s) => s.id === 'pm');
  expect(ctx.project({ lat: 52, lon: 0 })![0] / (960 / 575)).toBeCloseTo(14.4, 0);
  const edge = sceneLatEdgeBoxes(ctx, { graticuleStep: 'auto' });
  expect(placeLineLabels(pm, lineCtx(ctx), () => 'Prime meridian 0° (Greenwich)', [], { edge })).toEqual([]);
});

test('a vertical line name slides up its meridian past latitude numbers on both sides of its usual spot', () => {
  const ctx = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1, 'grid');
  const pm = lineLabelSpecs({ specialLines: true, tropics: false }).filter((s) => s.id === 'pm');
  const x0 = ctx.project({ lat: 0, lon: 0 })![0];
  const edge = [{ left: x0 - 40, right: x0 + 40, top: 380, bottom: 470 }];
  const [l] = placeLineLabels(pm, lineCtx(ctx), () => 'Prime meridian 0°', [], { edge });
  expect(l).toBeDefined();
  expect(l!.size).toBe(12);
  expect(l!.box.bottom).toBeLessThanOrEqual(380);
  expect(l!.box.left).toBeGreaterThan(x0);
});

test('named lines: hemisphere shading and highlighted lines', () => {
  expect([...namedLines({ hemispheres: 'ew' }, [])]).toEqual(['pm']);
  expect([...namedLines({ hemispheres: 'ns' }, [])]).toEqual(['eq']);
  expect([...namedLines({ hemispheres: 'none' }, [{ kind: 'highlight-line', axis: 'lon', value: 180 }, { kind: 'highlight-line', axis: 'lat', value: 30 }])]).toEqual(['am']);
});

test('continent and ocean names: inside the view, inside the globe disc, clear of obstacles', () => {
  const at = (id: string, x: number, y: number, w = 60, h = 12) => ({ id, xy: [x, y] as [number, number], box: textBox(x, y, w, h, 'middle') });
  const flat = { kind: 'flat' as const, width: 960, height: 480 };
  expect(fitMapNames([at('in', 480, 240), at('cut-left', 20, 240), at('cut-top', 480, 5), at('cut-bottom', 480, 479)], flat, []).map((n) => n.id)).toEqual(['in']);
  expect(fitMapNames([at('in', 480, 240), at('under', 700, 240)], flat, [{ left: 690, right: 720, top: 230, bottom: 250 }]).map((n) => n.id)).toEqual(['in']);
  // The globe: a name inside its square view but overhanging the disc's rim is left out.
  const globe = { kind: 'globe' as const, width: 500, height: 500, radius: 244 };
  expect(fitMapNames([at('centre', 250, 250), at('rim', 60, 130, 120)], globe, []).map((n) => n.id)).toEqual(['centre']);
  // The point's ring over the name.
  expect(fitMapNames([at('centre', 250, 250)], globe, [pointBox(250, 246, 1)])).toEqual([]);
});

test('continent capitals are measured wider than ordinary text', () => {
  expect(CONTINENT_WIDTH).toBeGreaterThan(1.2);
});

test('place names on the globe keep inside its square view', () => {
  const edges = viewEdgeBoxes(500, 500);
  const px = 1, size = 12;
  // Rio de Janeiro near the left side: its right-hand name fits, the left-hand one would be cut.
  const [right, left, above] = placeLabelOptions([30, 250], 90, size, px);
  expect(edges.some((e) => overlaps(right!.box, e))).toBe(false);
  expect(edges.some((e) => overlaps(left!.box, e))).toBe(true);
  expect(edges.some((e) => overlaps(above!.box, e))).toBe(true);
  const chosen = selectLabelPlacements([0], () => [left!.box, right!.box], () => 0, edges);
  expect(chosen).toEqual([1]);
  expect(edges.some((e) => overlaps(textBox(250, 250, 40, 12), e))).toBe(false);
});
test('topic 8 far-away step on a phone: "Noon 12:00" is clear of the markers, their labels and the line names', () => {
  const step = topic8.steps.find((s) => s.id === 'far-away')!;
  const ms = new MapState();
  ms.applyScene(step.scene);
  for (const px of [1, 960 / 349]) {
    const ctx = makeFlatCtx(960, 480, ms.flat.center, ms.flat.zoom, px, 'grid');
    const overlays: Overlay[] = step.scene.overlays!;
    const markers = markerLayout(overlays, ctx, text);
    const lines = placeLineLabels(lineLabelSpecs(ms.layers), lineCtx(ctx), (spec) => en[spec.labelKey as keyof typeof en], markers.labels).map((l) => l.box);
    const obstacles = [...markers.symbols, ...markers.labels, ...lines];
    const noon = noonLabel(ctx, meanSunPoint(ms.sunDate()!).lon, labelWidth('Noon 12:00', NOON_LABEL, px), obstacles)!;
    expect(noon, `px ${px}`).not.toBeNull();
    expect(obstacles.some((o) => overlaps(noon.box, o)), `px ${px}`).toBe(false);
    expect(noon.box.right).toBeLessThanOrEqual(ctx.width);
  }
});

test('noon label falls back to a spot in view when everything is taken', () => {
  const ctx = makeGlobeCtx(500, [0, -20], 1);
  const all = [textBox(-1e4, 1e4, 2e4, 2e4)];
  expect(noonLabel(ctx, 0, 90, all)).not.toBeNull();
});

test('line names never pile up: a horizontal name touching an earlier one is left out', () => {
  const ctx = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 960 / 120, 'grid'); // a 120 px wide world map
  const labels = placeLineLabels(lineLabelSpecs({ specialLines: true, tropics: true }), lineCtx(ctx), () => 'Tropic of Capricorn');
  const flat = labels.filter((l) => !l.vertical);
  expect(flat[0]!.spec.id).toBe('eq');
  flat.forEach((a, i) => flat.forEach((b, j) => { if (i < j) expect(overlaps(a.box, b.box)).toBe(false); }));
  const roomy = placeLineLabels(lineLabelSpecs({ specialLines: true, tropics: true }), lineCtx(makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1, 'grid')), () => 'Tropic of Cancer');
  expect(roomy.filter((l) => !l.vertical)).toHaveLength(5);
});

test('line names never touch one another: every topic step, the lab at several zooms, three languages, phone to desktop widths, flat map and globe', () => {
  const grow = (b: { left: number; right: number; top: number; bottom: number }, d: number) => ({ left: b.left - d, right: b.right + d, top: b.top - d, bottom: b.bottom + d });
  const scenes: [string, SceneSpec][] = [];
  for (const topic of Object.values(TOPICS)) for (const s of topic!.steps) scenes.push([`topic ${topic!.id} ${s.id}`, s.scene]);
  const lab: SceneSpec = { views: ['globe', 'flat'], point: { lat: 50.26, lon: 19.02 }, pointEditable: true, precision: 'auto', layers: { graticuleStep: 'auto', specialLines: true, tropics: true, daylight: true }, overlays: [{ kind: 'noon-meridian' }] };
  for (const zoom of [1, 2, 3.5, 6, 9, 14]) for (const c of [{ lat: 0, lon: 0 }, { lat: 20, lon: 5 }, { lat: 50, lon: 15 }, { lat: -20, lon: 170 }]) {
    scenes.push([`lab zoom ${zoom} at ${c.lat},${c.lon}`, { ...lab, flatView: { center: c, zoom }, globeZoom: zoom, rotate: [-c.lon, -c.lat] }]);
  }
  const touching: string[] = [];
  try {
    for (const lang of ['en', 'pl', 'uk'] as const) {
      i18n.lang = lang;
      for (const [name, scene] of scenes) {
        const ms = new MapState();
        ms.applyScene(scene);
        for (const css of [349, 640, 975]) for (const kind of ['flat', 'globe'] as const) {
          if (!ms.views.includes(kind)) continue;
          const ctx = kind === 'flat' ? makeFlatCtx(960, 480, ms.flat.center, ms.flat.zoom, 960 / css, ms.flatProjection) : makeGlobeCtx(500, ms.rotate, 500 / css, ms.globeZoom);
          const labels = sceneLineLabels(ctx, ms.layers, ms.overlays);
          for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
            if (overlaps(grow(labels[i]!.box, 0.5 * ctx.px), labels[j]!.box)) touching.push(`${lang} ${name} ${kind} ${css}px: ${labels[i]!.spec.id} / ${labels[j]!.spec.id}`);
          }
        }
      }
    }
  } finally {
    i18n.lang = 'en';
  }
  expect(touching).toEqual([]);
}, 60_000);

test('line names keep clear of the extra boxes they are given (school count badges, the chosen school), on the flat map and the globe', () => {
  const layers = { ...new MapState().layers, specialLines: true, tropics: true };
  const flat = makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1.4, 'grid');
  const globe = makeGlobeCtx(500, [-19, -30], 1.5, 1);
  for (const ctx of [flat, globe]) {
    const free = sceneLineLabels(ctx, layers, []);
    for (const id of ['tc', 'pm']) {
      const before = free.find((l) => l.spec.id === id);
      if (!before) continue;
      // A badge right on the name's usual spot.
      const cx = (before.box.left + before.box.right) / 2, cy = (before.box.top + before.box.bottom) / 2;
      const badge = { left: cx - 20, right: cx + 20, top: cy - 12, bottom: cy + 12 };
      const after = sceneLineLabels(ctx, layers, [], [badge]).find((l) => l.spec.id === id);
      if (after) expect(overlaps(after.box, badge), `${ctx.kind} ${id}`).toBe(false);
      // The tropic's name moves along its line rather than disappearing.
      if (id === 'tc') expect(after, `${ctx.kind} tc kept`).toBeDefined();
    }
  }
});
