import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useTheme } from '@/core/theme';
import { Chip, Icon, ScalePressable } from '@/core/ui';

import { parseTagInput } from '../lib/tags';

export function TagEditor({
  tags,
  onChange,
}: {
  tags: readonly string[];
  onChange: (tags: string[]) => void;
}) {
  const { colors, spacing, radii, typography } = useTheme();
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);

  const commit = () => {
    const added = parseTagInput(draft);
    if (added.length > 0) onChange([...new Set([...tags, ...added])]);
    setDraft('');
    setAdding(false);
  };

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, alignItems: 'center' }}>
      {tags.map((tag) => (
        <Chip
          key={tag}
          label={`#${tag}`}
          testID={`edit-tag-${tag}`}
          onPress={() => onChange(tags.filter((t) => t !== tag))}
        />
      ))}
      {adding ? (
        <TextInput
          testID="tag-input"
          autoFocus
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={commit}
          onBlur={commit}
          placeholder="tag"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          style={[
            typography.caption,
            {
              minWidth: 72,
              height: 30,
              paddingHorizontal: spacing.md,
              borderRadius: radii.pill,
              backgroundColor: colors.surfaceSunken,
              color: colors.text,
            },
          ]}
        />
      ) : (
        <ScalePressable
          testID="add-tag"
          accessibilityRole="button"
          accessibilityLabel="Add tag"
          onPress={() => setAdding(true)}
          style={{
            height: 30,
            width: 30,
            borderRadius: 15,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: 1,
            borderColor: colors.border,
          }}>
          <Icon name="plus" size={14} color={colors.textMuted} />
        </ScalePressable>
      )}
    </View>
  );
}
