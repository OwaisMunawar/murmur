/** PCM helpers shared by capture, storage and transcription. All pure. */

/** Averages interleaved channels into one. */
export function toMono(interleaved: Float32Array, channels: number): Float32Array {
  if (channels <= 1) return interleaved;
  const frames = Math.floor(interleaved.length / channels);
  const out = new Float32Array(frames);
  for (let frame = 0; frame < frames; frame++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += interleaved[frame * channels + c] ?? 0;
    out[frame] = sum / channels;
  }
  return out;
}

/**
 * Linear-interpolation resampler. Hardware often ignores the requested 16 kHz
 * and delivers 44.1 or 48 kHz; Whisper needs exactly 16 kHz. Speech energy
 * sits well below the new Nyquist limit, so linear interpolation without a
 * dedicated low-pass filter is adequate for recognition.
 */
export function resampleLinear(
  samples: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate || samples.length === 0) return samples;
  const ratio = fromRate / toRate;
  const length = Math.max(1, Math.round(samples.length / ratio));
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const position = i * ratio;
    const left = Math.floor(position);
    const right = Math.min(left + 1, samples.length - 1);
    const t = position - left;
    out[i] = (samples[left] ?? 0) * (1 - t) + (samples[right] ?? 0) * t;
  }
  return out;
}

export function rms(samples: Float32Array, start = 0, end = samples.length): number {
  const from = Math.max(0, start);
  const to = Math.min(samples.length, end);
  if (to <= from) return 0;
  let sum = 0;
  for (let i = from; i < to; i++) {
    const s = samples[i] ?? 0;
    sum += s * s;
  }
  return Math.sqrt(sum / (to - from));
}

const FLOOR_DB = -55;

/**
 * Maps loudness in dBFS to a 0..1 display level. Speech spans roughly
 * -50..-10 dBFS, so a linear amplitude scale would leave quiet talking
 * invisible; a straight dB scale pins normal speech near the top. Squaring
 * the dB position keeps both quiet words and loud syllables distinguishable.
 */
export function levelFromDb(db: number): number {
  const position = Math.min(1, Math.max(0, (db - FLOOR_DB) / -FLOOR_DB));
  return position * position;
}

export function levelFromRms(value: number): number {
  return value <= 0 ? 0 : levelFromDb(20 * Math.log10(value));
}

/**
 * Reduces a waveform to `buckets` peak levels for drawing a static overview
 * (the playback scrubber). Peaks rather than averages keep short words visible.
 */
export function waveformPeaks(samples: Float32Array, buckets: number): number[] {
  if (buckets <= 0) return [];
  const size = Math.max(1, Math.floor(samples.length / buckets));
  const peaks: number[] = [];
  for (let b = 0; b < buckets; b++) {
    const start = b * size;
    peaks.push(start >= samples.length ? 0 : levelFromRms(rms(samples, start, start + size)));
  }
  return peaks;
}

export function durationMs(sampleCount: number, sampleRate: number): number {
  return sampleRate > 0 ? Math.round((sampleCount / sampleRate) * 1000) : 0;
}
