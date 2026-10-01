import { VECTOR_DIMENSIONS } from './schema';

export type Migration = {
  version: number;
  name: string;
  statements: readonly string[];
};

/**
 * Append-only. A shipped migration is never edited: a fix is a new version, so
 * every install reaches the same schema whatever version it started from.
 */
export const migrations: readonly Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    statements: [
      `CREATE TABLE notes (
        id TEXT PRIMARY KEY NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        audio_file TEXT,
        status TEXT NOT NULL,
        status_detail TEXT,
        language TEXT,
        title TEXT NOT NULL DEFAULT '',
        summary TEXT NOT NULL DEFAULT '',
        mood TEXT,
        transcript TEXT NOT NULL DEFAULT '',
        enrichment_source TEXT,
        deleted_at INTEGER
      )`,
      `CREATE INDEX notes_created_at ON notes (created_at DESC) WHERE deleted_at IS NULL`,
      `CREATE TABLE segments (
        note_id TEXT NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        start_ms INTEGER NOT NULL,
        end_ms INTEGER NOT NULL,
        text TEXT NOT NULL,
        PRIMARY KEY (note_id, position)
      )`,
      `CREATE TABLE tags (
        note_id TEXT NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
        tag TEXT NOT NULL,
        PRIMARY KEY (note_id, tag)
      )`,
      `CREATE INDEX tags_by_tag ON tags (tag)`,
      `CREATE TABLE action_items (
        id TEXT PRIMARY KEY NOT NULL,
        note_id TEXT NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        text TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX action_items_by_note ON action_items (note_id, position)`,
      `CREATE TABLE chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id TEXT NOT NULL REFERENCES notes (id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        text TEXT NOT NULL,
        start_ms INTEGER NOT NULL,
        end_ms INTEGER NOT NULL
      )`,
      `CREATE INDEX chunks_by_note ON chunks (note_id)`,
      // rowid mirrors chunks.id. vec0 tables cannot take part in foreign keys,
      // so the repository deletes vectors alongside their chunks.
      `CREATE VIRTUAL TABLE chunk_vectors USING vec0(
        embedding float[${VECTOR_DIMENSIONS}] distance_metric=cosine
      )`,
      `CREATE VIRTUAL TABLE notes_fts USING fts5(
        note_id UNINDEXED,
        title,
        summary,
        transcript,
        tags,
        tokenize = 'porter unicode61 remove_diacritics 2'
      )`,
      `CREATE TABLE installed_models (
        id TEXT PRIMARY KEY NOT NULL,
        files TEXT NOT NULL,
        bytes INTEGER NOT NULL,
        installed_at INTEGER NOT NULL
      )`,
      `CREATE TABLE settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      )`,
    ],
  },
];
