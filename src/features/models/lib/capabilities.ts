import { type ModelKind } from '../catalog';

export type Capabilities = {
  canTranscribe: boolean;
  canWriteSummaries: boolean;
  canSearchByMeaning: boolean;
  canAnswer: boolean;
  missing: ModelKind[];
};

/**
 * What the app can do with the models on disk. Recording always works;
 * everything else degrades to a clear "needs model X" state.
 */
export function capabilitiesFor(installed: ReadonlySet<ModelKind>): Capabilities {
  const speech = installed.has('speech');
  const language = installed.has('language');
  const embedding = installed.has('embedding');
  return {
    canTranscribe: speech,
    canWriteSummaries: language,
    canSearchByMeaning: embedding,
    canAnswer: embedding && language,
    missing: (['speech', 'language', 'embedding'] as const).filter((kind) => !installed.has(kind)),
  };
}

export function describeMissing(missing: readonly ModelKind[]): string | null {
  if (missing.length === 0) return null;
  const parts: Record<ModelKind, string> = {
    speech: 'transcription',
    language: 'summaries and answers',
    embedding: 'search by meaning',
  };
  const list = missing.map((kind) => parts[kind]);
  const joined =
    list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0];
  return `Download models to turn on ${joined}.`;
}
