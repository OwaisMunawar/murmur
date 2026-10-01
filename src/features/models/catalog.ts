export type ModelKind = 'speech' | 'language' | 'embedding';

export type ModelSpec = {
  id: string;
  kind: ModelKind;
  name: string;
  purpose: string;
  /** Sum of the files' Content-Length on Hugging Face, used before anything is on disk. */
  downloadBytes: number;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
};

/**
 * The three models Murmur uses. All run on the XNNPACK CPU backend, the one
 * backend that behaves the same on iOS devices, the iOS simulator and
 * Android, so behaviour in CI screenshots matches phones.
 */
export const MODEL_CATALOG: readonly ModelSpec[] = [
  {
    id: 'whisper-tiny',
    kind: 'speech',
    name: 'Whisper Tiny',
    purpose: 'Turns your recordings into text. Multilingual.',
    downloadBytes: 232_609_280 + 2_480_466 + 1_827_808,
    license: 'MIT (OpenAI Whisper), Apache-2.0 (FSMN-VAD and ExecuTorch export)',
    licenseUrl: 'https://github.com/openai/whisper/blob/main/LICENSE',
    sourceUrl: 'https://huggingface.co/software-mansion/react-native-executorch-whisper-tiny',
  },
  {
    id: 'lfm2.5-350m',
    kind: 'language',
    name: 'LFM2.5 350M',
    purpose: 'Writes titles, summaries, tags and to-dos, and answers your questions.',
    downloadBytes: 277_555_584 + 4_733_383 + 2_979,
    license: 'LFM Open License v1.0',
    licenseUrl: 'https://huggingface.co/LiquidAI/LFM2.5-350M/blob/main/LICENSE',
    sourceUrl: 'https://huggingface.co/software-mansion/react-native-executorch-lfm-2.5',
  },
  {
    id: 'minilm-qa',
    kind: 'embedding',
    name: 'multi-qa MiniLM L6',
    purpose: 'Finds the notes that match a question, by meaning rather than exact words.',
    downloadBytes: 90_391_424 + 711_544,
    license: 'Apache-2.0',
    licenseUrl: 'https://huggingface.co/sentence-transformers/multi-qa-MiniLM-L6-cos-v1',
    sourceUrl:
      'https://huggingface.co/software-mansion/react-native-executorch-multi-qa-MiniLM-L6-cos-v1',
  },
];

export function modelForKind(kind: ModelKind): ModelSpec {
  const spec = MODEL_CATALOG.find((m) => m.kind === kind);
  if (!spec) throw new Error(`No model registered for ${kind}`);
  return spec;
}

export function modelById(id: string): ModelSpec | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}
