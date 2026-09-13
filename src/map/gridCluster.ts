// Grid clustering by screen distance (Task 23b), pure and independent of the map.
// Points are dropped into square cells of `cell` units; the points of a cell form a cluster at
// their mean position. Groups whose centres are closer than `merge` (by default most of a cell) are
// then merged, biggest first and until no two are that close, so schools either side of a cell edge
// never show as two overlapping badges. The grid is anchored at (0, 0) of the coordinates given: the flat map
// passes positions that do not depend on where the view is centred, so a pan never regroups.

export interface Cluster<T> { x: number; y: number; members: T[] }

interface Cell<T> { i: number; j: number; x: number; y: number; members: T[]; merged: boolean }

export function gridCluster<T>(items: readonly T[], position: (item: T) => readonly [number, number] | null, cell: number, merge = cell * 0.8): Cluster<T>[] {
  const cells = new Map<string, Cell<T> & { sx: number; sy: number }>();
  for (const item of items) {
    const xy = position(item);
    if (!xy) continue;
    const i = Math.floor(xy[0] / cell), j = Math.floor(xy[1] / cell);
    const key = `${i},${j}`;
    let c = cells.get(key);
    if (!c) { c = { i, j, x: 0, y: 0, sx: 0, sy: 0, members: [], merged: false }; cells.set(key, c); }
    c.sx += xy[0]; c.sy += xy[1];
    c.members.push(item);
  }
  const list = [...cells.values()];
  for (const c of list) { c.x = c.sx / c.members.length; c.y = c.sy / c.members.length; }
  list.sort((a, b) => b.members.length - a.members.length || a.i - b.i || a.j - b.j);
  // A merged group's centre moves, and may come close to yet another group: repeat until no two are close.
  for (let changed = true; changed;) {
    changed = false;
    for (const c of list) {
      if (c.merged) continue;
      for (const d of list) {
        if (d === c || d.merged || Math.abs(d.x - c.x) >= merge || Math.hypot(d.x - c.x, d.y - c.y) >= merge) continue;
        const n = c.members.length, m = d.members.length;
        c.x = (c.x * n + d.x * m) / (n + m);
        c.y = (c.y * n + d.y * m) / (n + m);
        c.members.push(...d.members);
        d.merged = true;
        changed = true;
      }
    }
  }
  return list.filter((c) => !c.merged).map((c) => ({ x: c.x, y: c.y, members: c.members }));
}
