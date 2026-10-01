import { type SqlDriver } from '@/core/db/SqlDriver';
import { createFakeEmbedder } from '@/features/ask/engine/fakeEmbedder';
import { createFakeTextGenerator } from '@/features/enrichment/engine/fakeTextGenerator';
import { MODEL_CATALOG } from '@/features/models/catalog';
import { createInstalledModelsRepository } from '@/features/models/data/installedModelsRepository';
import { createFakeModelDownloader } from '@/features/models/engine/fakeModelDownloader';
import { createFakeSpeechToText } from '@/features/transcription/engine/fakeSpeechToText';
import { DEMO_RECORDING_SCRIPT } from '@/demo/notes';
import { demoRespond } from '@/demo/responders';
import { seedDemoNotes } from '@/demo/seed';

import { type AppServices, type ServiceParts } from './AppServices';

/** Fakes behind the same interfaces as the real engines. */
export function demoParts(): Pick<ServiceParts, 'downloader' | 'engines'> {
  return {
    downloader: createFakeModelDownloader(),
    engines: () => ({
      // Paced so the bundled 14.5 s sample clip yields the whole script.
      speechToText: createFakeSpeechToText(DEMO_RECORDING_SCRIPT, { wordsPerSecond: 3.6 }),
      textGenerator: createFakeTextGenerator(demoRespond, { modelId: 'demo-llm' }),
      embedder: createFakeEmbedder(),
    }),
  };
}

/** Records every model as installed; the fake downloader treats these configs as present on disk. */
export async function installDemoModels(db: SqlDriver): Promise<void> {
  const installed = createInstalledModelsRepository(db);
  for (const spec of MODEL_CATALOG) {
    await installed.save({
      id: spec.id,
      resolved: { fake: spec.id },
      bytes: spec.downloadBytes,
      installedAt: Date.now(),
    });
  }
}

/** Marks every model installed and seeds the fictional notes on first launch. */
export async function seedDemo(services: AppServices): Promise<void> {
  await installDemoModels(services.db);
  await seedDemoNotes({
    notes: services.notes,
    chunks: services.chunks,
    audio: services.audio,
    embedder: services.engines.embedder,
    now: Date.now(),
  });
}
