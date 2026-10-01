import { isAppError } from '@/core/errors/AppError';
import { type SqlDriver } from '@/core/db/SqlDriver';
import { createMigratedTestDriver } from '@/test-utils/sqliteTestDriver';

import { createNotesRepository, type NotesRepository } from '../notesRepository';

const enrichment = {
  title: 'Groceries for the weekend',
  summary: 'Need oat milk, lemons and coffee beans before Saturday.',
  tags: ['Shopping', 'home'],
  actionItems: ['Buy oat milk', 'Pick up coffee beans'],
  mood: 'neutral' as const,
};

describe('notesRepository', () => {
  let db: SqlDriver;
  let repo: NotesRepository;
  let clock = 1_000;

  beforeEach(async () => {
    db = await createMigratedTestDriver();
    clock = 1_000;
    repo = createNotesRepository(db, () => clock++);
  });

  afterEach(() => db.close());

  async function seed(createdAt: number, text: string) {
    const id = await repo.create({
      createdAt,
      durationMs: 5_000,
      audioFile: `${createdAt}.wav`,
      language: 'en',
    });
    await repo.saveTranscript(id, [{ position: 0, startMs: 0, endMs: 5_000, text }], 'en');
    return id;
  }

  it('creates a note in the recorded state', async () => {
    const id = await repo.create({
      createdAt: 10,
      durationMs: 1_200,
      audioFile: 'a.wav',
      language: null,
    });
    const note = await repo.get(id);
    expect(note).toMatchObject({
      id,
      status: 'recorded',
      durationMs: 1_200,
      audioFile: 'a.wav',
      title: '',
    });
    expect(note?.segments).toEqual([]);
  });

  it('stores the transcript and segments in order', async () => {
    const id = await repo.create({
      createdAt: 10,
      durationMs: 9_000,
      audioFile: null,
      language: null,
    });
    await repo.saveTranscript(
      id,
      [
        { position: 1, startMs: 4_000, endMs: 9_000, text: ' second part. ' },
        { position: 0, startMs: 0, endMs: 4_000, text: 'First part.' },
      ],
      'en',
    );
    const note = await repo.get(id);
    expect(note?.transcript).toBe('second part. First part.');
    expect(note?.segments.map((s) => s.position)).toEqual([0, 1]);
    expect(note?.language).toBe('en');
  });

  it('saves enrichment with normalised tags and open action items', async () => {
    const id = await seed(10, 'oat milk lemons coffee');
    await repo.saveEnrichment(id, enrichment, 'model');
    const note = await repo.get(id);
    expect(note).toMatchObject({
      title: enrichment.title,
      mood: 'neutral',
      tags: ['home', 'shopping'],
      openActionCount: 2,
      enrichmentSource: 'model',
    });
    expect(note?.actionItems.map((a) => a.text)).toEqual(enrichment.actionItems);
  });

  it('toggles action items and counts only the open ones', async () => {
    const id = await seed(10, 'x');
    await repo.saveEnrichment(id, enrichment, 'model');
    const first = (await repo.get(id))?.actionItems[0];
    await repo.setActionItemDone(first!.id, true);
    expect((await repo.get(id))?.openActionCount).toBe(1);
    expect((await repo.get(id))?.actionItems[0]?.done).toBe(true);
  });

  it('lists newest first and filters by tag', async () => {
    const older = await seed(10, 'older');
    const newer = await seed(20, 'newer');
    await repo.setTags(older, ['work']);
    expect((await repo.list()).map((n) => n.id)).toEqual([newer, older]);
    expect((await repo.list({ tag: 'work' })).map((n) => n.id)).toEqual([older]);
  });

  it('finds notes by full-text prefix across transcript, title and tags', async () => {
    const groceries = await seed(10, 'remember the groceries and the lemons');
    const standup = await seed(20, 'standup went long today');
    await repo.updateTitle(standup, 'Team sync');
    await repo.setTags(groceries, ['errands']);

    expect((await repo.list({ text: 'grocer' })).map((n) => n.id)).toEqual([groceries]);
    expect((await repo.list({ text: 'team' })).map((n) => n.id)).toEqual([standup]);
    expect((await repo.list({ text: 'errand' })).map((n) => n.id)).toEqual([groceries]);
    expect(await repo.list({ text: '?!' })).toEqual([]);
    expect(
      (await repo.list({ text: 'what about the lemons', match: 'any' })).map((n) => n.id),
    ).toEqual([groceries]);
  });

  it('returns id-filtered results in the requested order', async () => {
    const a = await seed(10, 'a');
    const b = await seed(20, 'b');
    const c = await seed(30, 'c');
    expect((await repo.list({ ids: [a, c, b] })).map((n) => n.id)).toEqual([a, c, b]);
    expect(await repo.list({ ids: [] })).toEqual([]);
  });

  it('counts tags across live notes only', async () => {
    const a = await seed(10, 'a');
    const b = await seed(20, 'b');
    await repo.setTags(a, ['work', 'ideas']);
    await repo.setTags(b, ['work']);
    expect(await repo.listTags()).toEqual([
      { tag: 'work', count: 2 },
      { tag: 'ideas', count: 1 },
    ]);
    await repo.softDelete(b);
    expect(await repo.listTags()).toEqual([
      { tag: 'ideas', count: 1 },
      { tag: 'work', count: 1 },
    ]);
  });

  it('soft-deletes, restores and purges with audio cleanup', async () => {
    const id = await seed(10, 'delete me');
    await repo.softDelete(id);
    expect(await repo.get(id)).toBeNull();
    expect(await repo.count()).toBe(0);

    await repo.restore(id);
    expect(await repo.get(id)).not.toBeNull();

    await repo.softDelete(id);
    await expect(repo.purgeDeleted([id])).resolves.toEqual(['10.wav']);
    const remaining = await db.query('SELECT * FROM notes_fts WHERE note_id = ?', [id]);
    expect(remaining).toHaveLength(0);
    await expect(repo.purgeDeleted()).resolves.toEqual([]);
  });

  it('reports notes whose pipeline has not finished', async () => {
    const pending = await seed(10, 'pending');
    const done = await seed(20, 'done');
    await repo.setStatus(done, 'ready');
    await repo.setStatus(pending, 'enriching', 'waiting for model');
    expect(await repo.listUnfinished()).toEqual([{ id: pending, status: 'enriching' }]);
    expect((await repo.get(pending))?.statusDetail).toBe('waiting for model');
  });

  it('throws a typed error when editing a missing note', async () => {
    const error = await repo.updateTitle('missing', 'x').catch((e: unknown) => e);
    expect(isAppError(error, 'NOTE_NOT_FOUND')).toBe(true);
  });

  it('maps unknown stored values to safe defaults', async () => {
    const id = await seed(10, 'x');
    await db.run(
      "UPDATE notes SET status = 'bogus', mood = 'ecstatic', enrichment_source = 'other' WHERE id = ?",
      [id],
    );
    expect(await repo.get(id)).toMatchObject({
      status: 'failed',
      mood: null,
      enrichmentSource: null,
    });
  });
});
