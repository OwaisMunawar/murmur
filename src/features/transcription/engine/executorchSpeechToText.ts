import {
  createWhisperSpeechToText,
  WHISPER_SAMPLE_RATE_HZ,
  type WhisperLanguage,
  type WhisperSpeechToText,
  type WhisperSttModel,
} from 'react-native-executorch';

import { AppError, toAppError } from '@/core/errors/AppError';

import { type SpeechToText } from './SpeechToText';

/**
 * Whisper through ExecuTorch. The library runs inference on its own worklet
 * runtime, so `transcribe` never blocks the JS thread; this wrapper only adds
 * lazy loading, cancellation and error codes.
 */
export function createExecutorchSpeechToText({
  modelId,
  languages,
  resolve,
}: {
  modelId: string;
  languages: readonly string[];
  /** Local model paths; rejects when the model is not downloaded yet. */
  resolve: () => Promise<WhisperSttModel>;
}): SpeechToText {
  let loading: Promise<WhisperSpeechToText> | null = null;

  const load = () => {
    loading ??= resolve()
      .then((config) => createWhisperSpeechToText(config))
      .catch((error: unknown) => {
        loading = null;
        throw toAppError(error, 'MODEL_NOT_INSTALLED');
      });
    return loading;
  };

  return {
    modelId,
    sampleRate: WHISPER_SAMPLE_RATE_HZ,
    languages,
    async transcribe(samples, { language, signal, onToken }) {
      const whisper = await load();
      if (signal?.aborted) throw new AppError('CANCELLED', 'Transcription cancelled');
      const abort = () => whisper.transcribeStop();
      signal?.addEventListener('abort', abort, { once: true });
      try {
        return await whisper.transcribe(
          samples,
          { language: language as WhisperLanguage },
          onToken,
        );
      } catch (error) {
        if (signal?.aborted)
          throw new AppError('CANCELLED', 'Transcription cancelled', { cause: error });
        throw toAppError(error, 'TRANSCRIPTION_FAILED');
      } finally {
        signal?.removeEventListener('abort', abort);
      }
    },
    dispose() {
      void loading?.then((whisper) => whisper.dispose()).catch(() => undefined);
      loading = null;
    },
  };
}
