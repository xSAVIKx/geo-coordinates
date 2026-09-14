// Pure geometry for hiding lower-priority map text labels that would collide with an already
// placed label. Used by the Places layer to drop crowded place names (dots always stay visible)
// while keeping special-line labels and higher-priority place names untouched.

export interface LabelBox { left: number; top: number; right: number; bottom: number }

export function overlaps(a: LabelBox, b: LabelBox): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Box of a horizontal text run of `width` × `height` anchored at `(x, y)` (`y` the text baseline). */
export function textBox(x: number, y: number, width: number, height: number, anchor: 'start' | 'middle' | 'end' = 'start'): LabelBox {
  const left = anchor === 'start' ? x : anchor === 'middle' ? x - width / 2 : x - width;
  return { left, right: left + width, top: y - height * 0.8, bottom: y + height * 0.25 };
}

/**
 * Which of `items` get a visible label: processed in ascending `rank` order (lower rank placed
 * first), an item is hidden when its box overlaps a fixed `obstacle` or an already-placed item's
 * box. Returns a boolean per item, in the original order.
 */
export function selectVisibleLabels<T>(
  items: readonly T[],
  box: (item: T) => LabelBox,
  rank: (item: T) => number,
  obstacles: readonly LabelBox[] = [],
): boolean[] {
  return selectLabelPlacements(items, (item) => [box(item)], rank, obstacles).map((choice) => choice >= 0);
}

/**
 * Like `selectVisibleLabels`, but each item may offer several boxes in order of preference (e.g. a
 * name right of its dot, else left of it): the first free one is taken. Returns, per item in the
 * original order, the index of the chosen box, or -1 when none is free.
 */
export function selectLabelPlacements<T>(
  items: readonly T[],
  boxes: (item: T) => readonly LabelBox[],
  rank: (item: T) => number,
  obstacles: readonly LabelBox[] = [],
): number[] {
  const order = items.map((_, i) => i).sort((a, b) => rank(items[a]!) - rank(items[b]!));
  const placed: LabelBox[] = [...obstacles];
  const chosen = new Array<number>(items.length).fill(-1);
  for (const i of order) {
    const options = boxes(items[i]!);
    const k = options.findIndex((b) => !placed.some((p) => overlaps(b, p)));
    if (k < 0) continue;
    placed.push(options[k]!);
    chosen[i] = k;
  }
  return chosen;
}

/**
 * The axis-aligned bounding box of `box` after rotating it by `degrees` around `(cx, cy)`
 * (matching SVG's `rotate(<degrees> <cx> <cy>)` transform) — for a label drawn rotated in place,
 * such as the vertical prime-meridian / antimeridian line labels.
 */
export function rotateBoxAround(box: LabelBox, cx: number, cy: number, degrees: number): LabelBox {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const corners: [number, number][] = [
    [box.left, box.top], [box.right, box.top], [box.right, box.bottom], [box.left, box.bottom],
  ];
  const rotated = corners.map(([x, y]): [number, number] => [
    cx + (x - cx) * cos - (y - cy) * sin,
    cy + (x - cx) * sin + (y - cy) * cos,
  ]);
  const xs = rotated.map((p) => p[0]);
  const ys = rotated.map((p) => p[1]);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
}

/**
 * Like `selectVisibleLabels`, but stable across small view changes (panning/zooming a few CSS px
 * should not toggle which labels show): items rank in three tiers — `featured` first, then items
 * that were visible in the *previous* call (`wasVisible`, e.g. the caller's own last result),
 * then everything else — and within a tier, `distance` (typically distance to the view centre) is
 * bucketed by `bucketSize` so a tiny shift in distance can't reorder same-tier items. A tier-1
 * (previously visible, non-featured) item still loses to a tier-0 (featured) item it now collides
 * with — hysteresis only protects an item from losing to an equally-unfeatured newcomer.
 */
export function selectStableLabels<T>(
  items: readonly T[],
  box: (item: T) => LabelBox,
  featured: (item: T) => boolean,
  distance: (item: T) => number,
  wasVisible: (item: T) => boolean,
  obstacles: readonly LabelBox[] = [],
  bucketSize = 8,
): boolean[] {
  return selectStablePlacements(items, (item) => [box(item)], featured, distance, wasVisible, obstacles, bucketSize).map((choice) => choice >= 0);
}

/** `selectStableLabels` with a list of preferred boxes per item (see `selectLabelPlacements`). */
export function selectStablePlacements<T>(
  items: readonly T[],
  boxes: (item: T) => readonly LabelBox[],
  featured: (item: T) => boolean,
  distance: (item: T) => number,
  wasVisible: (item: T) => boolean,
  obstacles: readonly LabelBox[] = [],
  bucketSize = 8,
): number[] {
  const rank = (item: T): number => {
    const tier = featured(item) ? 0 : wasVisible(item) ? 1 : 2;
    return tier * 1_000_000 + Math.floor(distance(item) / bucketSize);
  };
  return selectLabelPlacements(items, boxes, rank, obstacles);
}

/**
 * The order in which to try an item's `boxes`: the ones clear of every `soft` box first, then the
 * rest (each group in its original order) — for things a label should rather not cover but may.
 */
export function preferClear(boxes: readonly LabelBox[], soft: readonly LabelBox[]): number[] {
  const indices = boxes.map((_, i) => i);
  if (soft.length === 0) return indices;
  const clear = boxes.map((b) => !soft.some((s) => overlaps(b, s)));
  return [...indices.filter((i) => clear[i]), ...indices.filter((i) => !clear[i])];
}

/** The area the movable point's ring (and its halo) covers, so no name is written under it. */
export function pointBox(x: number, y: number, px: number): LabelBox {
  const r = 13 * px;
  return { left: x - r, right: x + r, top: y - r, bottom: y + r };
}

/**
 * Remembers which label ids were visible last time, for `selectStableLabels`' `wasVisible` bonus —
 * but only within one scene: `previous(sceneKey)` starts from an empty set whenever `sceneKey`
 * differs from the last call's (MapState.applyScene bumps `sceneVersion`), so a label that happened
 * to show in one question or step gets no priority in an unrelated later one on the same map.
 * Plain (non-reactive) state, so remembering never re-triggers the derived that reads it.
 */
export function createLabelMemory(): { previous(sceneKey: number): ReadonlySet<string>; remember(ids: ReadonlySet<string>): void } {
  let scene: number | undefined;
  let visible: ReadonlySet<string> = new Set();
  return {
    previous(sceneKey) {
      if (sceneKey !== scene) {
        scene = sceneKey;
        visible = new Set();
      }
      return visible;
    },
    remember(ids) {
      visible = ids;
    },
  };
}

export type PlaceSide = 'right' | 'left' | 'above' | 'below';
export interface PlaceLabelOption { side: PlaceSide; x: number; y: number; anchor: 'start' | 'middle' | 'end'; box: LabelBox }

/**
 * Where a place name `width` wide and `size` tall (viewBox units) may go beside its dot at `xy`, in order
 * of preference: right of the dot, left of it, then centred above or below it — each about 6 CSS px
 * clear of the dot, so a name never drifts off towards a neighbour's dot. When one of the `marks` (the
 * movable point's ring, a school's square or count badge) is centred on the dot, the same four sides are
 * also offered just past that mark's edge, after the near ones.
 */
export function placeLabelOptions(xy: [number, number], width: number, size: number, px: number, marks: readonly LabelBox[] = []): PlaceLabelOption[] {
  const [x, y] = xy;
  const gap = 6 * px;
  const at = (side: PlaceSide, reach: { right: number; left: number; top: number; bottom: number }): PlaceLabelOption => {
    switch (side) {
      case 'right': return { side, x: reach.right, y: y + 4 * px, anchor: 'start', box: textBox(reach.right, y + 4 * px, width, size, 'start') };
      case 'left': return { side, x: reach.left, y: y + 4 * px, anchor: 'end', box: textBox(reach.left, y + 4 * px, width, size, 'end') };
      case 'above': return { side, x, y: reach.top - size * 0.25, anchor: 'middle', box: textBox(x, reach.top - size * 0.25, width, size, 'middle') };
      case 'below': return { side, x, y: reach.bottom + size * 0.8, anchor: 'middle', box: textBox(x, reach.bottom + size * 0.8, width, size, 'middle') };
    }
  };
  const SIDES: readonly PlaceSide[] = ['right', 'left', 'above', 'below'];
  const near = { right: x + gap, left: x - gap, top: y - gap, bottom: y + gap };
  const options = SIDES.map((side) => at(side, near));
  // Only a mark centred on the dot (the point placed on this very city, the city's own school badge)
  // earns the far sides; past a mark merely near the dot, a name would read as a neighbour's.
  const under = marks.filter((m) => Math.hypot((m.left + m.right) / 2 - x, (m.top + m.bottom) / 2 - y) <= 5 * px);
  if (under.length) {
    const past = 3 * px;
    const far = {
      right: Math.max(...under.map((m) => m.right)) + past, left: Math.min(...under.map((m) => m.left)) - past,
      top: Math.min(...under.map((m) => m.top)) - past, bottom: Math.max(...under.map((m) => m.bottom)) + past,
    };
    for (const side of SIDES) options.push(at(side, far));
  }
  return options;
}
