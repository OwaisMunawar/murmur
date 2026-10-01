export type TranscribeOptions = {
  /** Whisper language code. Whisper in ExecuTorch has no language detection, so it is required. */
  language: string;
  /** Where this audio starts within the recording. Engines may ignore it. */
  offsetMs?: number;
  signal?: AbortSignal;
  onToken?: (token: string) => void;
};

/**
 * Speech recognition as the app sees it. Implementations: Whisper through
 * ExecuTorch, and a deterministic fake for demo mode and tests.
 */
export interface SpeechToText {
  readonly modelId: string;
  readonly sampleRate: number;
  readonly languages: readonly string[];
  /** Mono PCM at `sampleRate`. Resolves to the recognised text for that audio only. */
  transcribe(samples: Float32Array, options: TranscribeOptions): Promise<string>;
  dispose(): void;
}
