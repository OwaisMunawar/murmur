import { VECTOR_DIMENSIONS } from '@/core/db/schema';

import { l2Normalize } from '../lib/vectors';
import { type Embedder } from './Embedder';

const STOP = new Set(
  'a an and are as at be but by do for from had has have i if in is it its me my of on or our so that the this to was we were what when where which who will with you your about did does how'.split(
    ' ',
  ),
);

/** Crude suffix folding so "meetings" and "meeting" share a feature. */
function stem(word: string): string {
  return word.replace(/(ings|ing|ed|es|s)$/u, '') || word;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Feature-hashing embedder for demo mode and tests. It is lexical, not
 * semantic: overlapping words (after stemming) make vectors similar. That is
 * enough to exercise retrieval, ranking and citations deterministically and
 * with the same dimensionality as the real model.
 */
export function createFakeEmbedder(dimensions: number = VECTOR_DIMENSIONS): Embedder {
  return {
    modelId: 'fake-embedder',
    dimensions,
    // Hashed bag-of-words vectors are sparse; one shared keyword in a long
    // chunk already lands around 0.1.
    relevanceFloor: 0.08,
    async embed(text: string) {
      const vector = new Float32Array(dimensions);
      const words = (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
        .filter((w) => !STOP.has(w))
        .map(stem);
      words.forEach((word, i) => {
        const h = hash(word);
        vector[h % dimensions] = (vector[h % dimensions] ?? 0) + ((h >>> 31) & 1 ? 1 : -1);
        const next = words[i + 1];
        if (next) {
          const b = hash(`${word} ${next}`);
          vector[b % dimensions] = (vector[b % dimensions] ?? 0) + ((b >>> 31) & 1 ? 0.5 : -0.5);
        }
      });
      return l2Normalize(vector);
    },
    dispose() {},
  };
}
