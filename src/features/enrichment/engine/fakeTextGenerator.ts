import { AppError } from '@/core/errors/AppError';

import {
  type ChatTurn,
  type GenerateOptions,
  type Generation,
  type TextGenerator,
} from './TextGenerator';

/**
 * Scripted generator. `respond` decides the reply from the messages, which
 * lets demo mode and tests drive enrichment and question answering through
 * the exact same code paths as the real model. Replies stream word by word.
 */
export function createFakeTextGenerator(
  respond: (messages: readonly ChatTurn[]) => string,
  { modelId = 'fake-llm' }: { modelId?: string } = {},
): TextGenerator {
  return {
    modelId,
    async generate(messages: readonly ChatTurn[], options: GenerateOptions): Promise<Generation> {
      if (options.signal?.aborted) throw new AppError('CANCELLED', 'Generation cancelled');
      // Scripted replies are whole outputs. One that honours the prefix
      // streams only its continuation, like a real model would.
      const reply = respond(messages);
      const prefix = options.prefix && reply.startsWith(options.prefix) ? options.prefix : '';
      const continuation = reply.slice(prefix.length);
      const tokens = continuation.match(/\S+\s*/g) ?? [];
      for (const token of tokens.slice(0, options.maxTokens)) options.onToken?.(token);
      return {
        text: prefix + tokens.slice(0, options.maxTokens).join(''),
        promptTokens: Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 4),
        generatedTokens: Math.min(tokens.length, options.maxTokens),
        durationMs: 0,
      };
    },
    dispose() {},
  };
}
