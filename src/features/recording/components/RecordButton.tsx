import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/core/theme';

const SIZE = 88;

/**
 * The circle morphs into a rounded square while recording (the stop glyph),
 * and a halo breathes behind it so the state is readable at a glance.
 */
export function RecordButton({
  recording,
  onPress,
  disabled = false,
  testID = 'record-button',
}: {
  recording: boolean;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  const { colors, motion } = useTheme();
  const progress = useSharedValue(recording ? 1 : 0);
  const halo = useSharedValue(0);

  useEffect(() => {
    progress.set(withSpring(recording ? 1 : 0, motion.spring));
    halo.set(
      recording
        ? withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, true)
        : withTiming(0, { duration: motion.base }),
    );
  }, [recording, progress, halo, motion]);

  const core = useAnimatedStyle(() => {
    const p = progress.get();
    const size = interpolate(p, [0, 1], [SIZE - 16, 34]);
    return { width: size, height: size, borderRadius: interpolate(p, [0, 1], [size / 2, 9]) };
  });

  const ring = useAnimatedStyle(() => ({
    opacity: interpolate(halo.get(), [0, 1], [0.0, 0.35]),
    transform: [{ scale: interpolate(halo.get(), [0, 1], [1, 1.35]) }],
  }));

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
      accessibilityState={{ disabled }}
      style={{ width: SIZE, height: SIZE, opacity: disabled ? 0.5 : 1 }}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.center,
          { borderRadius: SIZE / 2, backgroundColor: colors.record },
          ring,
        ]}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.center,
          {
            borderRadius: SIZE / 2,
            borderWidth: 4,
            borderColor: colors.recordSoft,
            backgroundColor: colors.surface,
          },
        ]}>
        <Animated.View style={[{ backgroundColor: colors.record }, core]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
