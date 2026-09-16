import { expect, test } from 'vitest';
import { makeFlatCtx } from '../../src/map/geometry';
import { overlaps } from '../../src/map/labelLayout';
import { placeCountryLabels, placePhysicalLabels } from '../../src/map/styleLabels';

test('country names on a Europe view: Poland and its neighbours, none overlapping', () => {
  const ctx = makeFlatCtx(960, 480, { lat: 52, lon: 15 }, 3.5, 1, 'grid');
  const labels = placeCountryLabels(ctx, 'en', []);
  const ids = labels.map((l) => l.id);
  for (const id of ['POL', 'DEU', 'UKR', 'FRA']) expect(ids, id).toContain(id);
  expect(labels.find((l) => l.id === 'POL')!.text).toBe('Poland');
  for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) expect(overlaps(labels[i]!.box, labels[j]!.box), `${labels[i]!.id}/${labels[j]!.id}`).toBe(false);
});

test('small countries wait for their zoom; obstacles push names out', () => {
  const world = placeCountryLabels(makeFlatCtx(960, 480, { lat: 0, lon: 0 }, 1, 1, 'grid'), 'en', []).map((l) => l.id);
  expect(world).toContain('RUS');
  expect(world).not.toContain('KOS');
  const ctx = makeFlatCtx(960, 480, { lat: 52, lon: 15 }, 3.5, 1, 'grid');
  const pol = placeCountryLabels(ctx, 'pl', []).find((l) => l.id === 'POL')!;
  expect(pol.text).toBe('Polska');
  const blocked = placeCountryLabels(ctx, 'pl', [pol.box]).map((l) => l.id);
  expect(blocked).not.toContain('POL');
});

test('names stay inside the view', () => {
  const ctx = makeFlatCtx(960, 480, { lat: 52, lon: 15 }, 3.5, 1, 'grid');
  for (const l of placeCountryLabels(ctx, 'uk', [])) { expect(l.x).toBeGreaterThanOrEqual(0); expect(l.x).toBeLessThanOrEqual(960); }
});

// The place dots and the capitals' rings are drawn over the names: a name with one on its spot steps a line up or
// down, and only keeps its own spot when neither step is free. A name clear of them never moves.
test('a name steps clear of a dot drawn over it, and stays put when it cannot', () => {
  const ctx = makeFlatCtx(960, 480, { lat: 52, lon: 15 }, 3.5, 1, 'grid');
  const pol = placeCountryLabels(ctx, 'en', []).find((l) => l.id === 'POL')!;
  const dot = { left: pol.x - 5, right: pol.x + 5, top: pol.y - 5, bottom: pol.y + 5 };
  const stepped = placeCountryLabels(ctx, 'en', [], [dot]).find((l) => l.id === 'POL')!;
  expect(stepped.y).not.toBe(pol.y);
  expect(overlaps(stepped.box, dot)).toBe(false);
  expect(stepped.x).toBe(pol.x);
  // A dot on every step leaves the name where Natural Earth put it rather than dropping it.
  const wall = { left: pol.x - 5, right: pol.x + 5, top: pol.y - 60, bottom: pol.y + 60 };
  const stuck = placeCountryLabels(ctx, 'en', [], [wall]).find((l) => l.id === 'POL')!;
  expect(stuck.y).toBe(pol.y);
});

test('physical names: the Alps on a Europe view, the Tatras only from zoom 6, clear of obstacles', () => {
  const europe = makeFlatCtx(960, 480, { lat: 52, lon: 15 }, 3.5, 1, 'grid');
  const ids = placePhysicalLabels(europe, 'en', []).map((l) => l.id);
  expect(ids).toContain('alps');
  expect(ids).toContain('baltic');
  expect(ids).not.toContain('tatra');
  const tatras = makeFlatCtx(960, 480, { lat: 49.5, lon: 20 }, 12, 1, 'grid');
  const t = placePhysicalLabels(tatras, 'pl', []).find((l) => l.id === 'tatra')!;
  expect(t.text).toBe('Tatry');
  expect(t.kind).toBe('mountains');
  // A name already on the map on its spot pushes it one line clear; a name that fills the whole area leaves
  // it out altogether, so a physical name never covers one.
  const stepped = placePhysicalLabels(tatras, 'pl', [t.box]).find((l) => l.id === 'tatra')!;
  expect(overlaps(stepped.box, t.box)).toBe(false);
  const wall = { left: t.box.left - 200, right: t.box.right + 200, top: t.box.top - 200, bottom: t.box.bottom + 200 };
  expect(placePhysicalLabels(tatras, 'pl', [wall]).map((l) => l.id)).not.toContain('tatra');
});
