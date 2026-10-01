import { TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/core/theme';

import { Icon, type IconName } from './Icon';

export function TextField({ icon, style, ...rest }: TextInputProps & { icon?: IconName }) {
  const { colors, radii, spacing, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        backgroundColor: colors.surfaceSunken,
        borderRadius: radii.md,
        paddingHorizontal: spacing.md,
        minHeight: 44,
      }}>
      {icon && <Icon name={icon} size={16} color={colors.textFaint} />}
      <TextInput
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.accent}
        {...rest}
        style={[
          typography.body,
          { flex: 1, color: colors.text, paddingVertical: spacing.sm },
          style,
        ]}
      />
    </View>
  );
}
