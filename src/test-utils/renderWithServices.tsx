import { render } from '@testing-library/react-native';
import { type ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { buildServices, type AppServices } from '@/composition/AppServices';
import { demoParts, installDemoModels } from '@/composition/demoParts';
import { ServicesProvider } from '@/composition/ServicesProvider';
import { ThemeProvider } from '@/core/theme';
import { seedDemoNotes } from '@/demo/seed';
import { ToastProvider } from '@/core/ui';
import { createMemoryAudioStore } from '@/features/recording/data/audioStore';

import { createMigratedTestDriver } from './sqliteTestDriver';

export type TestEnvironment = { metered?: boolean; seed?: boolean; installed?: boolean };

/** The demo container on an in-memory database: real repositories and pipelines, fake engines. */
export async function createTestServices({
  metered = false,
  seed = true,
  installed = true,
}: TestEnvironment = {}) {
  const db = await createMigratedTestDriver();
  const services = buildServices({
    isDemo: true,
    db,
    audio: createMemoryAudioStore(),
    ...demoParts(),
    environment: {
      network: async () => ({ isConnected: true, isMetered: metered }),
      freeBytes: () => 50_000_000_000,
      now: () => Date.now(),
    },
    deviceLanguages: () => ['en-GB'],
  });
  if (installed) await installDemoModels(db);
  await services.models.refresh();
  if (seed) {
    await seedDemoNotes({
      notes: services.notes,
      chunks: services.chunks,
      audio: services.audio,
      embedder: services.engines.embedder,
      now: Date.now(),
    });
  }
  return services;
}

export async function renderWithServices(ui: ReactElement, services: AppServices) {
  return await render(
    <SafeAreaProvider>
      <ThemeProvider scheme="light">
        <ServicesProvider services={services}>
          <ToastProvider>{ui}</ToastProvider>
        </ServicesProvider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
}
