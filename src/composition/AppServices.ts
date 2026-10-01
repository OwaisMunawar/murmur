import { type SqlDriver } from '@/core/db/SqlDriver';
import { createEmitter, type Emitter } from '@/core/lib/store';
import { createChunkRepository, type ChunkRepository } from '@/features/ask/data/chunkRepository';
import { type Embedder } from '@/features/ask/engine/Embedder';
import { type TextGenerator } from '@/features/enrichment/engine/TextGenerator';
import { createInstalledModelsRepository } from '@/features/models/data/installedModelsRepository';
import {
  createModelManager,
  type ModelEnvironment,
  type ModelManager,
} from '@/features/models/data/modelManager';
import { type ModelDownloader } from '@/features/models/engine/ModelDownloader';
import { createNotesRepository, type NotesRepository } from '@/features/notes/data/notesRepository';
import {
  createNoteProcessor,
  type NoteProcessor,
  type NotesChange,
} from '@/features/notes/pipeline/noteProcessor';
import { type AudioStore } from '@/features/recording/data/audioStore';
import {
  createSettingsRepository,
  type SettingsRepository,
} from '@/features/settings/data/settingsRepository';
import { type SpeechToText } from '@/features/transcription/engine/SpeechToText';

export type Engines = {
  speechToText: SpeechToText;
  textGenerator: TextGenerator;
  embedder: Embedder;
};

/**
 * Everything the screens depend on, built once at startup and handed down
 * through context. Swapping an implementation (fake engines in demo mode, an
 * in-memory database in tests) happens here and nowhere else.
 */
export type AppServices = {
  isDemo: boolean;
  db: SqlDriver;
  notes: NotesRepository;
  chunks: ChunkRepository;
  settings: SettingsRepository;
  audio: AudioStore;
  models: ModelManager;
  engines: Engines;
  processor: NoteProcessor;
  changes: Emitter<NotesChange>;
  /** Removes soft-deleted notes and their recordings. */
  purge(ids?: readonly string[]): Promise<void>;
  dispose(): void;
};

export type ServiceParts = {
  isDemo: boolean;
  db: SqlDriver;
  audio: AudioStore;
  downloader: ModelDownloader;
  engines: (resolve: ModelManager['resolve']) => Engines;
  environment: Omit<ModelEnvironment, 'wifiOnly'>;
  deviceLanguages: () => readonly string[];
};

export function buildServices(parts: ServiceParts): AppServices {
  const notes = createNotesRepository(parts.db, parts.environment.now);
  const chunks = createChunkRepository(parts.db);
  const settings = createSettingsRepository(parts.db);
  const changes = createEmitter<NotesChange>();
  const models = createModelManager({
    repository: createInstalledModelsRepository(parts.db),
    downloader: parts.downloader,
    environment: { ...parts.environment, wifiOnly: () => settings.get('wifiOnly') },
  });
  const engines = parts.engines((id) => models.resolve(id));
  const processor = createNoteProcessor({
    notes,
    chunks,
    audio: parts.audio,
    settings,
    isInstalled: (kind) => models.isInstalled(kind),
    engines,
    deviceLanguages: parts.deviceLanguages,
    changes,
    now: parts.environment.now,
  });

  // A model finishing its download can unblock waiting notes.
  let installedCount = 0;
  const unsubscribe = models.store.subscribe(() => {
    const count = Object.values(models.store.get().byId).filter(
      (m) => m.status === 'installed',
    ).length;
    if (count > installedCount) void processor.resume();
    installedCount = count;
  });

  return {
    isDemo: parts.isDemo,
    db: parts.db,
    notes,
    chunks,
    settings,
    audio: parts.audio,
    models,
    engines,
    processor,
    changes,
    async purge(ids) {
      const files = await notes.purgeDeleted(ids);
      for (const file of files) parts.audio.remove(file);
    },
    dispose() {
      unsubscribe();
      processor.cancelAll();
      engines.speechToText.dispose();
      engines.textGenerator.dispose();
      engines.embedder.dispose();
      parts.db.close();
    },
  };
}

/** Startup work shared by the app and tests: model state, crash cleanup, resuming interrupted notes. */
export async function startServices(services: AppServices): Promise<void> {
  await services.models.refresh();
  // Soft deletes still pending when the app last died are final now.
  await services.purge();
  void services.processor.resume();
}
