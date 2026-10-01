/**
 * Sentence embeddings for retrieval. Vectors are L2-normalised, so cosine
 * similarity and dot product agree and sqlite-vec's cosine distance applies.
 */
export interface Embedder {
  readonly modelId: string;
  readonly dimensions: number;
  /**
   * Cosine similarity below which a match is noise. Each model has its own
   * similarity distribution, so the cut-off belongs to the model, not to
   * the ranking code.
   */
  readonly relevanceFloor: number;
  embed(text: string): Promise<Float32Array>;
  dispose(): void;
}
