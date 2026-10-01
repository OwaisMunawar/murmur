import { memo } from 'react';
import { View } from 'react-native';

import { formatDuration } from '@/core/lib/format';
import { useTheme } from '@/core/theme';
import { Text } from '@/core/ui';

import { type Segment } from '../model';

/**
 * Transcript as tappable sentences. Tapping seeks playback to the sentence's
 * (approximate) start; the sentence being played is highlighted.
 */
export const TranscriptView = memo(function TranscriptView({
  segments,
  activeIndex,
  onSeek,
}: {
  segments: readonly Segment[];
  activeIndex: number;
  onSeek: (ms: number) => void;
}) {
  const { colors, radii, typography } = useTheme();
  if (segments.length === 0) {
    return (
      <Text color="textFaint" style={{ fontStyle: 'italic' }}>
        No speech was recognised in this recording.
      </Text>
    );
  }
  return (
    <View accessibilityRole="text">
      <Text style={[typography.body, { lineHeight: 27 }]}>
        {segments.map((segment, index) => {
          const active = index === activeIndex;
          return (
            <Text
              key={segment.position}
              testID={`segment-${segment.position}`}
              accessibilityRole="button"
              accessibilityLabel={`${segment.text} At ${formatDuration(segment.startMs)}`}
              accessibilityHint="Plays from this sentence"
              onPress={() => onSeek(segment.startMs)}
              suppressHighlighting={false}
              style={{
                color: active ? colors.text : colors.textMuted,
                backgroundColor: active ? colors.accentSoft : 'transparent',
                borderRadius: radii.sm,
              }}>
              {segment.text}
              {index < segments.length - 1 ? ' ' : ''}
            </Text>
          );
        })}
      </Text>
    </View>
  );
});
