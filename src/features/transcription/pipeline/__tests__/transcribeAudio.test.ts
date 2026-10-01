import { isAppError } from '@/core/errors/AppError';

import { createFakeSpeechToText } from '../../engine/fakeSpeechToText';
import { type SpeechToText } from '../../engine/SpeechToText';
import { transcribeAudio } from '../transcribeAudio';

const RATE = 16_000;
const tone = (seconds: number) =>
  Float32Array.from({ length: seconds * RATE }, (_, i) => Math.sin(i / 8) * 0.3);

describe('transcribeAudio', () => {
  it('produces timed sentence segments and reports progress up to 1', async () => {
    const engine = createFakeSpeechToText(
      'Buy oat milk. Call the dentist about Friday. Book the train.',
    );
    const progress: number[] = [];
    let clock = 0;
    const result = await transcribeAudio(engine, tone(8), {
      language: 'en',
      onProgress: (fraction) => progress.push(fraction),
      now: () => (clock += 2_000),
    });

    expect(result.segments.map((s) => s.text)).toEqual([
      'Buy oat milk.',
      'Call the dentist about Friday.',
      'Book the train.',
    ]);
    expect(result.segments.at(-1)?.endMs).toBe(8_000);
    expect(progress[0]).toBe(0);
    expect(progress.at(-1)).toBe(1);
    expect(result.audioMs).toBe(8_000);
    expect(result.realTimeFactor).toBeCloseTo(2_000 / 8_000);
  });

  it('skips silent audio without calling the engine', async () => {
    const engine = createFakeSpeechToText('should not appear');
    const spy = jest.spyOn(engine, 'transcribe');
    const result = await transcribeAudio(engine, new Float32Array(RATE * 3), { language: 'en' });
    expect(spy).not.toHaveBeenCalled();
    expect(result.segments).toEqual([]);
  });

  it('stops between chunks when cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const error = await transcribeAudio(createFakeSpeechToText('x'), tone(2), {
      language: 'en',
      signal: controller.signal,
    }).catch((e: unknown) => e);
    expect(isAppError(error, 'CANCELLED')).toBe(true);
  });

  it('wraps engine failures in a typed error', async () => {
    const broken: SpeechToText = {
      modelId: 'broken',
      sampleRate: RATE,
      languages: ['en'],
      transcribe: () => Promise.reject(new Error('native boom')),
      dispose: () => undefined,
    };
    const error = await transcribeAudio(broken, tone(2), { language: 'en' }).catch(
      (e: unknown) => e,
    );
    expect(isAppError(error, 'TRANSCRIPTION_FAILED')).toBe(true);
  });

  it('streams partial text from engine tokens', async () => {
    const partials: string[] = [];
    await transcribeAudio(createFakeSpeechToText('hello there friend'), tone(2), {
      language: 'en',
      onProgress: (_, text) => partials.push(text),
    });
    expect(partials).toContain('hello');
    expect(partials.at(-1)).toBe('hello there friend');
  });
});
