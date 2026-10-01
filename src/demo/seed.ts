import { createId } from '@/core/lib/id';
import { type ChunkRepository } from '@/features/ask/data/chunkRepository';
import { type Embedder } from '@/features/ask/engine/Embedder';
import { indexNote } from '@/features/ask/pipeline/indexNote';
import { type NotesRepository } from '@/features/notes/data/notesRepository';
import { type AudioStore } from '@/features/recording/data/audioStore';

import { DEMO_NOTES } from './notes';
import { sentenceSpans, syntheticSpeech } from './syntheticAudio';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fills an empty database with the fictional demo notes. Idempotent: does nothing if notes exist. */
export async function seedDemoNotes(deps: {
  notes: NotesRepository;
  chunks: ChunkRepository;
  audio: AudioStore;
  embedder: Embedder;
  now: number;
}): Promise<number> {
  if ((await deps.notes.count()) > 0) return 0;

  for (const [index, demo] of DEMO_NOTES.entries()) {
    const day = new Date(deps.now - demo.daysAgo * DAY_MS);
    day.setHours(demo.hour, demo.minute, 0, 0);
    const spans = sentenceSpans(demo.sentences);
    const durationMs = (spans[spans.length - 1]?.endMs ?? 0) + 400;

    const id = createId(day.getTime());
    const audioFile = await deps.audio.save(
      id,
      syntheticSpeech(spans, durationMs, 16_000, index + 1),
      16_000,
    );
    await deps.notes.create({
      id,
      createdAt: day.getTime(),
      durationMs,
      audioFile,
      language: 'en',
    });

    const segments = demo.sentences.map((text, position) => ({
      position,
      text,
      ...spans[position]!,
    }));
    await deps.notes.saveTranscript(id, segments, 'en');
    await deps.notes.saveEnrichment(id, demo, 'model');
    const note = await deps.notes.get(id);
    for (const itemIndex of demo.done ?? []) {
      const item = note?.actionItems[itemIndex];
      if (item) await deps.notes.setActionItemDone(item.id, true);
    }
    await indexNote(
      { embedder: deps.embedder, chunks: deps.chunks },
      { id, title: demo.title, segments },
    );
    await deps.notes.setStatus(id, 'ready');
  }
  return DEMO_NOTES.length;
}
