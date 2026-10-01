import { AppError } from '@/core/errors/AppError';
import { type Row, type SqlDriver, type SqlExecutor, type SqlValue } from '@/core/db/SqlDriver';
import { createId } from '@/core/lib/id';

import { buildFtsQuery } from '../lib/ftsQuery';
import { normalizeTags } from '../lib/tags';
import {
  MOODS,
  NOTE_STATUSES,
  type ActionItem,
  type Enrichment,
  type EnrichmentSource,
  type Mood,
  type Note,
  type NoteStatus,
  type NoteSummary,
  type Segment,
} from '../model';

export type NewNote = {
  id?: string;
  createdAt: number;
  durationMs: number;
  audioFile: string | null;
  language: string | null;
};

export type ListQuery = {
  /** Full-text query over title, summary, transcript and tags. */
  text?: string;
  /** How the words of `text` combine; see buildFtsQuery. */
  match?: 'all' | 'any';
  tag?: string;
  /** Restrict to these ids, returned in this order (semantic search results). */
  ids?: readonly string[];
  limit?: number;
};

export type NotesRepository = ReturnType<typeof createNotesRepository>;

type NoteRow = {
  id: string;
  created_at: number;
  updated_at: number;
  duration_ms: number;
  audio_file: string | null;
  status: string;
  status_detail: string | null;
  language: string | null;
  title: string;
  summary: string;
  mood: string | null;
  transcript: string;
  enrichment_source: string | null;
  tags: string | null;
  open_actions: number;
};

const SUMMARY_COLUMNS = `
  n.id, n.created_at, n.updated_at, n.duration_ms, n.audio_file, n.status, n.status_detail,
  n.language, n.title, n.summary, n.mood, n.transcript, n.enrichment_source,
  (SELECT group_concat(tag, ',') FROM (SELECT tag FROM tags WHERE note_id = n.id ORDER BY tag)) AS tags,
  (SELECT count(*) FROM action_items WHERE note_id = n.id AND done = 0) AS open_actions`;

export function createNotesRepository(db: SqlDriver, now: () => number = Date.now) {
  async function refreshSearchIndex(tx: SqlExecutor, id: string) {
    await tx.run('DELETE FROM notes_fts WHERE note_id = ?', [id]);
    await tx.run(
      `INSERT INTO notes_fts (note_id, title, summary, transcript, tags)
       SELECT n.id, n.title, n.summary, n.transcript,
              coalesce((SELECT group_concat(tag, ' ') FROM tags WHERE note_id = n.id), '')
       FROM notes n WHERE n.id = ?`,
      [id],
    );
  }

  async function touch(tx: SqlExecutor, id: string) {
    const result = await tx.run('UPDATE notes SET updated_at = ? WHERE id = ?', [now(), id]);
    if (result.rowsAffected === 0)
      throw new AppError('NOTE_NOT_FOUND', `Note ${id} does not exist`);
  }

  async function writeTags(tx: SqlExecutor, id: string, tags: readonly string[]) {
    await tx.run('DELETE FROM tags WHERE note_id = ?', [id]);
    for (const tag of normalizeTags(tags, 8)) {
      await tx.run('INSERT INTO tags (note_id, tag) VALUES (?, ?)', [id, tag]);
    }
  }

  return {
    async create(input: NewNote): Promise<string> {
      const id = input.id ?? createId(input.createdAt);
      await db.transaction(async (tx) => {
        await tx.run(
          `INSERT INTO notes (id, created_at, updated_at, duration_ms, audio_file, status, language)
           VALUES (?, ?, ?, ?, ?, 'recorded', ?)`,
          [id, input.createdAt, now(), input.durationMs, input.audioFile, input.language],
        );
        await refreshSearchIndex(tx, id);
      });
      return id;
    },

    async get(id: string): Promise<Note | null> {
      const [row] = await db.query<NoteRow>(
        `SELECT ${SUMMARY_COLUMNS} FROM notes n WHERE n.id = ? AND n.deleted_at IS NULL`,
        [id],
      );
      if (!row) return null;
      const segments = await db.query<{
        position: number;
        start_ms: number;
        end_ms: number;
        text: string;
      }>(
        'SELECT position, start_ms, end_ms, text FROM segments WHERE note_id = ? ORDER BY position',
        [id],
      );
      const items = await db.query<{ id: string; position: number; text: string; done: number }>(
        'SELECT id, position, text, done FROM action_items WHERE note_id = ? ORDER BY position',
        [id],
      );
      return {
        ...toSummary(row),
        updatedAt: row.updated_at,
        audioFile: row.audio_file,
        statusDetail: row.status_detail,
        language: row.language,
        transcript: row.transcript,
        enrichmentSource: toEnrichmentSource(row.enrichment_source),
        segments: segments.map<Segment>((s) => ({
          position: s.position,
          startMs: s.start_ms,
          endMs: s.end_ms,
          text: s.text,
        })),
        actionItems: items.map<ActionItem>((i) => ({
          id: i.id,
          position: i.position,
          text: i.text,
          done: i.done === 1,
        })),
      };
    },

    async list(query: ListQuery = {}): Promise<NoteSummary[]> {
      const where = ['n.deleted_at IS NULL'];
      const params: SqlValue[] = [];

      const match = query.text ? buildFtsQuery(query.text, query.match) : null;
      if (query.text && !match) return [];
      if (match) {
        where.push('n.id IN (SELECT note_id FROM notes_fts WHERE notes_fts MATCH ?)');
        params.push(match);
      }
      if (query.tag) {
        where.push('EXISTS (SELECT 1 FROM tags t WHERE t.note_id = n.id AND t.tag = ?)');
        params.push(query.tag);
      }
      if (query.ids) {
        if (query.ids.length === 0) return [];
        where.push(`n.id IN (${query.ids.map(() => '?').join(', ')})`);
        params.push(...query.ids);
      }

      const rows = await db.query<NoteRow>(
        `SELECT ${SUMMARY_COLUMNS} FROM notes n WHERE ${where.join(' AND ')}
         ORDER BY n.created_at DESC LIMIT ?`,
        [...params, query.limit ?? 500],
      );
      const summaries = rows.map(toSummary);
      if (!query.ids) return summaries;
      const order = new Map(query.ids.map((id, index) => [id, index]));
      return summaries.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    },

    async listTags(): Promise<{ tag: string; count: number }[]> {
      return db.query<{ tag: string; count: number }>(
        `SELECT t.tag, count(*) AS count FROM tags t
         JOIN notes n ON n.id = t.note_id AND n.deleted_at IS NULL
         GROUP BY t.tag ORDER BY count DESC, t.tag ASC`,
      );
    },

    async setStatus(id: string, status: NoteStatus, detail: string | null = null) {
      await db.run('UPDATE notes SET status = ?, status_detail = ?, updated_at = ? WHERE id = ?', [
        status,
        detail,
        now(),
        id,
      ]);
    },

    async saveTranscript(id: string, segments: readonly Segment[], language: string | null) {
      const transcript = segments
        .map((s) => s.text.trim())
        .filter(Boolean)
        .join(' ');
      await db.transaction(async (tx) => {
        await touch(tx, id);
        await tx.run('UPDATE notes SET transcript = ?, language = ? WHERE id = ?', [
          transcript,
          language,
          id,
        ]);
        await tx.run('DELETE FROM segments WHERE note_id = ?', [id]);
        for (const segment of segments) {
          await tx.run(
            'INSERT INTO segments (note_id, position, start_ms, end_ms, text) VALUES (?, ?, ?, ?, ?)',
            [id, segment.position, segment.startMs, segment.endMs, segment.text],
          );
        }
        await refreshSearchIndex(tx, id);
      });
    },

    async saveEnrichment(id: string, enrichment: Enrichment, source: EnrichmentSource) {
      await db.transaction(async (tx) => {
        await touch(tx, id);
        await tx.run(
          'UPDATE notes SET title = ?, summary = ?, mood = ?, enrichment_source = ? WHERE id = ?',
          [enrichment.title, enrichment.summary, enrichment.mood, source, id],
        );
        await writeTags(tx, id, enrichment.tags);
        await tx.run('DELETE FROM action_items WHERE note_id = ?', [id]);
        let position = 0;
        for (const text of enrichment.actionItems) {
          await tx.run(
            'INSERT INTO action_items (id, note_id, position, text) VALUES (?, ?, ?, ?)',
            [createId(now()), id, position++, text],
          );
        }
        await refreshSearchIndex(tx, id);
      });
    },

    async updateTitle(id: string, title: string) {
      await db.transaction(async (tx) => {
        await touch(tx, id);
        await tx.run('UPDATE notes SET title = ? WHERE id = ?', [title.trim(), id]);
        await refreshSearchIndex(tx, id);
      });
    },

    async setTags(id: string, tags: readonly string[]) {
      await db.transaction(async (tx) => {
        await touch(tx, id);
        await writeTags(tx, id, tags);
        await refreshSearchIndex(tx, id);
      });
    },

    async setActionItemDone(itemId: string, done: boolean) {
      await db.run('UPDATE action_items SET done = ? WHERE id = ?', [done ? 1 : 0, itemId]);
    },

    /** Hides the note immediately; `purgeDeleted` removes it for good once undo has expired. */
    async softDelete(id: string) {
      await db.run('UPDATE notes SET deleted_at = ? WHERE id = ?', [now(), id]);
    },

    async restore(id: string) {
      await db.run('UPDATE notes SET deleted_at = NULL WHERE id = ?', [id]);
    },

    /**
     * Permanently removes soft-deleted notes and returns their audio files so
     * the caller can delete them from disk. Vectors live in a virtual table
     * that foreign keys cannot cascade into, so they are removed explicitly.
     */
    async purgeDeleted(ids?: readonly string[]): Promise<string[]> {
      return db.transaction(async (tx) => {
        const filter = ids ? ` AND id IN (${ids.map(() => '?').join(', ')})` : '';
        const doomed = await tx.query<{ id: string; audio_file: string | null }>(
          `SELECT id, audio_file FROM notes WHERE deleted_at IS NOT NULL${filter}`,
          ids ? [...ids] : [],
        );
        for (const note of doomed) {
          await tx.run(
            'DELETE FROM chunk_vectors WHERE rowid IN (SELECT id FROM chunks WHERE note_id = ?)',
            [note.id],
          );
          await tx.run('DELETE FROM notes_fts WHERE note_id = ?', [note.id]);
          await tx.run('DELETE FROM notes WHERE id = ?', [note.id]);
        }
        return doomed.map((n) => n.audio_file).filter((file): file is string => file !== null);
      });
    },

    /** Notes whose pipeline was interrupted (app killed, models missing) and should resume. */
    async listUnfinished(): Promise<{ id: string; status: NoteStatus }[]> {
      const rows = await db.query<{ id: string; status: string }>(
        `SELECT id, status FROM notes
         WHERE deleted_at IS NULL AND status NOT IN ('ready', 'failed')
         ORDER BY created_at ASC`,
      );
      return rows.map((r) => ({ id: r.id, status: toStatus(r.status) }));
    },

    async count(): Promise<number> {
      const [row] = await db.query<{ total: number } & Row>(
        'SELECT count(*) AS total FROM notes WHERE deleted_at IS NULL',
      );
      return row?.total ?? 0;
    },
  };
}

function toSummary(row: NoteRow): NoteSummary {
  return {
    id: row.id,
    createdAt: row.created_at,
    durationMs: row.duration_ms,
    status: toStatus(row.status),
    title: row.title,
    summary: row.summary,
    mood: toMood(row.mood),
    tags: row.tags ? row.tags.split(',') : [],
    openActionCount: row.open_actions,
  };
}

function toStatus(value: string): NoteStatus {
  return (NOTE_STATUSES as readonly string[]).includes(value) ? (value as NoteStatus) : 'failed';
}

function toMood(value: string | null): Mood | null {
  return value && (MOODS as readonly string[]).includes(value) ? (value as Mood) : null;
}

function toEnrichmentSource(value: string | null): EnrichmentSource | null {
  return value === 'model' || value === 'repaired' || value === 'heuristic' ? value : null;
}
