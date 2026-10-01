import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/core/theme';
import { Icon, ScalePressable, Text } from '@/core/ui';

/** Floating record button above the tab bar. */
export function RecordFab({ onPress, hint }: { onPress: () => void; hint?: string }) {
  const { colors, spacing, radii } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: insets.bottom + 64,
        alignItems: 'center',
        gap: spacing.sm,
      }}>
      {hint && (
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radii.pill,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.xs,
          }}>
          <Text variant="caption" color="textMuted">
            {hint}
          </Text>
        </View>
      )}
      <ScalePressable
        testID="record-fab"
        accessibilityRole="button"
        accessibilityLabel="New recording"
        pressedScale={0.92}
        onPress={onPress}
        style={{
          width: 68,
          height: 68,
          borderRadius: 34,
          backgroundColor: colors.record,
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: colors.record,
          shadowOpacity: 0.35,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        }}>
        <Icon name="mic" size={28} color={colors.onAccent} />
      </ScalePressable>
    </View>
  );
}
