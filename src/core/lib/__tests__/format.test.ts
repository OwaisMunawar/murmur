import { formatBytes, formatDuration, formatTime } from '../format';
import { createId } from '../id';

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [999, '0:01'],
    [75_400, '1:15'],
    [3_725_000, '1:02:05'],
    [-5, '0:00'],
  ])('%p ms -> %p', (ms, label) => expect(formatDuration(ms)).toBe(label));
});

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1_500, '1.5 KB'],
    [90_391_424, '90.4 MB'],
    [232_609_280, '233 MB'],
    [1_200_000_000, '1.2 GB'],
    [Number.NaN, '0 B'],
  ])('%p -> %p', (bytes, label) => expect(formatBytes(bytes)).toBe(label));
});

describe('formatTime', () => {
  it('formats hours and minutes for the locale', () => {
    expect(formatTime(new Date(2026, 0, 1, 9, 5).getTime(), 'en-US')).toMatch(/^9:05\sAM$/);
  });
});

describe('createId', () => {
  it('is sortable by creation time', () => {
    expect(createId(1_000) < createId(2_000)).toBe(true);
  });

  it('is deterministic for a given clock and random source', () => {
    expect(createId(42, () => 0.5)).toBe(createId(42, () => 0.5));
    expect(createId(42, () => 0.5)).toHaveLength(9 + 16);
  });
});
