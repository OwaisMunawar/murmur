/**
 * Minimal RIFF/WAVE codec. Recordings are stored as 16-bit PCM WAV because the
 * format needs no native decoder: the transcription pipeline can read samples
 * straight back on both platforms, and the system player handles playback.
 */

export type DecodedAudio = {
  sampleRate: number;
  /** Mono samples in [-1, 1]. Multi-channel input is averaged down. */
  samples: Float32Array;
};

const HEADER_BYTES = 44;

export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(HEADER_BYTES + dataBytes);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataBytes, true);

  let offset = HEADER_BYTES;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    // Asymmetric scale: int16 holds one more negative step than positive.
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  }
  return new Uint8Array(buffer);
}

/**
 * Decodes 16-bit integer or 32-bit float PCM. Unknown chunks (LIST, fact, the
 * FLLR padding iOS inserts) are skipped by walking chunk sizes rather than
 * assuming a fixed 44-byte header.
 */
export function decodeWav(bytes: Uint8Array): DecodedAudio {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12 || readAscii(view, 0) !== 'RIFF' || readAscii(view, 8) !== 'WAVE') {
    throw new Error('Not a RIFF/WAVE file');
  }

  let format: {
    audioFormat: number;
    channels: number;
    sampleRate: number;
    bitsPerSample: number;
  } | null = null;
  let offset = 12;

  while (offset + 8 <= view.byteLength) {
    const id = readAscii(view, offset);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;

    if (id === 'fmt ') {
      format = {
        audioFormat: view.getUint16(body, true),
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        bitsPerSample: view.getUint16(body + 14, true),
      };
    } else if (id === 'data') {
      if (!format) throw new Error('WAV data chunk appears before fmt chunk');
      const end = Math.min(body + size, view.byteLength);
      return { sampleRate: format.sampleRate, samples: readSamples(view, body, end, format) };
    }
    // Chunks are word-aligned: odd sizes carry one pad byte.
    offset = body + size + (size % 2);
  }
  throw new Error('WAV file has no data chunk');
}

function readSamples(
  view: DataView,
  start: number,
  end: number,
  format: { audioFormat: number; channels: number; bitsPerSample: number },
): Float32Array {
  const { audioFormat, channels, bitsPerSample } = format;
  const isFloat = audioFormat === 3 && bitsPerSample === 32;
  const isInt16 = audioFormat === 1 && bitsPerSample === 16;
  // WAVE_FORMAT_EXTENSIBLE (0xFFFE) wraps the same layouts; trust the bit depth.
  const extensible = audioFormat === 0xfffe;
  if (!isFloat && !isInt16 && !extensible) {
    throw new Error(`Unsupported WAV encoding (format ${audioFormat}, ${bitsPerSample}-bit)`);
  }
  const bytesPerSample = bitsPerSample / 8;
  const frameBytes = bytesPerSample * channels;
  const frames = Math.floor((end - start) / frameBytes);
  const out = new Float32Array(frames);
  const asFloat = isFloat || (extensible && bitsPerSample === 32);

  for (let frame = 0; frame < frames; frame++) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel++) {
      const at = start + frame * frameBytes + channel * bytesPerSample;
      sum += asFloat ? view.getFloat32(at, true) : view.getInt16(at, true) / 0x8000;
    }
    out[frame] = sum / channels;
  }
  return out;
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

function readAscii(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}
