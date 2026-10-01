import { keepUnchanged } from '../structuralSharing';

describe('keepUnchanged', () => {
  const a = { id: 'a', title: 'A', tags: ['x'] };
  const b = { id: 'b', title: 'B', tags: [] as string[] };

  it('reuses previous instances for unchanged items', () => {
    const next = keepUnchanged(
      [a, b],
      [
        { id: 'a', title: 'A', tags: ['x'] },
        { id: 'b', title: 'B2', tags: [] },
      ],
    );
    expect(next[0]).toBe(a);
    expect(next[1]).not.toBe(b);
    expect(next[1]?.title).toBe('B2');
  });

  it('notices changes inside arrays and in the set of keys', () => {
    expect(keepUnchanged([a], [{ id: 'a', title: 'A', tags: ['y'] }])[0]).not.toBe(a);
    expect(keepUnchanged([a], [{ id: 'a', title: 'A', tags: ['x', 'y'] }])[0]).not.toBe(a);
    expect(
      keepUnchanged<{ id: string; extra?: number }>([{ id: 'a' }], [{ id: 'a', extra: 1 }])[0],
    ).toEqual({ id: 'a', extra: 1 });
  });

  it('returns the new list as is when there is nothing to reuse', () => {
    const next = [a];
    expect(keepUnchanged(undefined, next)).toBe(next);
    expect(keepUnchanged([], next)).toBe(next);
  });
});
