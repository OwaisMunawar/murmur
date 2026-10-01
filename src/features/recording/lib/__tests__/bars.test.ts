import { barCapacity, barRects } from '../bars';

describe('barRects', () => {
  const layout = { width: 20, height: 10, barWidth: 2, gap: 2 };

  it('centres bars vertically and scales by level', () => {
    expect(barRects([1, 0.5], layout)).toEqual([
      { x: 0, y: 0, width: 2, height: 10 },
      { x: 4, y: 2.5, width: 2, height: 5 },
    ]);
  });

  it('keeps silent bars at the minimum height and clamps levels', () => {
    const [silent, loud] = barRects([0, 3], { ...layout, minHeight: 4 });
    expect(silent?.height).toBe(4);
    expect(loud?.height).toBe(10);
  });

  it('shows only the newest bars that fit, aligned to the end', () => {
    const levels = Array.from({ length: 10 }, (_, i) => i / 10);
    const rects = barRects(levels, { ...layout, align: 'end' });
    expect(rects).toHaveLength(5);
    expect(rects[4]?.x).toBe(18);
    expect(rects[0]?.height).toBeCloseTo(5);
  });

  it('right-aligns a short history', () => {
    expect(barRects([1], { ...layout, align: 'end' })[0]?.x).toBe(18);
  });

  it('returns nothing for a degenerate layout', () => {
    expect(barRects([1], { ...layout, width: 0 })).toEqual([]);
    expect(barRects([1], { ...layout, barWidth: 0, gap: 0 })).toEqual([]);
  });
});

describe('barCapacity', () => {
  it('counts bars including the trailing gap allowance', () => {
    expect(barCapacity(20, 2, 2)).toBe(5);
    expect(barCapacity(0, 2, 2)).toBe(0);
  });
});
