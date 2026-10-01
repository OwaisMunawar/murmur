import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme, type ColorRoles } from '@/core/theme';

/** `progress` is 0..1. Width animates on the UI thread between updates. */
export function ProgressBar({
  progress,
  tone = 'accent',
  height = 6,
  testID,
}: {
  progress: number;
  tone?: keyof ColorRoles;
  height?: number;
  testID?: string;
}) {
  const { colors, motion } = useTheme();
  const value = useSharedValue(progress);

  useEffect(() => {
    value.set(withTiming(Math.min(Math.max(progress, 0), 1), { duration: motion.base }));
  }, [progress, value, motion.base]);

  const fill = useAnimatedStyle(() => ({ width: `${value.get() * 100}%` }));

  return (
    <View
      testID={testID}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
      style={{
        height,
        borderRadius: height / 2,
        backgroundColor: colors.surfaceSunken,
        overflow: 'hidden',
      }}>
      <Animated.View
        style={[{ height, borderRadius: height / 2, backgroundColor: colors[tone] }, fill]}
      />
    </View>
  );
}
