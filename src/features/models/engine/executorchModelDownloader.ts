import { fileAt } from '@/core/platform/files';
import { download, setTelemetryEnabled } from 'react-native-executorch';

import { AppError, isAppError, toAppError } from '@/core/errors/AppError';

import { type ModelSpec } from '../catalog';
import { executorchConfigFor } from './executorchModels';
import { localPaths, type ModelDownloader } from './ModelDownloader';

// The library sends an anonymous analytics event per model download unless
// told not to. Murmur promises no traffic beyond the model files themselves.
setTelemetryEnabled(false);

/**
 * The one module in the app that performs network I/O (enforced by an ESLint
 * rule and a Jest test). It fetches model files from Hugging Face through the
 * ExecuTorch fetcher, which resumes interrupted downloads and caches by URL.
 */
export function createExecutorchModelDownloader(): ModelDownloader {
  return {
    async download(spec: ModelSpec, { onProgress, signal }) {
      try {
        const resolved = await download(executorchConfigFor(spec.id), { onProgress, signal });
        return { resolved, bytes: sizeOf(resolved) };
      } catch (error) {
        if (signal.aborted) throw new AppError('CANCELLED', 'Download cancelled', { cause: error });
        if (isAppError(error)) throw error;
        throw toAppError(error, 'MODEL_DOWNLOAD_FAILED', `Could not download ${spec.name}`);
      }
    },
    async measure(resolved) {
      return sizeOf(resolved);
    },
    async remove(resolved) {
      for (const path of localPaths(resolved)) {
        const file = fileAt(path);
        if (file.exists) file.delete();
      }
    },
  };
}

function sizeOf(resolved: unknown): number {
  let total = 0;
  for (const path of localPaths(resolved)) {
    const file = fileAt(path);
    if (!file.exists) return 0;
    total += file.size;
  }
  return total;
}
