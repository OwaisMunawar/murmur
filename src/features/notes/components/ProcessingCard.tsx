import { View } from 'react-native';

import { useTheme } from '@/core/theme';
import { Card, Icon, ProgressBar, Text } from '@/core/ui';

import { type ProcessingState } from '../pipeline/noteProcessor';

const COPY = {
  transcribing: { title: 'Transcribing on this phone', icon: 'waveform' },
  enriching: { title: 'Writing a title and summary', icon: 'sparkles' },
  indexing: { title: 'Indexing for Ask', icon: 'search' },
} as const;

export function ProcessingCard({ state }: { state: ProcessingState }) {
  const { colors, spacing } = useTheme();
  const copy = COPY[state.stage];
  return (
    <Card testID="processing-card" style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Icon name={copy.icon} size={16} color={colors.accent} />
        <Text variant="callout" color="accent" style={{ flex: 1 }}>
          {copy.title}
        </Text>
        {state.stage === 'transcribing' && (
          <Text variant="caption" color="textMuted" tabular>
            {Math.round(state.progress * 100)}%
          </Text>
        )}
      </View>
      <ProgressBar progress={state.stage === 'transcribing' ? state.progress : 1} />
      {state.partialText ? (
        <Text color="textMuted" numberOfLines={4}>
          {state.partialText}
        </Text>
      ) : null}
    </Card>
  );
}
