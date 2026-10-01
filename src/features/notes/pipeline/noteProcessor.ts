import { isAppError, toAppError } from '@/core/errors/AppError';
import { createStore, type Emitter } from '@/core/lib/store';
import { type ChunkRepository } from '@/features/ask/data/chunkRepository';
import { type Embedder } from '@/features/ask/engine/Embedder';
import { indexNote } from '@/features/ask/pipeline/indexNote';
import { tokensPerSecond, type TextGenerator } from '@/features/enrichment/engine/TextGenerator';
import { enrichTranscript } from '@/features/enrichment/pipeline/enrichTranscript';
import { type ModelKind } from '@/features/models/catalog';
import { type AudioStore } from '@/features/recording/data/audioStore';
import { type SettingsRepository } from '@/features/settings/data/settingsRepository';
import { type SpeechToText } from '@/features/transcription/engine/SpeechToText';
import { resolveLanguage } from '@/features/transcription/lib/transcript';
import { transcribeAudio } from '@/features/transcription/pipeline/transcribeAudio';

import { type NotesRepository } from '../data/notesRepository';
import { type Note } from '../model';

export type ProcessingStage = 'transcribing' | 'enriching' | 'indexing';

export type ProcessingState = {
  stage: ProcessingStage;
  progress: number;
  partialText: string;
};

export type NotesChange = { id: string | null };

export type NoteProcessorDeps = {
  notes: NotesRepository;
  chunks: ChunkRepository;
  audio: AudioStore;
  settings: SettingsRepository;
  isInstalled: (kind: ModelKind) => boolean;
  engines: { speechToText: SpeechToText; textGenerator: TextGenerator; embedder: Embedder };
  deviceLanguages: () => readonly string[];
  changes: Emitter<NotesChange>;
  now?: () => number;
};

export type NoteProcessor = ReturnType<typeof createNoteProcessor>;

/**
 * Drives a note through transcribe -> enrich -> index, one note at a time.
 * Each stage persists its output and status before the next begins, so a
 * killed app resumes from the last finished stage on next launch.
 *
 * Missing models never fail a note: without Whisper it waits, without the
 * language model it gets a heuristic title, without the embedder it is
 * indexed later when the model arrives.
 */
export function createNoteProcessor(deps: NoteProcessorDeps) {
  const now = deps.now ?? Date.now;
  const progress = createStore<Readonly<Record<string, ProcessingState>>>({});
  const queue: string[] = [];
  let active: { id: string; controller: AbortController } | null = null;
  let draining: Promise<void> | null = null;

  const report = (id: string, state: ProcessingState | null) => {
    progress.set((current) => {
      const next = { ...current };
      if (state) next[id] = state;
      else delete next[id];
      return next;
    });
  };

  const changed = (id: string) => deps.changes.emit({ id });

  async function transcribe(note: Note, signal: AbortSignal): Promise<Note | null> {
    if (!deps.isInstalled('speech')) {
      await deps.notes.setStatus(note.id, 'recorded', 'Waiting for the speech model');
      changed(note.id);
      return null;
    }
    if (!note.audioFile) {
      await deps.notes.setStatus(note.id, 'failed', 'Recording file is missing');
      return null;
    }
    await deps.notes.setStatus(note.id, 'transcribing');
    changed(note.id);
    report(note.id, { stage: 'transcribing', progress: 0, partialText: '' });

    const audio = await deps.audio.read(note.audioFile);
    const engine = deps.engines.speechToText;
    const language = resolveLanguage(
      await deps.settings.get('language'),
      deps.deviceLanguages(),
      engine.languages,
    );
    const result = await transcribeAudio(engine, audio.samples, {
      language,
      signal,
      onProgress: (fraction, partialText) =>
        report(note.id, { stage: 'transcribing', progress: fraction, partialText }),
    });
    await deps.notes.saveTranscript(note.id, result.segments, language);
    await deps.notes.setStatus(note.id, 'enriching');
    await deps.settings.recordPerf({
      at: now(),
      kind: 'transcription',
      model: engine.modelId,
      value: result.realTimeFactor,
      detail: `${(result.audioMs / 1000).toFixed(1)} s audio in ${(result.elapsedMs / 1000).toFixed(1)} s`,
    });
    return deps.notes.get(note.id);
  }

  async function enrich(note: Note, signal: AbortSignal): Promise<Note | null> {
    report(note.id, { stage: 'enriching', progress: 0, partialText: '' });
    const generator = deps.isInstalled('language') ? deps.engines.textGenerator : null;
    const result = await enrichTranscript(note.transcript, generator, { signal });
    await deps.notes.saveEnrichment(note.id, result.enrichment, result.source);
    await deps.notes.setStatus(note.id, 'indexing');
    for (const generation of result.generations) {
      await deps.settings.recordPerf({
        at: now(),
        kind: 'enrichment',
        model: generator?.modelId ?? 'none',
        value: tokensPerSecond(generation),
        detail: `${generation.generatedTokens} tokens, ${generation.promptTokens} prompt tokens, source ${result.source}`,
      });
    }
    changed(note.id);
    return deps.notes.get(note.id);
  }

  async function index(note: Note) {
    report(note.id, { stage: 'indexing', progress: 0, partialText: '' });
    if (deps.isInstalled('embedding') && note.segments.length > 0) {
      const started = now();
      const count = await indexNote({ embedder: deps.engines.embedder, chunks: deps.chunks }, note);
      if (count > 0) {
        await deps.settings.recordPerf({
          at: now(),
          kind: 'embedding',
          model: deps.engines.embedder.modelId,
          value: (now() - started) / count,
          detail: `${count} chunks`,
        });
      }
    }
    await deps.notes.setStatus(note.id, 'ready');
  }

  async function run(id: string, signal: AbortSignal) {
    let note = await deps.notes.get(id);
    if (!note) return;

    if (note.status === 'ready') {
      // Ready but never indexed: the embedder arrived after the note was made.
      if (deps.isInstalled('embedding') && (await deps.chunks.countForNote(id)) === 0)
        await index(note);
      return;
    }
    if (note.status === 'recorded' || note.status === 'transcribing') {
      note = await transcribe(note, signal);
      if (!note) return;
    }
    if (note.status === 'enriching') {
      note = await enrich(note, signal);
      if (!note) return;
    }
    if (note.status === 'indexing') await index(note);
  }

  async function drain() {
    while (queue.length > 0) {
      const id = queue.shift()!;
      const controller = new AbortController();
      active = { id, controller };
      try {
        await run(id, controller.signal);
      } catch (error) {
        // Cancelled work keeps its last persisted stage and resumes on next launch.
        if (!controller.signal.aborted && !isAppError(error, 'CANCELLED')) {
          const appError = toAppError(error, 'UNKNOWN');
          await deps.notes
            .setStatus(id, 'failed', `${appError.code}: ${appError.message}`)
            .catch(() => undefined);
        }
      } finally {
        active = null;
        report(id, null);
        changed(id);
      }
    }
    draining = null;
  }

  function enqueue(id: string): Promise<void> {
    if (active?.id !== id && !queue.includes(id)) queue.push(id);
    draining ??= drain();
    return draining;
  }

  return {
    progress,
    enqueue,

    /** Picks up interrupted notes and notes that a newly installed model can now finish. */
    async resume(): Promise<void> {
      const unfinished = await deps.notes.listUnfinished();
      const unindexed = deps.isInstalled('embedding')
        ? await deps.chunks.notesMissingVectors()
        : [];
      const ids = [...unfinished.map((n) => n.id), ...unindexed];
      let last: Promise<void> = Promise.resolve();
      for (const id of new Set(ids)) last = enqueue(id);
      return last;
    },

    /** Re-runs title, summary and indexing, e.g. once the language model is installed. */
    async rewrite(id: string): Promise<void> {
      await deps.notes.setStatus(id, 'enriching');
      changed(id);
      return enqueue(id);
    },

    cancel(id: string) {
      const index = queue.indexOf(id);
      if (index >= 0) queue.splice(index, 1);
      if (active?.id === id) active.controller.abort();
    },

    cancelAll() {
      queue.length = 0;
      active?.controller.abort();
    },
  };
}
