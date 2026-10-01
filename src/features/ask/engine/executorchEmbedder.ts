import {
  createTextEmbedder,
  type TextEmbedder,
  type TextEmbedderModel,
} from 'react-native-executorch';

import { toAppError } from '@/core/errors/AppError';

import { l2Normalize } from '../lib/vectors';
import { type Embedder } from './Embedder';

export function createExecutorchEmbedder({
  modelId,
  dimensions,
  relevanceFloor,
  resolve,
}: {
  modelId: string;
  dimensions: number;
  relevanceFloor: number;
  resolve: () => Promise<TextEmbedderModel>;
}): Embedder {
  let loading: Promise<TextEmbedder> | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  const load = () => {
    loading ??= resolve()
      .then((config) => createTextEmbedder(config))
      .catch((error: unknown) => {
        loading = null;
        throw toAppError(error, 'MODEL_NOT_INSTALLED');
      });
    return loading;
  };

  const run = async (text: string) => {
    const embedder = await load();
    try {
      const vector = await embedder.embed(text);
      if (vector.length !== dimensions) {
        throw new Error(`Expected ${dimensions} dimensions, model returned ${vector.length}`);
      }
      // The model already normalises; doing it again is cheap insurance for
      // swapped-in models that do not.
      return l2Normalize(vector);
    } catch (error) {
      throw toAppError(error, 'EMBEDDING_FAILED');
    }
  };

  return {
    modelId,
    dimensions,
    relevanceFloor,
    // The native embedder rejects concurrent calls with RESOURCE_BUSY.
    embed(text) {
      const next = queue.then(() => run(text));
      queue = next.catch(() => undefined);
      return next;
    },
    dispose() {
      void loading?.then((embedder) => embedder.dispose()).catch(() => undefined);
      loading = null;
    },
  };
}
