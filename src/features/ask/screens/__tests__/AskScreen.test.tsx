import { fireEvent, screen } from '@testing-library/react-native';
import { useRouter } from 'expo-router';

import { type AppServices } from '@/composition/AppServices';
import { createTestServices, renderWithServices } from '@/test-utils/renderWithServices';

import { AskScreen } from '../AskScreen';

describe('AskScreen', () => {
  let services: AppServices;
  beforeEach(async () => {
    services = await createTestServices();
    jest.mocked(useRouter().push).mockClear();
  });
  afterEach(() => services.dispose());

  it('answers with citations that open the source note at the passage', async () => {
    await renderWithServices(<AskScreen />, services);
    await fireEvent.changeText(screen.getByTestId('ask-input'), 'When is my dentist cleaning?');
    await fireEvent.press(screen.getByTestId('ask-send'));

    expect(
      await screen.findByText('Your cleaning moved from Wednesday to Friday at nine fifteen.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByTestId('citation-1'));

    const [dentist] = await services.notes.list({ text: 'dentist' });
    expect(useRouter().push).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^/note/${dentist!.id}\\?t=\\d+$`)),
    );
  });

  it('runs a suggested question', async () => {
    await renderWithServices(<AskScreen />, services);
    await fireEvent.press(screen.getByTestId('suggestion-2'));
    expect((await screen.findAllByTestId(/^source-\d$/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Lisbon trip planning').length).toBeGreaterThan(0);
  });

  it('asks for the models it needs before searching', async () => {
    const bare = await createTestServices({ installed: false });
    await renderWithServices(<AskScreen />, bare);
    expect(screen.getByTestId('ask-models-banner')).toBeTruthy();
    expect(screen.getByTestId('ask-send').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    bare.dispose();
  });
});
