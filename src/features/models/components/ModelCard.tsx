import { Alert, View } from 'react-native';

import { formatBytes } from '@/core/lib/format';
import { useTheme } from '@/core/theme';
import { Button, Card, Icon, ProgressBar, Text, type IconName } from '@/core/ui';

import { type ModelKind, type ModelSpec } from '../catalog';
import { type ModelState } from '../data/modelManager';

const KIND_ICON: Record<ModelKind, IconName> = {
  speech: 'waveform',
  language: 'sparkles',
  embedding: 'search',
};

export function ModelCard({
  spec,
  state,
  onDownload,
  onCancel,
  onRemove,
}: {
  spec: ModelSpec;
  state: ModelState;
  onDownload: () => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const { colors, spacing, radii } = useTheme();
  const size =
    state.status === 'installed'
      ? `${formatBytes(state.bytes)} on disk`
      : `${formatBytes(spec.downloadBytes)} download`;

  return (
    <Card testID={`model-${spec.id}`} style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radii.md,
            backgroundColor: state.status === 'installed' ? colors.successSoft : colors.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Icon
            name={state.status === 'installed' ? 'check' : KIND_ICON[spec.kind]}
            size={18}
            color={state.status === 'installed' ? colors.success : colors.accent}
          />
        </View>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text variant="headline">{spec.name}</Text>
          <Text variant="caption" color="textMuted">
            {spec.purpose}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <Text variant="caption" color="textFaint" tabular testID={`model-size-${spec.id}`}>
          {size}
        </Text>
        <Text variant="caption" color="textFaint">
          {spec.license}
        </Text>
      </View>

      {state.status === 'downloading' ? (
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="caption" color="accent">
              Downloading
            </Text>
            <Text variant="caption" color="textMuted" tabular>
              {Math.round(state.progress * 100)}% of {formatBytes(spec.downloadBytes)}
            </Text>
          </View>
          <ProgressBar progress={state.progress} testID={`model-progress-${spec.id}`} />
          <Button
            label="Cancel"
            variant="ghost"
            compact
            onPress={onCancel}
            testID={`model-cancel-${spec.id}`}
          />
        </View>
      ) : state.status === 'installed' ? (
        <Button
          label="Delete"
          icon="trash"
          variant="danger"
          compact
          testID={`model-delete-${spec.id}`}
          onPress={() =>
            Alert.alert(
              `Delete ${spec.name}?`,
              'You can download it again at any time. Your notes are kept.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: onRemove },
              ],
            )
          }
        />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {state.status === 'error' && (
            <Text
              variant="caption"
              color={state.code === 'MODEL_DOWNLOAD_NEEDS_WIFI' ? 'warning' : 'danger'}>
              {state.message}
            </Text>
          )}
          <Button
            label="Download"
            icon="download"
            compact
            onPress={onDownload}
            testID={`model-download-${spec.id}`}
          />
        </View>
      )}
    </Card>
  );
}
