import { getLocales } from 'expo-localization';
import { getNetworkStateAsync, NetworkStateType } from 'expo-network';
import { Paths } from 'expo-file-system';

import { IS_DEMO } from '@/core/config/env';
import { migrate } from '@/core/db/migrate';
import { openOpSqliteDriver } from '@/core/db/opSqliteDriver';
import { createFileAudioStore } from '@/features/recording/data/audioStore';

import type * as ExecutorchParts from './executorchParts';
import { buildServices, startServices, type AppServices, type ServiceParts } from './AppServices';

/**
 * Production wiring. ExecuTorch modules are required lazily so demo builds
 * and tests never initialise the native runtime they do not use.
 */
export async function createNativeServices(): Promise<AppServices> {
  const db = openOpSqliteDriver(IS_DEMO ? 'murmur-demo.db' : 'murmur.db');
  await migrate(db);

  const shared: Omit<ServiceParts, 'downloader' | 'engines'> = {
    isDemo: IS_DEMO,
    db,
    audio: createFileAudioStore(),
    environment: {
      network: async () => {
        const state = await getNetworkStateAsync();
        return {
          isConnected: state.isConnected ?? false,
          isMetered: state.type === NetworkStateType.CELLULAR,
        };
      },
      freeBytes: () => Paths.availableDiskSpace,
      now: () => Date.now(),
    },
    deviceLanguages: () => getLocales().map((locale) => locale.languageTag),
  };

  const services = IS_DEMO
    ? await demoServices(shared)
    : buildServices({ ...shared, ...realParts() });
  await startServices(services);
  return services;
}

function realParts(): Pick<ServiceParts, 'downloader' | 'engines'> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { executorchParts } = require('./executorchParts') as typeof ExecutorchParts;
  return executorchParts();
}

async function demoServices(
  shared: Omit<ServiceParts, 'downloader' | 'engines'>,
): Promise<AppServices> {
  const { demoParts, seedDemo } = await import('./demoParts');
  const services = buildServices({ ...shared, ...demoParts() });
  await seedDemo(services);
  return services;
}
