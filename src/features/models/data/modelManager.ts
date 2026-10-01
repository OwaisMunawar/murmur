import { AppError, toAppError, type ErrorCode } from '@/core/errors/AppError';
import { createStore, type Store } from '@/core/lib/store';

import { MODEL_CATALOG, modelById, modelForKind, type ModelKind, type ModelSpec } from '../catalog';
import { type ModelDownloader } from '../engine/ModelDownloader';
import { capabilitiesFor, type Capabilities } from '../lib/capabilities';
import { decideDownload, type NetworkSnapshot } from '../lib/downloadPolicy';
import { type InstalledModelsRepository } from './installedModelsRepository';

export type ModelState =
  | { status: 'missing' }
  | { status: 'downloading'; progress: number }
  | { status: 'installed'; bytes: number }
  | { status: 'error'; code: ErrorCode; message: string };

export type ModelsSnapshot = {
  byId: Readonly<Record<string, ModelState>>;
  capabilities: Capabilities;
};

export type ModelEnvironment = {
  network(): Promise<NetworkSnapshot>;
  freeBytes(): number;
  wifiOnly(): Promise<boolean>;
  now(): number;
};

export type ModelManager = ReturnType<typeof createModelManager>;

/**
 * Owns model lifecycle: what is on disk, what is downloading, and the
 * resolved local paths engines load from. UI subscribes to `store`; engines
 * call `resolve`, which fails with MODEL_NOT_INSTALLED instead of ever
 * starting a download behind the user's back.
 */
export function createModelManager(deps: {
  repository: InstalledModelsRepository;
  downloader: ModelDownloader;
  environment: ModelEnvironment;
}) {
  const { repository, downloader, environment } = deps;
  const resolved = new Map<string, unknown>();
  const controllers = new Map<string, AbortController>();
  const store: Store<ModelsSnapshot> = createStore(snapshotFrom(initialStates()));

  function update(id: string, state: ModelState) {
    store.set((current) => snapshotFrom({ ...current.byId, [id]: state }));
  }

  return {
    store,

    /** Reconciles the database with the disk: files deleted by the OS mean the model is gone. */
    async refresh() {
      const states = initialStates();
      for (const row of await repository.list()) {
        if (!modelById(row.id)) continue;
        const bytes = await downloader.measure(row.resolved);
        if (bytes > 0) {
          resolved.set(row.id, row.resolved);
          states[row.id] = { status: 'installed', bytes };
        } else {
          resolved.delete(row.id);
          await repository.remove(row.id);
        }
      }
      for (const id of controllers.keys())
        states[id] = store.get().byId[id] ?? { status: 'missing' };
      store.set(snapshotFrom(states));
    },

    async download(id: string): Promise<void> {
      const spec = requireSpec(id);
      if (controllers.has(id)) return;
      const decision = decideDownload({
        network: await environment.network(),
        wifiOnly: await environment.wifiOnly(),
        requiredBytes: spec.downloadBytes,
        freeBytes: environment.freeBytes(),
      });
      if (!decision.allowed) {
        const code: ErrorCode =
          decision.reason === 'needs-wifi' ? 'MODEL_DOWNLOAD_NEEDS_WIFI' : 'MODEL_DOWNLOAD_FAILED';
        update(id, { status: 'error', code, message: decision.message });
        throw new AppError(code, decision.message);
      }

      const controller = new AbortController();
      controllers.set(id, controller);
      update(id, { status: 'downloading', progress: 0 });
      try {
        const result = await downloader.download(spec, {
          signal: controller.signal,
          onProgress: (progress) => update(id, { status: 'downloading', progress }),
        });
        await repository.save({
          id,
          resolved: result.resolved,
          bytes: result.bytes,
          installedAt: environment.now(),
        });
        resolved.set(id, result.resolved);
        update(id, { status: 'installed', bytes: result.bytes });
      } catch (error) {
        // A cancelled download is not an error, whatever the transport threw.
        if (controller.signal.aborted) {
          update(id, { status: 'missing' });
          return;
        }
        const appError = toAppError(error, 'MODEL_DOWNLOAD_FAILED');
        update(id, { status: 'error', code: appError.code, message: appError.message });
        throw appError;
      } finally {
        controllers.delete(id);
      }
    },

    cancel(id: string) {
      controllers.get(id)?.abort();
    },

    async remove(id: string) {
      const config = resolved.get(id);
      if (config !== undefined) await downloader.remove(config);
      resolved.delete(id);
      await repository.remove(id);
      update(id, { status: 'missing' });
    },

    isInstalled(kind: ModelKind): boolean {
      return resolved.has(modelForKind(kind).id);
    },

    /** Local config for an installed model. Never downloads. */
    async resolve<T>(id: string): Promise<T> {
      const config = resolved.get(id);
      if (config === undefined) {
        throw new AppError('MODEL_NOT_INSTALLED', `${requireSpec(id).name} is not downloaded`);
      }
      return config as T;
    },
  };
}

function initialStates(): Record<string, ModelState> {
  return Object.fromEntries(MODEL_CATALOG.map((m) => [m.id, { status: 'missing' } as ModelState]));
}

function snapshotFrom(byId: Record<string, ModelState>): ModelsSnapshot {
  const installed = new Set<ModelKind>(
    MODEL_CATALOG.filter((m) => byId[m.id]?.status === 'installed').map((m) => m.kind),
  );
  return { byId, capabilities: capabilitiesFor(installed) };
}

function requireSpec(id: string): ModelSpec {
  const spec = modelById(id);
  if (!spec) throw new AppError('MODEL_NOT_INSTALLED', `Unknown model ${id}`);
  return spec;
}
