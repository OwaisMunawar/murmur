import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { type AppServices } from '@/composition/AppServices';
import { createTestServices, renderWithServices } from '@/test-utils/renderWithServices';

import { RecordScreen } from '../RecordScreen';

describe('RecordScreen', () => {
  let services: AppServices;
  beforeEach(async () => {
    services = await createTestServices({ seed: false });
  });
  afterEach(() => services.dispose());

  it('runs the sample clip through the full pipeline into a finished note', async () => {
    await renderWithServices(<RecordScreen sampleSpeed={100} />, services);
    await fireEvent.press(screen.getByTestId('use-sample-clip'));

    await waitFor(() =>
      expect(useRouter().replace).toHaveBeenCalledWith(expect.stringMatching(/^\/note\//)),
    );
    await waitFor(async () => {
      const [note] = await services.notes.list();
      expect(note?.status).toBe('ready');
    });
    const [summary] = await services.notes.list();
    const note = await services.notes.get(summary!.id);
    expect(note?.transcript).toMatch(/^Quick reminder for tomorrow/);
    expect(note?.actionItems.length).toBeGreaterThan(0);
    expect(await services.chunks.countForNote(note!.id)).toBeGreaterThan(0);
  });

  it('starts and pauses a live recording', async () => {
    await renderWithServices(<RecordScreen />, services);
    await fireEvent.press(screen.getByTestId('record-button'));
    expect(await screen.findByText('Listening')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('record-pause'));
    expect(await screen.findByText('Paused')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('record-discard'));
    expect(await screen.findByText('Tap to record')).toBeTruthy();
  });
});
