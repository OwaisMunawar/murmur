import { type Segment } from '@/features/notes/model';

/**
 * Bracketed or parenthesised annotations Whisper emits for non-speech
 * ("[BLANK_AUDIO]", "(wind blowing)"). They are not words the user said.
 */
const ANNOTATION = /\s*[[(][^\])]{0,40}[\])]\s*/g;
const SPECIAL_TOKEN = /<\|[^|]*\|>/g;

export function cleanTranscript(text: string): string {
  return text.replace(SPECIAL_TOKEN, ' ').replace(ANNOTATION, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Sentence split that keeps terminal punctuation and survives missing
 * punctuation. A full stop followed by a digit is not a sentence end:
 * Whisper writes times and amounts as "9.15" and "3.50".
 */
export function splitSentences(text: string): string[] {
  const matches = text.match(/(?:[^.!?]|\.(?=\d))+(?:[.!?]+["')\]]*|$)/g) ?? [];
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

export type TimedText = { startMs: number; endMs: number; text: string };

/**
 * Turns chunk-level transcripts into sentence-level segments. Whisper here
 * returns text without word timings, so each sentence gets a time span
 * proportional to its length within its chunk. Good enough to seek to the
 * right moment; documented as approximate.
 */
export function toSentenceSegments(chunks: readonly TimedText[]): Segment[] {
  const segments: Segment[] = [];
  for (const chunk of chunks) {
    // Whisper often starts a chunk mid-sentence in lower case.
    const sentences = splitSentences(cleanTranscript(chunk.text)).map(
      (s) => s.charAt(0).toUpperCase() + s.slice(1),
    );
    const totalChars = sentences.reduce((n, s) => n + s.length, 0);
    let cursor = chunk.startMs;
    const span = chunk.endMs - chunk.startMs;
    sentences.forEach((sentence, index) => {
      const isLast = index === sentences.length - 1;
      const end = isLast ? chunk.endMs : cursor + Math.round((span * sentence.length) / totalChars);
      segments.push({ position: segments.length, startMs: cursor, endMs: end, text: sentence });
      cursor = end;
    });
  }
  return segments;
}

/** The segment playing at `ms`, for highlighting during playback. */
export function activeSegmentIndex(segments: readonly Segment[], ms: number): number {
  let low = 0;
  let high = segments.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const segment = segments[mid]!;
    if (segment.startMs <= ms) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

/**
 * Picks the transcription language: the user's choice when set, otherwise the
 * device language when the model knows it, otherwise English.
 */
export function resolveLanguage(
  preferred: string | null,
  deviceLanguages: readonly string[],
  supported: readonly string[],
): string {
  if (preferred && supported.includes(preferred)) return preferred;
  const device = deviceLanguages
    .map((tag) => tag.split('-')[0]?.toLowerCase())
    .find((code) => code && supported.includes(code));
  return device ?? (supported.includes('en') ? 'en' : (supported[0] ?? 'en'));
}
