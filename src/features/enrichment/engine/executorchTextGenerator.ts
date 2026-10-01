import { scheduleOnRN } from 'react-native-worklets';
import { fileAt } from '@/core/platform/files';
import { llm, wrapAsync, type LLMModel } from 'react-native-executorch';

import { AppError, toAppError } from '@/core/errors/AppError';

import {
  type ChatTurn,
  type GenerateOptions,
  type Generation,
  type TextGenerator,
} from './TextGenerator';

type Loaded = {
  runner: llm.LLMRunner;
  preprocessor: llm.ChatPreprocessor;
  stopTokens: readonly string[];
  bosToken: string;
};

/**
 * Runs on the library's low-level runner rather than its chat session: the
 * session keeps a growing history, while every call here must start from an
 * empty KV cache. The chat template still comes from the model's own
 * tokenizer_config.json, so prompts are formatted exactly as it was trained.
 */
export function createExecutorchTextGenerator({
  modelId,
  resolve,
}: {
  modelId: string;
  resolve: () => Promise<LLMModel>;
}): TextGenerator {
  let loading: Promise<Loaded> | null = null;
  // Generations share one runner and one KV cache; they must not interleave.
  let queue: Promise<unknown> = Promise.resolve();

  const load = () => {
    loading ??= (async () => {
      const config = await resolve();
      const raw = JSON.parse(await fileAt(config.tokenizerConfigPath).text()) as Record<
        string,
        unknown
      >;
      const tokenizerConfig = llm.parseTokenizerConfig(raw);
      const preprocessor = llm.createChatPreprocessor({
        chatTemplate: tokenizerConfig.chatTemplate,
      });
      const runner = await wrapAsync(llm.createLLMRunner)(config.modelPath, config.tokenizerPath);
      return {
        runner,
        preprocessor,
        stopTokens: tokenizerConfig.stopTokens,
        bosToken: templateBosToken(tokenizerConfig.chatTemplate, raw.bos_token),
      };
    })().catch((error: unknown) => {
      loading = null;
      throw toAppError(error, 'MODEL_NOT_INSTALLED');
    });
    return loading;
  };

  const run = async (
    messages: readonly ChatTurn[],
    options: GenerateOptions,
  ): Promise<Generation> => {
    const { runner, preprocessor, stopTokens, bosToken } = await load();
    if (options.signal?.aborted) throw new AppError('CANCELLED', 'Generation cancelled');

    runner.reset(0);
    const prefix = options.prefix ?? '';
    const { text: rendered } = preprocessor.render(messages, { addGenPrompt: true });
    const prompt = (rendered.startsWith(bosToken) ? rendered : bosToken + rendered) + prefix;
    const onToken = options.onToken;
    const stop = () => runner.stop();
    options.signal?.addEventListener('abort', stop, { once: true });

    try {
      const { response, stats } = await wrapAsync(generateWorklet)(
        runner,
        prompt,
        { maxNewTokens: options.maxTokens, temperature: options.temperature },
        stopTokens,
        onToken,
      );
      if (options.signal?.aborted) throw new AppError('CANCELLED', 'Generation cancelled');
      return {
        text: prefix + response,
        promptTokens: stats.numPromptTokens,
        generatedTokens: stats.numGeneratedTokens,
        durationMs: Math.max(0, stats.inferenceEndMs - stats.firstTokenMs),
      };
    } catch (error) {
      throw toAppError(error, 'GENERATION_FAILED');
    } finally {
      options.signal?.removeEventListener('abort', stop);
    }
  };

  return {
    modelId,
    generate(messages, options) {
      const next = queue.then(() => run(messages, options));
      queue = next.catch(() => undefined);
      return next;
    },
    dispose() {
      void loading
        ?.then(({ runner, preprocessor }) => {
          preprocessor.dispose();
          runner.dispose();
        })
        .catch(() => undefined);
      loading = null;
    },
  };
}

const MAX_REPEATED_TOKENS = 12;

/**
 * The library renders chat templates without a `bos_token` variable, so a
 * template that opens with `{{ bos_token }}` (LFM2.5 does) loses its
 * beginning-of-sequence marker. Without it the 350M model often ends its
 * reply after one token unless a prefix steers it. Returns the token to
 * prepend, or '' when the template does not use one.
 */
function templateBosToken(template: string, bos: unknown): string {
  if (!/\bbos_token\b/.test(template)) return '';
  if (typeof bos === 'string') return bos;
  if (bos && typeof bos === 'object' && 'content' in bos && typeof bos.content === 'string')
    return bos.content;
  return '';
}

/** Runs on the ExecuTorch worklet runtime; tokens hop back to JS for streaming UI. */
function generateWorklet(
  runner: llm.LLMRunner,
  prompt: string,
  config: llm.LLMGenerationConfig,
  stopTokens: readonly string[],
  onToken: ((token: string) => void) | undefined,
) {
  'worklet';
  let response = '';
  let previous = '';
  let repeats = 0;
  const stats = runner.generate(prompt, config, (token: string) => {
    if (stopTokens.includes(token)) return;
    // Small models occasionally lock onto one token, such as an endless run
    // of quotes. Nothing useful follows, so stop instead of spending the
    // whole token budget.
    repeats = token === previous ? repeats + 1 : 0;
    previous = token;
    if (repeats >= MAX_REPEATED_TOKENS) {
      runner.stop();
      return;
    }
    response += token;
    if (onToken) scheduleOnRN(onToken, token);
  });
  return { response, stats };
}
