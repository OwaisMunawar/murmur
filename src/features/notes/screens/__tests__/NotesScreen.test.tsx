import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { type AppServices } from '@/composition/AppServices';
import { createTestServices, renderWithServices } from '@/test-utils/renderWithServices';

import { NotesScreen } from '../NotesScreen';

describe('NotesScreen', () => {
  let services: AppServices;
  beforeEach(async () => {
    services = await createTestServices();
  });
  afterEach(() => services.dispose());

  it('lists notes grouped by day', async () => {
    await renderWithServices(<NotesScreen />, services);
    expect(await screen.findByText('Launch week priorities')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('Yesterday')).toBeTruthy();
  });

  it('filters by full-text search', async () => {
    await renderWithServices(<NotesScreen />, services);
    await screen.findByText('Launch week priorities');
    await fireEvent.changeText(screen.getByTestId('notes-search'), 'sintra');
    await waitFor(() => expect(screen.queryByText('Launch week priorities')).toBeNull());
    expect(screen.getByText('Lisbon trip planning')).toBeTruthy();
  });

  it('filters by tag', async () => {
    await renderWithServices(<NotesScreen />, services);
    await fireEvent.press(await screen.findByTestId('tag-health'));
    await waitFor(() => expect(screen.queryByText('Lisbon trip planning')).toBeNull());
    expect(screen.getByText('Dentist moved to Friday')).toBeTruthy();
    expect(screen.getByText('Morning run and knee check')).toBeTruthy();
  });

  it('searches by meaning when switched over', async () => {
    await renderWithServices(<NotesScreen />, services);
    await screen.findByText('Launch week priorities');
    await fireEvent.press(screen.getByTestId('search-mode-meaning'));
    await fireEvent.changeText(screen.getByTestId('notes-search'), 'knee physio');
    // Relevance order replaces day grouping.
    await waitFor(() => expect(screen.queryByText('Today')).toBeNull());
    const rows = screen.getAllByTestId(/^note-row-/);
    expect(rows[0]?.props.accessibilityLabel).toMatch(/^Morning run and knee check/);
  });

  it('deletes with a swipe and restores with undo', async () => {
    await renderWithServices(<NotesScreen />, services);
    await screen.findByText('Dentist moved to Friday');
    const [target] = await services.notes.list({ text: 'dentist' });

    await fireEvent(screen.getByTestId(`swipe-${target!.id}`), 'swipeableOpen');
    await waitFor(() => expect(screen.queryByText('Dentist moved to Friday')).toBeNull());
    expect(screen.getByText('Note deleted')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('toast-action'));
    expect(await screen.findByText('Dentist moved to Friday')).toBeTruthy();
  });

  it('shows a first-run empty state', async () => {
    const empty = await createTestServices({ seed: false });
    await renderWithServices(<NotesScreen />, empty);
    expect(await screen.findByText('Your voice notes live here')).toBeTruthy();
    empty.dispose();
  });
});
