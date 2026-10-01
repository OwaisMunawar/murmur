import { type SqlDriver } from '@/core/db/SqlDriver';

import { distanceToSimilarity, type ChunkHit } from '../lib/ranking';
import { toBlob } from '../lib/vectors';
import { type TextChunk } from '../lib/chunking';

export type EmbeddedChunk = TextChunk & { embedding: Float32Array };

export type ChunkRepository = ReturnType<typeof createChunkRepository>;

/**
 * Chunks live in a normal table; their vectors live in a sqlite-vec `vec0`
 * table keyed by the same rowid. KNN runs inside SQLite (native code, off the
 * JS thread) so search cost does not grow with the JS heap.
 */
export function createChunkRepository(db: SqlDriver) {
  return {
    async replaceForNote(noteId: string, chunks: readonly EmbeddedChunk[]) {
      await db.transaction(async (tx) => {
        await tx.run(
          'DELETE FROM chunk_vectors WHERE rowid IN (SELECT id FROM chunks WHERE note_id = ?)',
          [noteId],
        );
        await tx.run('DELETE FROM chunks WHERE note_id = ?', [noteId]);
        for (const chunk of chunks) {
          const { insertId } = await tx.run(
            'INSERT INTO chunks (note_id, position, text, start_ms, end_ms) VALUES (?, ?, ?, ?, ?)',
            [noteId, chunk.position, chunk.text, chunk.startMs, chunk.endMs],
          );
          await tx.run(
            // Drivers may bind JS numbers as REAL; vec0 only accepts integer rowids.
            'INSERT INTO chunk_vectors (rowid, embedding) VALUES (CAST(? AS INTEGER), ?)',
            [insertId ?? null, toBlob(chunk.embedding)],
          );
        }
      });
    },

    /**
     * Nearest chunks to `query`. vec0 cannot filter on joined columns during
     * the KNN scan, so it over-fetches and soft-deleted notes are removed in
     * the join.
     */
    async searchSimilar(query: Float32Array, k: number): Promise<ChunkHit[]> {
      const rows = await db.query<{
        id: number;
        note_id: string;
        title: string;
        created_at: number;
        text: string;
        start_ms: number;
        end_ms: number;
        distance: number;
      }>(
        `WITH knn AS (
           SELECT rowid, distance FROM chunk_vectors WHERE embedding MATCH ? AND k = CAST(? AS INTEGER)
         )
         SELECT c.id, c.note_id, n.title, n.created_at, c.text, c.start_ms, c.end_ms, knn.distance
         FROM knn
         JOIN chunks c ON c.id = knn.rowid
         JOIN notes n ON n.id = c.note_id AND n.deleted_at IS NULL
         ORDER BY knn.distance ASC
         LIMIT ?`,
        [toBlob(query), k * 2, k],
      );
      return rows.map((row) => ({
        chunkId: row.id,
        noteId: row.note_id,
        noteTitle: row.title,
        noteCreatedAt: row.created_at,
        text: row.text,
        startMs: row.start_ms,
        endMs: row.end_ms,
        similarity: distanceToSimilarity(row.distance),
      }));
    },

    async countForNote(noteId: string): Promise<number> {
      const [row] = await db.query<{ total: number }>(
        'SELECT count(*) AS total FROM chunks WHERE note_id = ?',
        [noteId],
      );
      return row?.total ?? 0;
    },

    /** Note ids that have no vectors, e.g. recorded before the embedding model was installed. */
    async notesMissingVectors(): Promise<string[]> {
      const rows = await db.query<{ id: string }>(
        `SELECT n.id FROM notes n
         WHERE n.deleted_at IS NULL AND n.transcript != ''
           AND NOT EXISTS (SELECT 1 FROM chunks c WHERE c.note_id = n.id)
         ORDER BY n.created_at DESC`,
      );
      return rows.map((r) => r.id);
    },
  };
}
