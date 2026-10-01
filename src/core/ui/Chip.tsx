import { useTheme } from '@/core/theme';

import { Icon, type IconName } from './Icon';
import { ScalePressable } from './Pressable';
import { Text } from './Text';

export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  tone = 'neutral',
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  tone?: 'neutral' | 'accent';
  testID?: string;
}) {
  const { colors, radii, spacing } = useTheme();
  const active = selected || tone === 'accent';
  const fg = active ? colors.accent : colors.textMuted;

  return (
    <ScalePressable
      testID={testID}
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={onPress ? { selected } : undefined}
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        height: 30,
        borderRadius: radii.pill,
        backgroundColor: active ? colors.accentSoft : colors.surfaceSunken,
      }}>
      {icon && <Icon name={icon} size={13} color={fg} />}
      <Text variant="caption" style={{ color: fg }}>
        {label}
      </Text>
    </ScalePressable>
  );
}
