import { rms } from '@/features/recording/lib/pcm';

export type AudioChunk = {
  start: number;
  end: number;
  /** True when the chunk is effectively silence and should not reach the model. */
  silent: boolean;
};

export type ChunkPlanOptions = {
  sampleRate: number;
  /** Preferred chunk length. Shorter chunks give finer timestamps and progress. */
  targetMs?: number;
  /** Hard ceiling; Whisper's window is 30 s and the export uses 29 s. */
  maxMs?: number;
  /** Energy frame used to find pauses. */
  frameMs?: number;
  /** RMS below which a frame counts as silence (about -46 dBFS). */
  silenceRms?: number;
};

/**
 * Splits a recording into chunks for Whisper, cutting at the quietest moment
 * between `targetMs` and `maxMs` so words are not sliced in half.
 *
 * Whole-silence chunks are flagged: Whisper tends to hallucinate filler such
 * as "Thank you." on silent input, so those never reach the model.
 */
export function planChunks(samples: Float32Array, options: ChunkPlanOptions): AudioChunk[] {
  const {
    sampleRate,
    targetMs = 12_000,
    maxMs = 25_000,
    frameMs = 30,
    silenceRms = 0.005,
  } = options;
  const frame = Math.max(1, Math.round((frameMs / 1000) * sampleRate));
  const target = Math.round((targetMs / 1000) * sampleRate);
  const max = Math.max(target, Math.round((maxMs / 1000) * sampleRate));

  const chunks: AudioChunk[] = [];
  let start = 0;
  while (start < samples.length) {
    let end: number;
    if (samples.length - start <= max) {
      end = samples.length;
    } else {
      end = quietestCut(samples, start + target, start + max, frame);
    }
    chunks.push({ start, end, silent: isSilent(samples, start, end, frame, silenceRms) });
    start = end;
  }
  return chunks;
}

function quietestCut(samples: Float32Array, from: number, to: number, frame: number): number {
  let best = to;
  let bestEnergy = Number.POSITIVE_INFINITY;
  for (let at = from; at + frame <= to; at += frame) {
    const energy = rms(samples, at, at + frame);
    if (energy < bestEnergy) {
      bestEnergy = energy;
      best = at + Math.floor(frame / 2);
    }
  }
  return best;
}

function isSilent(
  samples: Float32Array,
  start: number,
  end: number,
  frame: number,
  threshold: number,
): boolean {
  for (let at = start; at < end; at += frame) {
    if (rms(samples, at, Math.min(end, at + frame)) >= threshold) return false;
  }
  return true;
}
