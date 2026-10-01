import { type SqlDriver } from '@/core/db/SqlDriver';
import { createNotesRepository } from '@/features/notes/data/notesRepository';
import { createMigratedTestDriver } from '@/test-utils/sqliteTestDriver';

import { createFakeEmbedder } from '../../engine/fakeEmbedder';
import { createChunkRepository } from '../chunkRepository';

describe('chunkRepository (sqlite-vec)', () => {
  let db: SqlDriver;
  const embedder = createFakeEmbedder();

  beforeEach(async () => {
    db = await createMigratedTestDriver();
  });
  afterEach(() => db.close());

  async function noteWith(texts: string[], createdAt = 1) {
    const notes = createNotesRepository(db);
    const id = await notes.create({
      createdAt,
      durationMs: 1_000,
      audioFile: null,
      language: 'en',
    });
    await notes.updateTitle(id, texts[0]!.slice(0, 10));
    const chunks = createChunkRepository(db);
    await chunks.replaceForNote(
      id,
      await Promise.all(
        texts.map(async (text, position) => ({
          position,
          text,
          startMs: position * 1_000,
          endMs: position * 1_000 + 999,
          embedding: await embedder.embed(text),
        })),
      ),
    );
    return { id, notes, chunks };
  }

  it('finds the nearest chunk by cosine similarity', async () => {
    const { id, chunks } = await noteWith([
      'buy oat milk and lemons',
      'the dentist appointment is friday',
    ]);
    const hits = await chunks.searchSimilar(
      await embedder.embed('when is the dentist appointment'),
      2,
    );
    expect(hits[0]).toMatchObject({
      noteId: id,
      text: 'the dentist appointment is friday',
      startMs: 1_000,
    });
    expect(hits[0]!.similarity).toBeGreaterThan(hits[1]!.similarity);
    expect(await chunks.countForNote(id)).toBe(2);
  });

  it('replaces a note’s chunks and vectors instead of appending', async () => {
    const { id, chunks } = await noteWith(['first version']);
    await chunks.replaceForNote(id, [
      {
        position: 0,
        text: 'second version',
        startMs: 0,
        endMs: 1,
        embedding: await embedder.embed('second version'),
      },
    ]);
    expect(await chunks.countForNote(id)).toBe(1);
    const [vectors] = await db.query<{ total: number }>(
      'SELECT count(*) AS total FROM chunk_vectors',
    );
    expect(vectors?.total).toBe(1);
  });

  it('excludes soft-deleted notes from results and purges their vectors', async () => {
    const { id, notes, chunks } = await noteWith(['secret plans for the surprise party']);
    await notes.softDelete(id);
    expect(await chunks.searchSimilar(await embedder.embed('surprise party'), 5)).toEqual([]);
    await notes.purgeDeleted();
    const [vectors] = await db.query<{ total: number }>(
      'SELECT count(*) AS total FROM chunk_vectors',
    );
    expect(vectors?.total).toBe(0);
  });

  it('lists transcribed notes that still need vectors', async () => {
    const notes = createNotesRepository(db);
    const id = await notes.create({ createdAt: 1, durationMs: 1, audioFile: null, language: null });
    await notes.saveTranscript(id, [{ position: 0, startMs: 0, endMs: 1, text: 'hello' }], 'en');
    await notes.create({ createdAt: 2, durationMs: 1, audioFile: null, language: null });
    expect(await createChunkRepository(db).notesMissingVectors()).toEqual([id]);
  });
});
