export function l2Normalize(vector: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < vector.length; i++) sum += (vector[i] ?? 0) ** 2;
  const norm = Math.sqrt(sum);
  if (norm === 0) return vector;
  const out = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) out[i] = (vector[i] ?? 0) / norm;
  return out;
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) throw new Error(`Dimension mismatch: ${a.length} vs ${b.length}`);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na === 0 || nb === 0 ? 0 : dot / Math.sqrt(na * nb);
}

/** Little-endian float32 bytes: the layout sqlite-vec expects for a `float[N]` column. */
export function toBlob(vector: Float32Array): Uint8Array {
  return new Uint8Array(
    vector.buffer.slice(vector.byteOffset, vector.byteOffset + vector.byteLength),
  );
}

export function fromBlob(blob: Uint8Array): Float32Array {
  const copy = blob.slice();
  return new Float32Array(copy.buffer, 0, Math.floor(copy.byteLength / 4));
}
