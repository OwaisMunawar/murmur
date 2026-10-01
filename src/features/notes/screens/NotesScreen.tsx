import { LegendList } from '@legendapp/list/react-native';
import { useRouter } from 'expo-router';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useServices } from '@/composition/ServicesProvider';
import { useTheme } from '@/core/theme';
import {
  Banner,
  Chip,
  EmptyState,
  Icon,
  SegmentedControl,
  Text,
  TextField,
  useToast,
} from '@/core/ui';
import { useModels } from '@/features/models/hooks/useModels';
import { describeMissing } from '@/features/models/lib/capabilities';
import { RecordFab } from '@/features/recording/components/RecordFab';

import { NoteRow } from '../components/NoteRow';
import { SwipeToDelete } from '../components/SwipeToDelete';
import { useNotesList, useTags } from '../hooks/useNotes';
import { flattenSections, groupByDay, type ListRow } from '../lib/grouping';
import { type NoteSummary } from '../model';

type SearchMode = 'words' | 'meaning';

const HEADER_HEIGHT = 40;

export function NotesScreen() {
  const router = useRouter();
  const services = useServices();
  const toast = useToast();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { capabilities } = useModels();

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('words');
  const [tag, setTag] = useState<string | null>(null);
  // Typing stays responsive while the search runs against the deferred value.
  const deferredQuery = useDeferredValue(query);

  const semantic = mode === 'meaning' && capabilities.canSearchByMeaning;
  const notes = useNotesList({ text: deferredQuery, tag, semantic });
  const tags = useTags();

  const rows = useMemo(() => {
    const list = notes.data?.notes ?? [];
    // Semantic results are ordered by relevance, so day grouping would scramble them.
    if (semantic && deferredQuery.trim()) {
      return list.map<ListRow<NoteSummary>>((item) => ({ type: 'item', key: item.id, item }));
    }
    return flattenSections(groupByDay(list, notes.data?.at ?? 0));
  }, [notes.data, semantic, deferredQuery]);

  const openNote = useCallback((id: string) => router.push(`/note/${id}`), [router]);

  const deleteNote = useCallback(
    async (id: string) => {
      await services.notes.softDelete(id);
      services.processor.cancel(id);
      services.changes.emit({ id });
      toast.show({
        message: 'Note deleted',
        actionLabel: 'Undo',
        onAction: () => {
          void services.notes.restore(id).then(() => services.changes.emit({ id }));
        },
        onExpire: () => void services.purge([id]),
      });
    },
    [services, toast],
  );

  const missing = describeMissing(capabilities.missing);
  const total = notes.data?.notes.length ?? 0;
  const searching = deferredQuery.trim().length > 0 || tag !== null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
        }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <Text variant="display" accessibilityRole="header">
              Murmur
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Icon name="lock" size={11} color={colors.success} />
              <Text variant="caption" color="textMuted">
                {services.isDemo ? 'Demo notes · ' : ''}Private, on this device
              </Text>
            </View>
          </View>
        </View>

        <TextField
          testID="notes-search"
          icon="search"
          placeholder={semantic ? 'Search by meaning' : 'Search notes'}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Search notes"
        />
        {capabilities.canSearchByMeaning && (
          <SegmentedControl
            testID="search-mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'words', label: 'Words' },
              { value: 'meaning', label: 'Meaning' },
            ]}
          />
        )}
        {(tags.data?.length ?? 0) > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.xs }}
            style={{ marginHorizontal: -spacing.lg }}
            contentInset={{ left: spacing.lg, right: spacing.lg }}
            contentOffset={{ x: -spacing.lg, y: 0 }}>
            {tags.data?.slice(0, 12).map(({ tag: name }) => (
              <Chip
                key={name}
                testID={`tag-${name}`}
                label={`#${name}`}
                selected={tag === name}
                onPress={() => setTag((current) => (current === name ? null : name))}
              />
            ))}
          </ScrollView>
        )}
        {missing && !services.isDemo && (
          <Banner
            testID="models-banner"
            icon="download"
            title="Some features need a model"
            message={missing}
            tone="warning"
            onPress={() => router.push('/models')}
          />
        )}
      </View>

      <LegendList
        testID="notes-list"
        data={rows}
        keyExtractor={(row) => row.key}
        getItemType={(row) => row.type}
        // Day headers are fixed height; telling the list keeps its size
        // estimate for note rows from being skewed by them.
        getFixedItemSize={(row) => (row.type === 'header' ? HEADER_HEIGHT : undefined)}
        estimatedItemSize={120}
        recycleItems
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + 140,
          paddingTop: spacing.sm,
        }}
        keyboardDismissMode="on-drag"
        renderItem={({ item: row }) =>
          row.type === 'header' ? (
            <View
              style={{
                backgroundColor: colors.background,
                paddingTop: spacing.lg,
                paddingBottom: spacing.sm,
              }}>
              <Text variant="overline" color="textFaint" accessibilityRole="header">
                {row.label}
              </Text>
            </View>
          ) : (
            <View style={{ paddingBottom: spacing.md }}>
              <SwipeToDelete
                testID={`swipe-${row.item.id}`}
                onDelete={() => void deleteNote(row.item.id)}>
                <NoteRow note={row.item} onPress={openNote} />
              </SwipeToDelete>
            </View>
          )
        }
        ListEmptyComponent={
          notes.loading ? null : (
            <Animated.View entering={FadeIn}>
              {searching ? (
                <EmptyState
                  icon="search"
                  title="No matches"
                  message="Try other words, or switch search mode."
                />
              ) : (
                <EmptyState
                  icon="waveform"
                  title="Your voice notes live here"
                  message="Tap the button below and start talking. Murmur transcribes and summarises on this phone."
                />
              )}
            </Animated.View>
          )
        }
      />

      <RecordFab
        onPress={() => router.push('/record')}
        hint={total === 0 ? 'Record your first note' : undefined}
      />
    </View>
  );
}
