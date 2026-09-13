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
