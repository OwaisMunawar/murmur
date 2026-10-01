import { type ReactNode } from 'react';
import { View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { useTheme } from '@/core/theme';
import { Icon, Text } from '@/core/ui';

const ACTION_WIDTH = 96;

/**
 * Swipe left past the threshold to delete. The action scales in with the
 * drag (UI thread), and a full swipe commits without a second tap; undo is
 * offered by the caller's toast instead of a confirmation dialog.
 */
export function SwipeToDelete({
  children,
  onDelete,
  testID,
}: {
  children: ReactNode;
  onDelete: () => void;
  testID?: string;
}) {
  return (
    <ReanimatedSwipeable
      testID={testID}
      friction={1.6}
      rightThreshold={ACTION_WIDTH * 0.8}
      overshootRight={false}
      // Only right actions exist, so any open is a delete.
      onSwipeableOpen={onDelete}
      renderRightActions={(progress) => <DeleteAction progress={progress} />}>
      {children}
    </ReanimatedSwipeable>
  );
}

function DeleteAction({ progress }: { progress: SharedValue<number> }) {
  const { colors, radii, spacing } = useTheme();
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.6, 1], [0, 0.6, 1]),
    transform: [{ scale: interpolate(progress.get(), [0, 1], [0.7, 1], 'clamp') }],
  }));
  return (
    <View
      style={{
        width: ACTION_WIDTH,
        justifyContent: 'center',
        alignItems: 'center',
        paddingLeft: spacing.md,
      }}>
      <Animated.View
        style={[
          {
            flex: 1,
            alignSelf: 'stretch',
            borderRadius: radii.lg,
            backgroundColor: colors.recordSoft,
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.xs,
          },
          style,
        ]}>
        <Icon name="trash" size={20} color={colors.danger} />
        <Text variant="caption" style={{ color: colors.danger }}>
          Delete
        </Text>
      </Animated.View>
    </View>
  );
}
