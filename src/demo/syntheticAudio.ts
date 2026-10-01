/**
 * Speech-shaped placeholder audio for seeded demo notes: quiet filtered noise
 * that swells per syllable and pauses between sentences. It gives the
 * playback scrubber a realistic waveform without shipping megabytes of WAV.
 * Seeded PRNG, so every install draws the same waveform.
 */
export function syntheticSpeech(
  sentenceSpans: readonly { startMs: number; endMs: number }[],
  durationMs: number,
  sampleRate = 16_000,
  seed = 7,
): Float32Array {
  const samples = new Float32Array(Math.round((durationMs / 1000) * sampleRate));
  let state = seed >>> 0 || 1;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 0xffffffff) * 2 - 1;
  };

  let smoothed = 0;
  for (const span of sentenceSpans) {
    const start = Math.round((span.startMs / 1000) * sampleRate);
    // A short pause at the end of each sentence.
    const end = Math.min(samples.length, Math.round(((span.endMs - 250) / 1000) * sampleRate));
    const syllable = 0.19 + (random() + 1) * 0.04;
    for (let i = start; i < end; i++) {
      const t = (i - start) / sampleRate;
      const envelope = Math.max(0, Math.sin((Math.PI * t) / syllable)) ** 1.5;
      const swell = 0.55 + 0.45 * Math.sin((2 * Math.PI * t) / 2.3 + span.startMs);
      smoothed = smoothed * 0.82 + random() * 0.18;
      samples[i] = Math.max(-1, Math.min(1, smoothed * envelope * swell * 2.4));
    }
  }
  return samples;
}

/** Evenly spaced sentence spans with a realistic speaking rate. */
export function sentenceSpans(
  sentences: readonly string[],
  msPerChar = 62,
): { startMs: number; endMs: number }[] {
  let cursor = 300;
  return sentences.map((sentence) => {
    const startMs = cursor;
    const endMs = startMs + Math.max(1_200, sentence.length * msPerChar);
    cursor = endMs + 350;
    return { startMs, endMs };
  });
}
