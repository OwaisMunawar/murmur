import { View } from 'react-native';

import { useTheme } from '@/core/theme';

import { type Mood } from '../model';

export function useMoodColor(mood: Mood | null): string {
  const { colors } = useTheme();
  switch (mood) {
    case 'positive':
      return colors.success;
    case 'negative':
      return colors.record;
    case 'mixed':
      return colors.warning;
    default:
      return colors.textFaint;
  }
}

export function MoodDot({ mood, size = 8 }: { mood: Mood | null; size?: number }) {
  const color = useMoodColor(mood);
  return (
    <View
      accessibilityLabel={mood ? `Mood: ${mood}` : undefined}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}
    />
  );
}
