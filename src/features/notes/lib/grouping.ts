export type DaySection<T> = {
  key: string;
  label: string;
  items: T[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local calendar day key. Two timestamps share a key iff they fall on the same local date. */
export function dayKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfDay(timestamp: number): number {
  const d = new Date(timestamp);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * "Today", "Yesterday", a weekday within the last week, then a date (with the
 * year only when it differs). Day distance is computed from local midnights so
 * a note at 23:59 and one at 00:01 land on different days.
 */
export function dayLabel(timestamp: number, now: number, locale?: string): string {
  const days = Math.round((startOfDay(now) - startOfDay(timestamp)) / DAY_MS);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) {
    return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(timestamp);
  }
  const sameYear = new Date(timestamp).getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(timestamp);
}

/**
 * Groups items into day sections, newest day first, preserving the incoming
 * order inside each day (the repository already sorts by recency).
 */
export function groupByDay<T extends { createdAt: number }>(
  items: readonly T[],
  now: number,
  locale?: string,
): DaySection<T>[] {
  const sections = new Map<string, DaySection<T>>();
  for (const item of items) {
    const key = dayKey(item.createdAt);
    let section = sections.get(key);
    if (!section) {
      section = { key, label: dayLabel(item.createdAt, now, locale), items: [] };
      sections.set(key, section);
    }
    section.items.push(item);
  }
  return [...sections.values()].sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
}

export type ListRow<T> =
  | { type: 'header'; key: string; label: string; count: number }
  | { type: 'item'; key: string; item: T };

/** Flattens sections for a virtualised list with sticky headers. */
export function flattenSections<T extends { id: string }>(
  sections: readonly DaySection<T>[],
): ListRow<T>[] {
  const rows: ListRow<T>[] = [];
  for (const section of sections) {
    rows.push({
      type: 'header',
      key: `h:${section.key}`,
      label: section.label,
      count: section.items.length,
    });
    for (const item of section.items) rows.push({ type: 'item', key: item.id, item });
  }
  return rows;
}
