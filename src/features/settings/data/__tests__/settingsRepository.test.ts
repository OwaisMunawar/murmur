import { type SqlDriver } from '@/core/db/SqlDriver';
import { createMigratedTestDriver } from '@/test-utils/sqliteTestDriver';

import { createSettingsRepository } from '../settingsRepository';

describe('settingsRepository', () => {
  let db: SqlDriver;
  beforeEach(async () => {
    db = await createMigratedTestDriver();
  });
  afterEach(() => db.close());

  it('returns defaults, then stored values', async () => {
    const settings = createSettingsRepository(db);
    expect(await settings.get('wifiOnly')).toBe(true);
    await settings.set('wifiOnly', false);
    await settings.set('language', 'de');
    expect(await settings.get('wifiOnly')).toBe(false);
    expect(await settings.get('language')).toBe('de');
  });

  it('falls back to the default for corrupt or mistyped rows', async () => {
    const settings = createSettingsRepository(db);
    await db.run(
      "INSERT INTO settings (key, value) VALUES ('wifiOnly', '\"yes\"'), ('language', '{oops')",
    );
    expect(await settings.get('wifiOnly')).toBe(true);
    expect(await settings.get('language')).toBeNull();
  });

  it('keeps a bounded, newest-first performance log', async () => {
    const settings = createSettingsRepository(db);
    for (let i = 0; i < 45; i++) {
      await settings.recordPerf({ at: i, kind: 'answer', model: 'm', value: i, detail: '' });
    }
    const log = await settings.get('perfLog');
    expect(log).toHaveLength(40);
    expect(log[0]?.at).toBe(44);
  });
});
