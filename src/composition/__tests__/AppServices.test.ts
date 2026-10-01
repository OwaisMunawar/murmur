import { createMemoryAudioStore } from '@/features/recording/data/audioStore';
import { createMigratedTestDriver } from '@/test-utils/sqliteTestDriver';

import { buildServices, startServices } from '../AppServices';
import { demoParts } from '../demoParts';

async function setup() {
  const db = await createMigratedTestDriver();
  const audio = createMemoryAudioStore();
  const services = buildServices({
    isDemo: false,
    db,
    audio,
    ...demoParts(),
    environment: {
      network: async () => ({ isConnected: true, isMetered: false }),
      freeBytes: () => 50_000_000_000,
      now: () => Date.now(),
    },
    deviceLanguages: () => ['en-US'],
  });
  return { services, audio };
}

const speech = Float32Array.from({ length: 16_000 * 3 }, (_, i) => Math.sin(i / 6) * 0.3);

describe('AppServices', () => {
  it('finishes a waiting note as soon as the speech model is downloaded', async () => {
    const { services, audio } = await setup();
    await startServices(services);
    const file = await audio.save('n1', speech, 16_000);
    await services.notes.create({
      id: 'n1',
      createdAt: 1,
      durationMs: 3_000,
      audioFile: file,
      language: null,
    });
    await services.processor.enqueue('n1');
    expect((await services.notes.get('n1'))?.status).toBe('recorded');

    await services.models.download('whisper-tiny');
    await services.processor.enqueue('n1');
    expect((await services.notes.get('n1'))?.status).toBe('ready');
    services.dispose();
  });

  it('purges soft-deleted notes and their recordings at startup', async () => {
    const { services, audio } = await setup();
    const file = await audio.save('n2', speech, 16_000);
    await services.notes.create({
      id: 'n2',
      createdAt: 1,
      durationMs: 3_000,
      audioFile: file,
      language: null,
    });
    await services.notes.softDelete('n2');
    await startServices(services);
    expect(audio.size()).toBe(0);
    expect(await services.notes.count()).toBe(0);
    services.dispose();
  });
});
