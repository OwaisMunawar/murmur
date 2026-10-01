import { type SqlDriver } from '@/core/db/SqlDriver';
import { createMigratedTestDriver } from '@/test-utils/sqliteTestDriver';

import { createFakeModelDownloader } from '../../engine/fakeModelDownloader';
import { type ModelDownloader } from '../../engine/ModelDownloader';
import { createInstalledModelsRepository } from '../installedModelsRepository';
import { createModelManager, type ModelEnvironment } from '../modelManager';

describe('modelManager', () => {
  let db: SqlDriver;
  let environment: ModelEnvironment;

  beforeEach(async () => {
    db = await createMigratedTestDriver();
    environment = {
      network: async () => ({ isConnected: true, isMetered: false }),
      freeBytes: () => 50_000_000_000,
      wifiOnly: async () => true,
      now: () => 123,
    };
  });
  afterEach(() => db.close());

  const make = (downloader: ModelDownloader = createFakeModelDownloader()) =>
    createModelManager({
      repository: createInstalledModelsRepository(db),
      downloader,
      environment,
    });

  it('starts with everything missing and recording-only capabilities', async () => {
    const manager = make();
    await manager.refresh();
    expect(manager.store.get().capabilities).toMatchObject({
      canTranscribe: false,
      canAnswer: false,
    });
    expect(manager.isInstalled('speech')).toBe(false);
    await expect(manager.resolve('whisper-tiny')).rejects.toMatchObject({
      code: 'MODEL_NOT_INSTALLED',
    });
  });

  it('downloads with progress, persists, and survives a restart', async () => {
    const manager = make();
    const seen: number[] = [];
    manager.store.subscribe(() => {
      const state = manager.store.get().byId['whisper-tiny'];
      if (state?.status === 'downloading') seen.push(state.progress);
    });
    await manager.download('whisper-tiny');
    expect(seen).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(manager.store.get().byId['whisper-tiny']).toMatchObject({ status: 'installed' });
    await expect(manager.resolve('whisper-tiny')).resolves.toEqual({ fake: 'whisper-tiny' });

    const restarted = make();
    await restarted.refresh();
    expect(restarted.isInstalled('speech')).toBe(true);
    expect(restarted.store.get().capabilities.canTranscribe).toBe(true);
  });

  it('forgets models whose files disappeared', async () => {
    await make().download('minilm-qa');
    const gone = make({ ...createFakeModelDownloader(), measure: async () => 0 });
    await gone.refresh();
    expect(gone.isInstalled('embedding')).toBe(false);
    expect(await createInstalledModelsRepository(db).list()).toEqual([]);
  });

  it('blocks cellular downloads while Wi-Fi only is on', async () => {
    environment.network = async () => ({ isConnected: true, isMetered: true });
    const manager = make();
    await expect(manager.download('lfm2.5-350m')).rejects.toMatchObject({
      code: 'MODEL_DOWNLOAD_NEEDS_WIFI',
    });
    expect(manager.store.get().byId['lfm2.5-350m']).toMatchObject({
      status: 'error',
      code: 'MODEL_DOWNLOAD_NEEDS_WIFI',
    });
  });

  it('reports disk and offline problems as download failures', async () => {
    environment.freeBytes = () => 1;
    await expect(make().download('lfm2.5-350m')).rejects.toMatchObject({
      code: 'MODEL_DOWNLOAD_FAILED',
    });
  });

  it('returns to missing when cancelled, and to error on failure', async () => {
    let release: () => void = () => undefined;
    const slow: ModelDownloader = {
      ...createFakeModelDownloader(),
      download: (_spec, { signal }) =>
        new Promise((_, reject) => {
          release = () => reject(new Error('aborted'));
          signal.addEventListener('abort', () => release());
        }),
    };
    const manager = make(slow);
    const pending = manager.download('whisper-tiny');
    await new Promise((r) => setTimeout(r, 0));
    await manager.download('whisper-tiny'); // second call while running is a no-op
    manager.cancel('whisper-tiny');
    await expect(pending).resolves.toBeUndefined();
    expect(manager.store.get().byId['whisper-tiny']).toEqual({ status: 'missing' });

    const failing = make({
      ...createFakeModelDownloader(),
      download: () => Promise.reject(new Error('503')),
    });
    await expect(failing.download('whisper-tiny')).rejects.toMatchObject({
      code: 'MODEL_DOWNLOAD_FAILED',
    });
    expect(failing.store.get().byId['whisper-tiny']).toMatchObject({ status: 'error' });
  });

  it('removes a model from disk and the database', async () => {
    const downloader = createFakeModelDownloader();
    const remove = jest.spyOn(downloader, 'remove');
    const manager = make(downloader);
    await manager.download('minilm-qa');
    await manager.remove('minilm-qa');
    expect(remove).toHaveBeenCalledWith({ fake: 'minilm-qa' });
    expect(manager.isInstalled('embedding')).toBe(false);
  });

  it('rejects unknown model ids', async () => {
    await expect(make().download('gpt-9')).rejects.toMatchObject({ code: 'MODEL_NOT_INSTALLED' });
  });
});
