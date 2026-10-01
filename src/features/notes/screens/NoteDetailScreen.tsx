import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useServices } from '@/composition/ServicesProvider';
import { useQuery } from '@/core/hooks/useQuery';
import { formatDuration } from '@/core/lib/format';
import { useTheme } from '@/core/theme';
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  Icon,
  IconButton,
  SectionTitle,
  Text,
} from '@/core/ui';
import { useModels } from '@/features/models/hooks/useModels';
import { activeSegmentIndex } from '@/features/transcription/lib/transcript';

import { PlaybackScrubber } from '../components/PlaybackScrubber';
import { ProcessingCard } from '../components/ProcessingCard';
import { TagEditor } from '../components/TagEditor';
import { TranscriptView } from '../components/TranscriptView';
import { useNote, useProcessing } from '../hooks/useNotes';
import { usePlayback } from '../hooks/usePlayback';
import { isProcessing, type EnrichmentSource, type Note } from '../model';
import { useMoodColor } from '../components/MoodDot';

const SOURCE_LABEL: Record<EnrichmentSource, string> = {
  model: 'Written on this phone',
  repaired: 'Written on this phone (output repaired)',
  heuristic: 'Auto-titled without a language model',
};

export function NoteDetailScreen() {
  const { id, t } = useLocalSearchParams<{ id: string; t?: string }>();
  const note = useNote(id);

  if (note.loading && !note.data) return <View style={{ flex: 1 }} />;
  if (!note.data) {
    return <EmptyState icon="doc" title="Note not found" message="It may have been deleted." />;
  }
  return <NoteDetail note={note.data} initialMs={t ? Number(t) : null} />;
}

function NoteDetail({ note, initialMs }: { note: Note; initialMs: number | null }) {
  const services = useServices();
  const router = useRouter();
  const { colors, spacing, typography } = useTheme();
  const processing = useProcessing(note.id);
  const moodColor = useMoodColor(note.mood);
  const { capabilities } = useModels();

  const audioUri = note.audioFile ? services.audio.uriFor(note.audioFile) : null;
  const playback = usePlayback(audioUri);
  const audio = useQuery(`audio:${note.audioFile}`, async () =>
    note.audioFile ? (await services.audio.read(note.audioFile)).samples : null,
  );

  // Null while not editing, so a title written by the pipeline shows through.
  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const title = draftTitle ?? note.title;

  // A citation tap opens the note at the cited moment, once the player is ready.
  const jumped = useRef(false);
  useEffect(() => {
    if (initialMs === null || jumped.current || !playback.loaded) return;
    jumped.current = true;
    void playback.seek(initialMs);
  }, [initialMs, playback]);

  const positionMs =
    playback.positionMs > 0 || playback.playing ? playback.positionMs : (initialMs ?? 0);
  const active = activeSegmentIndex(note.segments, positionMs);
  const durationMs = playback.durationMs || note.durationMs;
  const created = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: 'numeric',
        minute: '2-digit',
      }).format(note.createdAt),
    [note.createdAt],
  );

  const changed = () => services.changes.emit({ id: note.id });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView
        testID="note-detail"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: spacing.lg,
          gap: spacing.lg,
          paddingBottom: spacing.xxxl,
        }}>
        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: moodColor }} />
            <Text variant="caption" color="textMuted">
              {created} · {formatDuration(note.durationMs)}
              {note.mood ? ` · ${note.mood}` : ''}
            </Text>
          </View>
          <TextInput
            testID="note-title"
            value={title}
            onChangeText={setDraftTitle}
            onEndEditing={() => {
              if (draftTitle?.trim() && draftTitle !== note.title) {
                void services.notes.updateTitle(note.id, draftTitle).then(changed);
              }
              setDraftTitle(null);
            }}
            placeholder={isProcessing(note.status) ? 'New recording' : 'Untitled note'}
            placeholderTextColor={colors.textFaint}
            multiline
            blurOnSubmit
            returnKeyType="done"
            accessibilityLabel="Title"
            style={[typography.title, { color: colors.text, padding: 0 }]}
          />
        </View>

        <PlaybackScrubber
          samples={audio.data ?? null}
          positionMs={positionMs}
          durationMs={durationMs}
          playing={playback.playing}
          onTogglePlay={playback.toggle}
          onSeek={(ms) => void playback.seek(ms)}
        />

        {processing && <ProcessingCard state={processing} />}
        {note.status === 'recorded' && !processing && (
          <Card style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <Icon name="download" size={18} color={colors.warning} />
            <Text style={{ flex: 1 }} color="textMuted">
              {note.statusDetail ?? 'Waiting to be transcribed.'}
            </Text>
            <IconButton
              icon="chevronRight"
              label="Open models"
              onPress={() => router.push('/models')}
            />
          </Card>
        )}
        {note.status === 'failed' && (
          <Card>
            <Text color="danger">Processing failed. {note.statusDetail}</Text>
          </Card>
        )}

        {note.summary ? (
          <Animated.View entering={FadeIn}>
            <Card testID="summary-card" style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Icon name="sparkles" size={14} color={colors.accent} />
                <Text variant="overline" color="accent">
                  Summary
                </Text>
              </View>
              <Text>{note.summary}</Text>
              {note.enrichmentSource && (
                <Text variant="caption" color="textFaint">
                  {services.isDemo
                    ? 'Demo mode: written by a scripted stand-in model'
                    : SOURCE_LABEL[note.enrichmentSource]}
                </Text>
              )}
              {note.enrichmentSource !== 'model' &&
                note.status === 'ready' &&
                capabilities.canWriteSummaries && (
                  <Button
                    label="Rewrite with the language model"
                    icon="sparkles"
                    variant="secondary"
                    compact
                    testID="rewrite-summary"
                    onPress={() => void services.processor.rewrite(note.id)}
                  />
                )}
            </Card>
          </Animated.View>
        ) : null}

        {note.actionItems.length > 0 && (
          <View style={{ gap: spacing.xs }}>
            <SectionTitle>To do</SectionTitle>
            {note.actionItems.map((item) => (
              <Checkbox
                key={item.id}
                testID={`action-${item.position}`}
                label={item.text}
                checked={item.done}
                onToggle={() =>
                  void services.notes.setActionItemDone(item.id, !item.done).then(changed)
                }
              />
            ))}
          </View>
        )}

        {(note.tags.length > 0 || note.status === 'ready') && (
          <View style={{ gap: spacing.sm }}>
            <SectionTitle>Tags</SectionTitle>
            <TagEditor
              tags={note.tags}
              onChange={(tags) => void services.notes.setTags(note.id, tags).then(changed)}
            />
          </View>
        )}

        {note.transcript || note.status === 'ready' ? (
          <View style={{ gap: spacing.sm }}>
            <SectionTitle>Transcript</SectionTitle>
            <TranscriptView
              segments={note.segments}
              activeIndex={active}
              onSeek={(ms) => void playback.seek(ms, true)}
            />
            <Text variant="caption" color="textFaint">
              Tap a sentence to play from there. Sentence timings are estimated.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
