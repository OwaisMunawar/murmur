/**
 * Returns `next`, but with each item replaced by its previous instance when
 * nothing in it changed. Re-reading a list from SQLite builds new objects
 * for every row; keeping the old references lets memoised rows skip
 * rendering when only one note changed.
 */
export function keepUnchanged<T extends { id: string }>(
  previous: readonly T[] | undefined,
  next: T[],
): T[] {
  if (!previous || previous.length === 0) return next;
  const byId = new Map(previous.map((item) => [item.id, item]));
  return next.map((item) => {
    const old = byId.get(item.id);
    return old && shallowEqual(old, item) ? old : item;
  });
}

function shallowEqual(a: object, b: object): boolean {
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  if (keys.length !== Object.keys(right).length) return false;
  return keys.every((key) => {
    const x = left[key];
    const y = right[key];
    if (Array.isArray(x) && Array.isArray(y)) {
      return x.length === y.length && x.every((value, i) => Object.is(value, y[i]));
    }
    return Object.is(x, y);
  });
}
