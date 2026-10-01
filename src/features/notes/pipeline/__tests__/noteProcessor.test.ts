import { type SqlDriver } from '@/core/db/SqlDriver';
import { createEmitter } from '@/core/lib/store';
import { createChunkRepository } from '@/features/ask/data/chunkRepository';
import { createFakeEmbedder } from '@/features/ask/engine/fakeEmbedder';
import { createFakeTextGenerator } from '@/features/enrichment/engine/fakeTextGenerator';
import { type ModelKind } from '@/features/models/catalog';
import { createMemoryAudioStore } from '@/features/recording/data/audioStore';
import { createSettingsRepository } from '@/features/settings/data/settingsRepository';
import { createFakeSpeechToText } from '@/features/transcription/engine/fakeSpeechToText';
import { type SpeechToText } from '@/features/transcription/engine/SpeechToText';
import { createMigratedTestDriver } from '@/test-utils/sqliteTestDriver';

import { createNotesRepository } from '../../data/notesRepository';
import { createNoteProcessor, type NotesChange } from '../noteProcessor';

const SCRIPT = 'I need to book the vet for Biscuit next week. Also buy more dog food.';
const ENRICHED =
  '{"title":"Vet and dog food","summary":"Biscuit needs a vet visit and food.","tags":["pets"],"action_items":["Book the vet","Buy dog food"],"mood":"neutral"}';
const tone = (seconds: number) =>
  Float32Array.from({ length: seconds * 16_000 }, (_, i) => Math.sin(i / 7) * 0.3);

describe('noteProcessor', () => {
  let db: SqlDriver;
  beforeEach(async () => {
    db = await createMigratedTestDriver();
  });
  afterEach(() => db.close());

  function setup(installed: ModelKind[], stt: SpeechToText = createFakeSpeechToText(SCRIPT)) {
    const notes = createNotesRepository(db);
    const chunks = createChunkRepository(db);
    const audio = createMemoryAudioStore();
    const settings = createSettingsRepository(db);
    const changes = createEmitter<NotesChange>();
    const kinds = new Set(installed);
    const processor = createNoteProcessor({
      notes,
      chunks,
      audio,
      settings,
      isInstalled: (kind) => kinds.has(kind),
      engines: {
        speechToText: stt,
        textGenerator: createFakeTextGenerator(() => ENRICHED),
        embedder: createFakeEmbedder(),
      },
      deviceLanguages: () => ['en-GB'],
      changes,
    });
    const record = async () => {
      const id = await notes.create({
        createdAt: 1,
        durationMs: 4_000,
        audioFile: null,
        language: null,
      });
      const file = await audio.save(id, tone(4), 16_000);
      await db.run('UPDATE notes SET audio_file = ? WHERE id = ?', [file, id]);
      return id;
    };
    return { notes, chunks, settings, processor, changes, kinds, record };
  }

  it('runs a recording through every stage to a searchable note', async () => {
    const { notes, chunks, settings, processor, changes, record } = setup([
      'speech',
      'language',
      'embedding',
    ]);
    const events: NotesChange[] = [];
    changes.on((e) => events.push(e));
    const stages = new Set<string>();
    processor.progress.subscribe(() =>
      Object.values(processor.progress.get()).forEach((p) => stages.add(p.stage)),
    );

    const id = await record();
    await processor.enqueue(id);

    const note = await notes.get(id);
    expect(note).toMatchObject({
      status: 'ready',
      title: 'Vet and dog food',
      language: 'en',
      enrichmentSource: 'model',
    });
    expect(note?.actionItems.map((a) => a.text)).toEqual(['Book the vet', 'Buy dog food']);
    expect(await chunks.countForNote(id)).toBeGreaterThan(0);
    expect([...stages]).toEqual(['transcribing', 'enriching', 'indexing']);
    expect(processor.progress.get()).toEqual({});
    expect(events.length).toBeGreaterThan(0);
    const perf = await settings.get('perfLog');
    expect(perf.map((p) => p.kind).sort()).toEqual(['embedding', 'enrichment', 'transcription']);
  });

  it('waits for the speech model, then resumes when it arrives', async () => {
    const { notes, processor, kinds, record } = setup([]);
    const id = await record();
    await processor.enqueue(id);
    expect(await notes.get(id)).toMatchObject({
      status: 'recorded',
      statusDetail: 'Waiting for the speech model',
    });

    kinds.add('speech');
    await processor.resume();
    const note = await notes.get(id);
    expect(note).toMatchObject({ status: 'ready', enrichmentSource: 'heuristic' });
    expect(note?.title.length).toBeGreaterThan(0);
  });

  it('rewrites a heuristic summary with the model once it is installed', async () => {
    const { notes, processor, kinds, record } = setup(['speech']);
    const id = await record();
    await processor.enqueue(id);
    expect((await notes.get(id))?.enrichmentSource).toBe('heuristic');

    kinds.add('language');
    await processor.rewrite(id);
    expect(await notes.get(id)).toMatchObject({
      status: 'ready',
      enrichmentSource: 'model',
      title: 'Vet and dog food',
    });
  });

  it('indexes ready notes once the embedding model is installed', async () => {
    const { chunks, processor, kinds, record } = setup(['speech']);
    const id = await record();
    await processor.enqueue(id);
    expect(await chunks.countForNote(id)).toBe(0);

    kinds.add('embedding');
    await processor.resume();
    expect(await chunks.countForNote(id)).toBeGreaterThan(0);
  });

  it('marks a note failed with the error code when a stage throws', async () => {
    const broken: SpeechToText = {
      ...createFakeSpeechToText(''),
      transcribe: () => Promise.reject(new Error('boom')),
    };
    const { notes, processor, record } = setup(['speech'], broken);
    const id = await record();
    await processor.enqueue(id);
    expect(await notes.get(id)).toMatchObject({
      status: 'failed',
      statusDetail: 'TRANSCRIPTION_FAILED: boom',
    });
  });

  it('fails clearly when the audio file is missing', async () => {
    const { notes, processor } = setup(['speech']);
    const id = await notes.create({ createdAt: 1, durationMs: 1, audioFile: null, language: null });
    await processor.enqueue(id);
    expect(await notes.get(id)).toMatchObject({
      status: 'failed',
      statusDetail: 'Recording file is missing',
    });
  });

  it('cancels queued and running work without failing the note', async () => {
    let unblock: () => void = () => undefined;
    const slow: SpeechToText = {
      ...createFakeSpeechToText(SCRIPT),
      transcribe: (_samples, { signal }) =>
        new Promise((_, reject) => {
          unblock = () => reject(Object.assign(new Error('stopped')));
          signal?.addEventListener('abort', () => unblock());
        }),
    };
    const { notes, processor, record } = setup(['speech'], slow);
    const first = await record();
    const second = await record();
    const done = processor.enqueue(first);
    void processor.enqueue(second);
    processor.cancel(second);
    await new Promise((r) => setTimeout(r, 0));
    processor.cancelAll();
    await done;
    expect((await notes.get(first))?.status).toBe('transcribing');
    expect((await notes.get(second))?.status).toBe('recorded');
  });

  it('ignores ids for notes that no longer exist', async () => {
    const { processor } = setup(['speech']);
    await expect(processor.enqueue('missing')).resolves.toBeUndefined();
  });
});
