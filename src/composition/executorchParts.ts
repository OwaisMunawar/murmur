import { VECTOR_DIMENSIONS } from '@/core/db/schema';
import { createExecutorchEmbedder } from '@/features/ask/engine/executorchEmbedder';
import { createExecutorchTextGenerator } from '@/features/enrichment/engine/executorchTextGenerator';
import { createExecutorchModelDownloader } from '@/features/models/engine/executorchModelDownloader';
import { executorchLanguagesFor } from '@/features/models/engine/executorchModels';
import { createExecutorchSpeechToText } from '@/features/transcription/engine/executorchSpeechToText';

import { type ServiceParts } from './AppServices';

/** Real engines: Whisper, LFM2.5 and MiniLM through ExecuTorch, loading lazily from downloaded files. */
export function executorchParts(): Pick<ServiceParts, 'downloader' | 'engines'> {
  return {
    downloader: createExecutorchModelDownloader(),
    engines: (resolve) => ({
      speechToText: createExecutorchSpeechToText({
        modelId: 'whisper-tiny',
        languages: executorchLanguagesFor('whisper-tiny'),
        resolve: () => resolve('whisper-tiny'),
      }),
      textGenerator: createExecutorchTextGenerator({
        modelId: 'lfm2.5-350m',
        resolve: () => resolve('lfm2.5-350m'),
      }),
      embedder: createExecutorchEmbedder({
        modelId: 'minilm-qa',
        dimensions: VECTOR_DIMENSIONS,
        // multi-qa-MiniLM puts unrelated sentence pairs around 0.0 to 0.17 in testing.
        relevanceFloor: 0.2,
        resolve: () => resolve('minilm-qa'),
      }),
    }),
  };
}
