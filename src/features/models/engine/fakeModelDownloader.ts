import { AppError } from '@/core/errors/AppError';

import { type ModelSpec } from '../catalog';
import { type DownloadResult, type ModelDownloader } from './ModelDownloader';

/**
 * Offline downloader for demo mode and tests: reports progress in steps and
 * "installs" nothing but a marker config.
 */
export function createFakeModelDownloader({ steps = 4 }: { steps?: number } = {}): ModelDownloader {
  return {
    async download(spec: ModelSpec, { onProgress, signal }): Promise<DownloadResult> {
      for (let step = 1; step <= steps; step++) {
        await Promise.resolve();
        if (signal.aborted) throw new AppError('CANCELLED', 'Download cancelled');
        onProgress(step / steps);
      }
      return { resolved: { fake: spec.id }, bytes: spec.downloadBytes };
    },
    async measure(resolved) {
      return resolved && typeof resolved === 'object' && 'fake' in resolved ? 1 : 0;
    },
    async remove() {},
  };
}
