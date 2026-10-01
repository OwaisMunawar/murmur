import { type SqlDriver } from '@/core/db/SqlDriver';

export type InstalledModel = {
  id: string;
  /** The model config with every URL replaced by its local path, exactly as the engine needs it. */
  resolved: unknown;
  bytes: number;
  installedAt: number;
};

export type InstalledModelsRepository = ReturnType<typeof createInstalledModelsRepository>;

export function createInstalledModelsRepository(db: SqlDriver) {
  return {
    async list(): Promise<InstalledModel[]> {
      const rows = await db.query<{
        id: string;
        files: string;
        bytes: number;
        installed_at: number;
      }>('SELECT id, files, bytes, installed_at FROM installed_models ORDER BY id');
      return rows.map((row) => ({
        id: row.id,
        resolved: JSON.parse(row.files) as unknown,
        bytes: row.bytes,
        installedAt: row.installed_at,
      }));
    },
    async save(model: InstalledModel) {
      await db.run(
        `INSERT INTO installed_models (id, files, bytes, installed_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET files = excluded.files, bytes = excluded.bytes, installed_at = excluded.installed_at`,
        [model.id, JSON.stringify(model.resolved), model.bytes, model.installedAt],
      );
    },
    async remove(id: string) {
      await db.run('DELETE FROM installed_models WHERE id = ?', [id]);
    },
  };
}
