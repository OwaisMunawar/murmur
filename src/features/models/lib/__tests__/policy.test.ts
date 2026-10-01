import { MODEL_CATALOG, modelById, modelForKind } from '../../catalog';
import { capabilitiesFor, describeMissing } from '../capabilities';
import { DISK_HEADROOM_BYTES, decideDownload } from '../downloadPolicy';

const wifi = { isConnected: true, isMetered: false };
const cellular = { isConnected: true, isMetered: true };

describe('decideDownload', () => {
  const plenty = 10_000_000_000;

  it('allows downloads on Wi-Fi with space to spare', () => {
    expect(
      decideDownload({ network: wifi, wifiOnly: true, requiredBytes: 1, freeBytes: plenty }),
    ).toEqual({ allowed: true });
  });

  it('respects Wi-Fi only on metered connections', () => {
    expect(
      decideDownload({ network: cellular, wifiOnly: true, requiredBytes: 1, freeBytes: plenty }),
    ).toMatchObject({
      allowed: false,
      reason: 'needs-wifi',
    });
    expect(
      decideDownload({ network: cellular, wifiOnly: false, requiredBytes: 1, freeBytes: plenty })
        .allowed,
    ).toBe(true);
  });

  it('refuses when offline or short on disk', () => {
    expect(
      decideDownload({
        network: { isConnected: false, isMetered: false },
        wifiOnly: false,
        requiredBytes: 1,
        freeBytes: plenty,
      }),
    ).toMatchObject({ reason: 'offline' });
    expect(
      decideDownload({
        network: wifi,
        wifiOnly: false,
        requiredBytes: 100,
        freeBytes: DISK_HEADROOM_BYTES + 99,
      }),
    ).toMatchObject({ reason: 'disk-space' });
  });
});

describe('capabilitiesFor', () => {
  it('needs both language and embedding models to answer questions', () => {
    expect(capabilitiesFor(new Set(['embedding']))).toEqual({
      canTranscribe: false,
      canWriteSummaries: false,
      canSearchByMeaning: true,
      canAnswer: false,
      missing: ['speech', 'language'],
    });
    expect(capabilitiesFor(new Set(['speech', 'language', 'embedding'])).canAnswer).toBe(true);
  });
});

describe('describeMissing', () => {
  it('lists what is switched off in plain words', () => {
    expect(describeMissing([])).toBeNull();
    expect(describeMissing(['speech'])).toBe('Download models to turn on transcription.');
    expect(describeMissing(['speech', 'language', 'embedding'])).toBe(
      'Download models to turn on transcription, summaries and answers and search by meaning.',
    );
  });
});

describe('catalog', () => {
  it('has exactly one model per kind', () => {
    expect(new Set(MODEL_CATALOG.map((m) => m.kind)).size).toBe(MODEL_CATALOG.length);
    expect(modelForKind('speech').id).toBe('whisper-tiny');
    expect(modelById('minilm-qa')?.kind).toBe('embedding');
    expect(modelById('nope')).toBeUndefined();
  });
});
