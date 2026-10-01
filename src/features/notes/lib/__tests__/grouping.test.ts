import { dayKey, dayLabel, flattenSections, groupByDay } from '../grouping';

// Fixed local wall-clock times keep the tests independent of the machine's zone.
const at = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();
const NOW = at(2026, 9, 30, 15, 0); // Wednesday

describe('dayLabel', () => {
  it.each([
    [at(2026, 9, 30, 0, 1), 'Today'],
    [at(2026, 9, 29, 23, 59), 'Yesterday'],
    [at(2026, 9, 27), 'Sunday'],
    [at(2026, 9, 12), '12 Sept'],
    [at(2025, 12, 31), '31 Dec 2025'],
  ])('labels %p as %p', (timestamp, label) => {
    expect(dayLabel(timestamp, NOW, 'en-GB')).toBe(label);
  });
});

describe('groupByDay', () => {
  it('groups by local day, newest day first, keeping order within a day', () => {
    const notes = [
      { id: 'a', createdAt: at(2026, 9, 30, 9) },
      { id: 'b', createdAt: at(2026, 9, 30, 8) },
      { id: 'c', createdAt: at(2026, 9, 29, 22) },
      { id: 'd', createdAt: at(2026, 8, 1) },
    ];
    const sections = groupByDay(notes, NOW, 'en-GB');
    expect(sections.map((s) => s.label)).toEqual(['Today', 'Yesterday', '1 Aug']);
    expect(sections[0]?.items.map((n) => n.id)).toEqual(['a', 'b']);
  });

  it('sorts sections even when input is out of order', () => {
    const notes = [
      { id: 'old', createdAt: at(2026, 9, 1) },
      { id: 'new', createdAt: at(2026, 9, 30) },
    ];
    expect(groupByDay(notes, NOW).map((s) => s.items[0]?.id)).toEqual(['new', 'old']);
  });

  it('returns no sections for no notes', () => {
    expect(groupByDay([], NOW)).toEqual([]);
  });
});

describe('dayKey', () => {
  it('zero-pads month and day', () => {
    expect(dayKey(at(2026, 3, 4))).toBe('2026-03-04');
  });
});

describe('flattenSections', () => {
  it('interleaves headers and items with stable keys', () => {
    const rows = flattenSections([
      { key: '2026-09-30', label: 'Today', items: [{ id: 'a' }, { id: 'b' }] },
      { key: '2026-09-29', label: 'Yesterday', items: [{ id: 'c' }] },
    ]);
    expect(rows.map((r) => r.key)).toEqual(['h:2026-09-30', 'a', 'b', 'h:2026-09-29', 'c']);
    expect(rows[0]).toMatchObject({ type: 'header', count: 2 });
  });
});
