import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useLocalSearchParams } from 'expo-router';

import { type AppServices } from '@/composition/AppServices';
import { createTestServices, renderWithServices } from '@/test-utils/renderWithServices';

import { NoteDetailScreen } from '../NoteDetailScreen';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __player: player } = require('expo-audio') as {
  __player: { seekTo: jest.Mock; play: jest.Mock };
};

describe('NoteDetailScreen', () => {
  let services: AppServices;
  let id: string;

  beforeEach(async () => {
    services = await createTestServices();
    id = (await services.notes.list({ text: 'groceries dinner' }))[0]!.id;
    jest.mocked(useLocalSearchParams).mockReturnValue({ id });
    player.seekTo.mockClear();
    player.play.mockClear();
  });
  afterEach(() => services.dispose());

  it('shows the summary, to-dos, tags and transcript', async () => {
    await renderWithServices(<NoteDetailScreen />, services);
    expect(await screen.findByTestId('summary-card')).toBeTruthy();
    expect(screen.getAllByText(/lemon risotto/).length).toBeGreaterThan(0);
    expect(screen.getByText('Buy arborio rice, lemons and parmesan')).toBeTruthy();
    expect(screen.getByText('#cooking')).toBeTruthy();
    expect(screen.getByTestId('segment-0')).toBeTruthy();
    expect(screen.getByText('Demo mode: written by a scripted stand-in model')).toBeTruthy();
  });

  it('checks off an action item', async () => {
    await renderWithServices(<NoteDetailScreen />, services);
    await fireEvent.press(await screen.findByTestId('action-0'));
    await waitFor(async () => {
      const note = await services.notes.get(id);
      expect(note?.actionItems[0]?.done).toBe(true);
    });
  });

  it('seeks playback when a sentence is tapped', async () => {
    await renderWithServices(<NoteDetailScreen />, services);
    const note = await services.notes.get(id);
    await fireEvent.press(await screen.findByTestId('segment-2'));
    await waitFor(() =>
      expect(player.seekTo).toHaveBeenCalledWith(note!.segments[2]!.startMs / 1000),
    );
    expect(player.play).toHaveBeenCalled();
  });

  it('opens at the cited moment', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id, t: '4200' });
    await renderWithServices(<NoteDetailScreen />, services);
    await waitFor(() => expect(player.seekTo).toHaveBeenCalledWith(4.2));
  });

  it('renames the note', async () => {
    await renderWithServices(<NoteDetailScreen />, services);
    const title = await screen.findByTestId('note-title');
    await fireEvent.changeText(title, 'Risotto night');
    await fireEvent(title, 'endEditing');
    await waitFor(async () => expect((await services.notes.get(id))?.title).toBe('Risotto night'));
  });

  it('removes a tag', async () => {
    await renderWithServices(<NoteDetailScreen />, services);
    await fireEvent.press(await screen.findByTestId('edit-tag-cooking'));
    await waitFor(async () => expect((await services.notes.get(id))?.tags).toEqual(['friends']));
  });

  it('handles a note that no longer exists', async () => {
    jest.mocked(useLocalSearchParams).mockReturnValue({ id: 'gone' });
    await renderWithServices(<NoteDetailScreen />, services);
    expect(await screen.findByText('Note not found')).toBeTruthy();
  });
});
