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
  const order = items.map((_, i) => i).sort((a, b) => rank(items[a]!) - rank(items[b]!));
  const placed: LabelBox[] = [...obstacles];
  const visible = new Array<boolean>(items.length).fill(false);
  for (const i of order) {
    const b = box(items[i]!);
    if (placed.some((p) => overlaps(b, p))) continue;
    placed.push(b);
    visible[i] = true;
  }
  return visible;
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
  const rank = (item: T): number => {
    const tier = featured(item) ? 0 : wasVisible(item) ? 1 : 2;
    return tier * 1_000_000 + Math.floor(distance(item) / bucketSize);
  };
  return selectVisibleLabels(items, box, rank, obstacles);
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
