import { View } from 'react-native';

import { formatDuration } from '@/core/lib/format';
import { useTheme } from '@/core/theme';
import { Icon, ScalePressable, Text } from '@/core/ui';

import { formatSourceDate } from '../lib/askPrompt';
import { answerText, type AnswerPart } from '../lib/citations';
import { type ChunkHit } from '../lib/ranking';

export function AnswerText({
  parts,
  onCite,
}: {
  parts: readonly AnswerPart[];
  onCite: (source: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <Text accessibilityLabel={answerText(parts)} style={{ lineHeight: 25 }}>
      {parts.map((part, index) =>
        part.type === 'text' ? (
          <Text key={index}>{part.text}</Text>
        ) : (
          <Text
            key={index}
            testID={`citation-${part.source}`}
            accessibilityRole="link"
            accessibilityLabel={`Source ${part.source}`}
            onPress={() => onCite(part.source)}
            style={{ color: colors.accent, fontWeight: '700', fontSize: 13 }}>
            {` [${part.source}]`}
          </Text>
        ),
      )}
    </Text>
  );
}

export function SourceCard({
  index,
  source,
  onPress,
}: {
  index: number;
  source: ChunkHit;
  onPress: () => void;
}) {
  const { colors, radii, spacing } = useTheme();
  return (
    <ScalePressable
      testID={`source-${index}`}
      accessibilityRole="button"
      accessibilityLabel={`Source ${index}: ${source.noteTitle}`}
      accessibilityHint="Opens the note at this passage"
      pressedScale={0.985}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radii.md,
        backgroundColor: colors.surfaceSunken,
      }}>
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text variant="caption" color="accent">
          {index}
        </Text>
      </View>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text variant="callout" numberOfLines={1}>
          {source.noteTitle || 'Untitled note'}
        </Text>
        <Text variant="caption" color="textMuted" numberOfLines={2}>
          {source.text}
        </Text>
        <Text variant="caption" color="textFaint">
          {formatSourceDate(source.noteCreatedAt)} · at {formatDuration(source.startMs)}
        </Text>
      </View>
      <Icon name="play" size={12} color={colors.textFaint} />
    </ScalePressable>
  );
}
