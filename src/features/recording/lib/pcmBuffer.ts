/**
 * Growable Float32 buffer for captured audio. Appending is amortised O(1):
 * capacity doubles instead of concatenating arrays on every 20 ms callback.
 */
export class PcmBuffer {
  private data: Float32Array;
  private size = 0;

  constructor(initialCapacity = 16_000 * 30) {
    this.data = new Float32Array(Math.max(1, initialCapacity));
  }

  get length(): number {
    return this.size;
  }

  append(chunk: Float32Array): void {
    const required = this.size + chunk.length;
    if (required > this.data.length) {
      let capacity = this.data.length;
      while (capacity < required) capacity *= 2;
      const next = new Float32Array(capacity);
      next.set(this.data.subarray(0, this.size));
      this.data = next;
    }
    this.data.set(chunk, this.size);
    this.size = required;
  }

  /** Copy of the captured samples, sized exactly. */
  toArray(): Float32Array {
    return this.data.slice(0, this.size);
  }

  clear(): void {
    this.size = 0;
  }
}
