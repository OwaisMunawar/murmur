import { memo } from 'react';
import { View } from 'react-native';

import { formatDuration, formatTime } from '@/core/lib/format';
import { useTheme } from '@/core/theme';
import { Icon, ProgressBar, ScalePressable, Text } from '@/core/ui';

import { useProcessing } from '../hooks/useNotes';
import { isProcessing, type NoteSummary } from '../model';
import { MoodDot } from './MoodDot';

const STAGE_LABEL = {
  transcribing: 'Transcribing',
  enriching: 'Writing summary',
  indexing: 'Indexing for search',
} as const;

/**
 * One note in the list. Memoised on the summary object, and the list keeps
 * unchanged summaries by reference across refetches (keepUnchanged), so a
 * change to one note re-renders one row. Processing progress comes from its
 * own subscription for the same reason.
 */
export const NoteRow = memo(function NoteRow({
  note,
  onPress,
}: {
  note: NoteSummary;
  onPress: (id: string) => void;
}) {
  const { colors, radii, spacing } = useTheme();
  const processing = useProcessing(note.id);
  const busy = isProcessing(note.status);
  const waiting = note.status === 'recorded' && !processing;

  return (
    <ScalePressable
      testID={`note-row-${note.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${note.title || 'Untitled note'}, ${formatDuration(note.durationMs)}`}
      accessibilityHint="Opens the note"
      pressedScale={0.985}
      onPress={() => onPress(note.id)}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.sm,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <MoodDot mood={note.mood} />
        <Text variant="caption" color="textFaint" tabular>
          {formatTime(note.createdAt)} · {formatDuration(note.durationMs)}
        </Text>
        <View style={{ flex: 1 }} />
        {note.openActionCount > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xxs }}>
            <Icon name="checkboxOff" size={12} color={colors.accent} />
            <Text variant="caption" style={{ color: colors.accent }}>
              {note.openActionCount}
            </Text>
          </View>
        )}
      </View>

      <Text variant="headline" numberOfLines={1}>
        {note.title || (busy ? 'New recording' : 'Untitled note')}
      </Text>

      {processing ? (
        <View style={{ gap: spacing.xs }}>
          <Text variant="caption" color="accent">
            {STAGE_LABEL[processing.stage]}
          </Text>
          <ProgressBar
            progress={processing.stage === 'transcribing' ? processing.progress : 0.6}
            height={4}
          />
        </View>
      ) : waiting ? (
        <Text variant="caption" color="warning">
          Waiting for the speech model
        </Text>
      ) : note.status === 'failed' ? (
        <Text variant="caption" color="danger">
          Could not process this recording
        </Text>
      ) : (
        <Text color="textMuted" numberOfLines={2}>
          {note.summary}
        </Text>
      )}

      {note.tags.length > 0 && (
        <View style={{ flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' }}>
          {note.tags.map((tag) => (
            <Text key={tag} variant="caption" color="textFaint">
              #{tag}
            </Text>
          ))}
        </View>
      )}
    </ScalePressable>
  );
});
