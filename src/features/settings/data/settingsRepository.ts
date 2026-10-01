import { z } from 'zod';

import { type SqlDriver } from '@/core/db/SqlDriver';

const perfEntrySchema = z.object({
  at: z.number(),
  kind: z.enum(['transcription', 'enrichment', 'answer', 'embedding']),
  model: z.string(),
  /** Real-time factor for transcription, tokens per second for generation, ms per chunk for embedding. */
  value: z.number(),
  detail: z.string(),
});
export type PerfEntry = z.infer<typeof perfEntrySchema>;

const schemas = {
  wifiOnly: z.boolean(),
  language: z.string().nullable(),
  perfLog: z.array(perfEntrySchema),
} as const;

type Settings = { [K in keyof typeof schemas]: z.infer<(typeof schemas)[K]> };

const defaults: Settings = { wifiOnly: true, language: null, perfLog: [] };

const MAX_PERF_ENTRIES = 40;

export type SettingsRepository = ReturnType<typeof createSettingsRepository>;

/**
 * Typed key-value settings in SQLite. Values are validated on read, so a
 * corrupt or outdated row falls back to the default instead of crashing.
 */
export function createSettingsRepository(db: SqlDriver) {
  async function get<K extends keyof Settings>(key: K): Promise<Settings[K]> {
    const [row] = await db.query<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
      key,
    ]);
    if (!row) return defaults[key];
    try {
      const parsed = schemas[key].safeParse(JSON.parse(row.value));
      return parsed.success ? (parsed.data as Settings[K]) : defaults[key];
    } catch {
      return defaults[key];
    }
  }

  async function set<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
    await db.run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
      [key, JSON.stringify(value)],
    );
  }

  return {
    get,
    set,
    /** Measurements the app takes on itself; shown under Settings and quoted in the README. */
    async recordPerf(entry: PerfEntry) {
      const log = await get('perfLog');
      await set('perfLog', [entry, ...log].slice(0, MAX_PERF_ENTRIES));
    },
  };
}
