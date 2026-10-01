import { cosineSimilarity, fromBlob, l2Normalize, toBlob } from '../vectors';

describe('vectors', () => {
  it('normalises to unit length and leaves zero vectors alone', () => {
    const unit = l2Normalize(new Float32Array([3, 4]));
    expect(Array.from(unit)).toEqual([0.6000000238418579, 0.800000011920929]);
    const zero = new Float32Array(2);
    expect(l2Normalize(zero)).toBe(zero);
  });

  it('computes cosine similarity', () => {
    expect(cosineSimilarity(new Float32Array([1, 0]), new Float32Array([1, 0]))).toBe(1);
    expect(cosineSimilarity(new Float32Array([1, 0]), new Float32Array([0, 2]))).toBe(0);
    expect(cosineSimilarity(new Float32Array([0, 0]), new Float32Array([1, 0]))).toBe(0);
    expect(() => cosineSimilarity(new Float32Array(2), new Float32Array(3))).toThrow(
      'Dimension mismatch',
    );
  });

  it('round-trips through the sqlite-vec blob layout, including views', () => {
    const backing = new Float32Array([9, 1.5, -2, 9]);
    const view = backing.subarray(1, 3);
    const blob = toBlob(view);
    expect(blob.byteLength).toBe(8);
    expect(Array.from(fromBlob(blob))).toEqual([1.5, -2]);
  });
});
