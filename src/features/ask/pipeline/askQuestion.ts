import { toAppError } from '@/core/errors/AppError';
import { questionTerms } from '@/features/notes/lib/ftsQuery';
import { type TextGenerator } from '@/features/enrichment/engine/TextGenerator';

import { type ChunkRepository } from '../data/chunkRepository';
import { type Embedder } from '../engine/Embedder';
import { buildAskMessages } from '../lib/askPrompt';
import { parseCitations, type AnswerPart } from '../lib/citations';
import { fuseRankings, selectContext, type ChunkHit } from '../lib/ranking';

export type AskResult =
  | {
      kind: 'answer';
      parts: AnswerPart[];
      sources: ChunkHit[];
      cited: number[];
      tokensPerSecond: number;
    }
  | { kind: 'passages'; sources: ChunkHit[] }
  | { kind: 'nothing-found' };

export type AskDeps = {
  embedder: Embedder;
  chunks: ChunkRepository;
  /** Note ids matching the question by full text, best first. */
  keywordSearch: (question: string) => Promise<string[]>;
  generator: TextGenerator | null;
};

/**
 * Retrieval-augmented answer over the user's notes:
 * embed the question, take the nearest chunks, fuse with keyword matches,
 * keep a few strong passages, and let the local model answer with numbered
 * citations. Without a language model the passages themselves are the answer.
 */
export async function askQuestion(
  deps: AskDeps,
  question: string,
  options: { onToken?: (partial: string) => void; signal?: AbortSignal } = {},
): Promise<AskResult> {
  const vector = await deps.embedder.embed(question);
  const [hits, keywordIds] = await Promise.all([
    deps.chunks.searchSimilar(vector, 12),
    deps.keywordSearch(question).catch(() => [] as string[]),
  ]);
  const sources = selectContext(fuseRankings(hits, keywordIds, questionTerms(question)), {
    minSimilarity: deps.embedder.relevanceFloor,
    keywordNoteIds: keywordIds,
  });
  if (sources.length === 0) return { kind: 'nothing-found' };
  if (!deps.generator) return { kind: 'passages', sources };

  let streamed = '';
  try {
    const generation = await deps.generator.generate(buildAskMessages(question, sources), {
      maxTokens: 220,
      // Greedy decoding: the same question over the same notes should get the same answer.
      temperature: 0,
      signal: options.signal,
      onToken: (token) => {
        streamed += token;
        options.onToken?.(streamed);
      },
    });
    const { parts, cited } = parseCitations(generation.text.trim(), sources.length);
    return {
      kind: 'answer',
      parts,
      cited,
      sources,
      tokensPerSecond:
        generation.durationMs > 0 ? (generation.generatedTokens / generation.durationMs) * 1000 : 0,
    };
  } catch (error) {
    throw toAppError(error, 'GENERATION_FAILED');
  }
}
