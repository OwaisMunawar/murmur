import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { type AppServices } from '@/composition/AppServices';
import { createTestServices, renderWithServices } from '@/test-utils/renderWithServices';

import { ModelsScreen } from '../ModelsScreen';

describe('ModelsScreen', () => {
  let services: AppServices;
  afterEach(() => services.dispose());

  it('downloads a model and reports its size on disk', async () => {
    services = await createTestServices({ installed: false });
    await renderWithServices(<ModelsScreen />, services);
    expect(screen.getByText('0 of 3 installed · 0 B on disk')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('model-download-minilm-qa'));
    await waitFor(() => expect(screen.getByTestId('model-delete-minilm-qa')).toBeTruthy());
    expect(screen.getByTestId('model-size-minilm-qa').props.children).toBe('91.1 MB on disk');
    expect(services.models.isInstalled('embedding')).toBe(true);
  });

  it('refuses cellular downloads while Wi-Fi only is on, until it is switched off', async () => {
    services = await createTestServices({ installed: false, metered: true });
    await renderWithServices(<ModelsScreen />, services);

    await fireEvent.press(screen.getByTestId('model-download-whisper-tiny'));
    expect(
      await screen.findByText('Wi-Fi only is on. Connect to Wi-Fi, or turn it off in Settings.'),
    ).toBeTruthy();

    await fireEvent(screen.getByTestId('wifi-only'), 'valueChange', false);
    await waitFor(async () => expect(await services.settings.get('wifiOnly')).toBe(false));
    await fireEvent.press(screen.getByTestId('model-download-whisper-tiny'));
    await waitFor(() => expect(services.models.isInstalled('speech')).toBe(true));
  });
});
