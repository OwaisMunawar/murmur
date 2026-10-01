export type BarRect = { x: number; y: number; width: number; height: number };

export type BarLayout = {
  width: number;
  height: number;
  barWidth: number;
  gap: number;
  /** Smallest drawn bar, so silence still reads as a line rather than nothing. */
  minHeight?: number;
  /** `end` packs the newest bars against the right edge (live recording). */
  align?: 'start' | 'end';
};

/**
 * Geometry for a vertically centred bar waveform. Marked as a worklet so the
 * Skia components can run it on the UI thread every frame; it is also plain
 * enough to unit test.
 */
export function barRects(levels: readonly number[], layout: BarLayout): BarRect[] {
  'worklet';
  const { width, height, barWidth, gap, minHeight = 2, align = 'start' } = layout;
  const step = barWidth + gap;
  if (width <= 0 || height <= 0 || step <= 0) return [];
  const capacity = Math.floor((width + gap) / step);
  const visible = levels.length > capacity ? levels.slice(levels.length - capacity) : levels;
  const offset = align === 'end' ? width - visible.length * step + gap : 0;

  const rects: BarRect[] = [];
  for (let i = 0; i < visible.length; i++) {
    const level = Math.min(1, Math.max(0, visible[i] ?? 0));
    const h = Math.max(minHeight, level * height);
    rects.push({ x: offset + i * step, y: (height - h) / 2, width: barWidth, height: h });
  }
  return rects;
}

/** How many bars fit, used to size the peak buckets for a static waveform. */
export function barCapacity(width: number, barWidth: number, gap: number): number {
  const step = barWidth + gap;
  return step > 0 && width > 0 ? Math.floor((width + gap) / step) : 0;
}
