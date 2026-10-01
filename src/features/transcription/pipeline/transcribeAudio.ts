import { AppError, toAppError } from '@/core/errors/AppError';
import { type Segment } from '@/features/notes/model';

import { type SpeechToText } from '../engine/SpeechToText';
import { planChunks } from '../lib/chunkPlan';
import { toSentenceSegments, type TimedText } from '../lib/transcript';

export type TranscriptionResult = {
  segments: Segment[];
  audioMs: number;
  elapsedMs: number;
  /** Processing time divided by audio time. Below 1 is faster than real time. */
  realTimeFactor: number;
};

/**
 * Chunked transcription: silence-aware chunks go to the engine one at a time,
 * so progress is real (chunks done over audio length), cancellation lands
 * between chunks, and every sentence keeps an approximate timestamp.
 */
export async function transcribeAudio(
  engine: SpeechToText,
  samples: Float32Array,
  options: {
    language: string;
    signal?: AbortSignal;
    onProgress?: (fraction: number, partialText: string) => void;
    now?: () => number;
  },
): Promise<TranscriptionResult> {
  const now = options.now ?? Date.now;
  const started = now();
  const rate = engine.sampleRate;
  const chunks = planChunks(samples, { sampleRate: rate });
  const timed: TimedText[] = [];
  let partial = '';
  options.onProgress?.(0, '');

  for (const chunk of chunks) {
    if (options.signal?.aborted) throw new AppError('CANCELLED', 'Transcription cancelled');
    const startMs = Math.round((chunk.start / rate) * 1000);
    const endMs = Math.round((chunk.end / rate) * 1000);
    if (!chunk.silent) {
      let text: string;
      let streamed = '';
      try {
        text = await engine.transcribe(samples.subarray(chunk.start, chunk.end), {
          language: options.language,
          offsetMs: startMs,
          signal: options.signal,
          onToken: (token) => {
            streamed += token;
            options.onProgress?.(chunk.start / samples.length, `${partial} ${streamed}`.trim());
          },
        });
      } catch (error) {
        throw toAppError(error, 'TRANSCRIPTION_FAILED');
      }
      timed.push({ startMs, endMs, text });
      partial = `${partial} ${text}`.trim();
    }
    options.onProgress?.(chunk.end / samples.length, partial);
  }

  const audioMs = Math.round((samples.length / rate) * 1000);
  const elapsedMs = now() - started;
  return {
    segments: toSentenceSegments(timed),
    audioMs,
    elapsedMs,
    realTimeFactor: audioMs > 0 ? elapsedMs / audioMs : 0,
  };
}
