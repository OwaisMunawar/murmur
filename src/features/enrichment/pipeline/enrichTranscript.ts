import { toAppError } from '@/core/errors/AppError';
import { type Enrichment, type EnrichmentSource } from '@/features/notes/model';

import { type ChatTurn, type Generation, type TextGenerator } from '../engine/TextGenerator';
import { heuristicEnrichment } from '../lib/heuristics';
import { dropExampleLeaks } from '../lib/leaks';
import { extractJsonObject, salvageFields } from '../lib/parseJson';
import {
  buildEnrichmentMessages,
  buildRepairMessages,
  ENRICHMENT_PREFIX,
  repairPrefix,
} from '../lib/prompts';
import { checkFields, FIELD_NAMES, toEnrichment, type FieldName, type Fields } from '../lib/schema';

export type EnrichmentResult = {
  enrichment: Enrichment;
  source: EnrichmentSource;
  attempts: number;
  generations: Generation[];
  /** Fields that came from the heuristic instead of the model. */
  filled: FieldName[];
};

const GENERATION = { maxTokens: 320, temperature: 0.1 } as const;
// A repair asks for a few short fields; a tight cap stops a degenerate reply
// (a 350M model can loop on quotes) from costing seconds.
const REPAIR = { maxTokens: 160, temperature: 0.1 } as const;

/**
 * Generate, validate field by field, repair once, then fill the gaps.
 *
 * 1. The model answers; every field is validated on its own.
 * 2. Fields that are missing, invalid, or copied from the worked example are
 *    requested again, and only those fields.
 * 3. Whatever is still missing comes from the heuristic, field by field.
 *
 * One repair round recovers most of what a small model gets wrong; a second
 * rarely helps and doubles the wait.
 */
export async function enrichTranscript(
  transcript: string,
  generator: TextGenerator | null,
  options: { signal?: AbortSignal } = {},
): Promise<EnrichmentResult> {
  const fallback = toFields(heuristicEnrichment(transcript));
  if (!generator || transcript.trim().length === 0) {
    return {
      enrichment: toEnrichment(fallback),
      source: 'heuristic',
      attempts: 0,
      generations: [],
      filled: [...FIELD_NAMES],
    };
  }

  const generations: Generation[] = [];
  const ask = async (
    messages: ChatTurn[],
    settings: typeof GENERATION | typeof REPAIR,
    prefix: string,
  ) => {
    try {
      const generation = await generator.generate(messages, {
        ...settings,
        prefix,
        signal: options.signal,
      });
      generations.push(generation);
      return generation.text;
    } catch (error) {
      const appError = toAppError(error, 'GENERATION_FAILED');
      if (appError.code === 'CANCELLED') throw appError;
      return '';
    }
  };

  const first = await ask(buildEnrichmentMessages(transcript), GENERATION, ENRICHMENT_PREFIX);
  let fields = readFields(first, transcript);
  let attempts = 1;

  const missing = FIELD_NAMES.filter((name) => fields[name] === undefined);
  if (missing.length > 0) {
    attempts = 2;
    const second = await ask(
      buildRepairMessages(transcript, first, missing),
      REPAIR,
      repairPrefix(missing),
    );
    // Fields from the first answer win; the repair only fills gaps.
    fields = { ...readFields(second, transcript), ...fields };
  }

  const filled = FIELD_NAMES.filter((name) => fields[name] === undefined);
  const complete: Fields = { ...fallback, ...fields };
  const fromModel = fields.title !== undefined || fields.summary !== undefined;
  return {
    enrichment: toEnrichment(complete),
    source: attempts === 1 && filled.length === 0 ? 'model' : fromModel ? 'repaired' : 'heuristic',
    attempts,
    generations,
    filled,
  };
}

/** Valid, non-leaked fields from one model reply, recovered by JSON parse or key-by-key salvage. */
export function readFields(output: string, transcript: string): Partial<Fields> {
  const parsed = extractJsonObject(output);
  const salvaged = salvageFields(output, FIELD_NAMES);
  const merged = parsed.ok ? { ...salvaged, ...parsed.value } : salvaged;
  return dropExampleLeaks(checkFields(merged).valid, transcript);
}

function toFields(enrichment: Enrichment): Fields {
  return {
    title: enrichment.title,
    summary: enrichment.summary,
    tags: enrichment.tags,
    action_items: enrichment.actionItems,
    mood: enrichment.mood,
  };
}
