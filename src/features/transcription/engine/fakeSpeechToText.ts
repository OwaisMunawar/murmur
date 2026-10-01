import { AppError } from '@/core/errors/AppError';

import { type SpeechToText, type TranscribeOptions } from './SpeechToText';

/**
 * Deterministic stand-in for Whisper. It "recognises" a scripted transcript,
 * handing out words in proportion to how much audio each call receives, so
 * chunking, progress and timestamps behave exactly as with the real model.
 */
export function createFakeSpeechToText(
  script: string,
  {
    sampleRate = 16_000,
    wordsPerSecond = 2.6,
  }: { sampleRate?: number; wordsPerSecond?: number } = {},
): SpeechToText {
  const words = script.split(/\s+/).filter(Boolean);
  let cursor = 0;

  return {
    modelId: 'fake-stt',
    sampleRate,
    languages: ['en'],
    async transcribe(samples: Float32Array, options: TranscribeOptions) {
      if (options.signal?.aborted) throw new AppError('CANCELLED', 'Transcription cancelled');
      // A new recording starts the script over.
      if (!options.offsetMs) cursor = 0;
      const count = Math.max(1, Math.round((samples.length / sampleRate) * wordsPerSecond));
      const taken = words.slice(cursor, cursor + count);
      cursor = Math.min(words.length, cursor + count);
      for (const word of taken) options.onToken?.(` ${word}`);
      return taken.join(' ');
    },
    dispose() {},
  };
}
