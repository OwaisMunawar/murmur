import { View } from 'react-native';

import { useTheme } from '@/core/theme';

import { Icon } from './Icon';
import { ScalePressable } from './Pressable';
import { Text } from './Text';

export function Checkbox({
  label,
  checked,
  onToggle,
  testID,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  testID?: string;
}) {
  const { colors, spacing } = useTheme();
  return (
    <ScalePressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onToggle}
      pressedScale={0.985}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
        paddingVertical: spacing.sm,
      }}>
      <View style={{ paddingTop: 1 }}>
        <Icon
          name={checked ? 'checkboxOn' : 'checkboxOff'}
          size={22}
          color={checked ? colors.success : colors.textFaint}
        />
      </View>
      <Text
        style={{
          flex: 1,
          textDecorationLine: checked ? 'line-through' : 'none',
          color: checked ? colors.textFaint : colors.text,
        }}>
        {label}
      </Text>
    </ScalePressable>
  );
}
