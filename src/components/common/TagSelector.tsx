import { Pressable, View } from 'react-native';
import type { Tag } from '@/types/database';
import { AppText } from './AppText';
import { DrawnIcon } from './DrawingCanvas';
import { useAppTheme } from '@/theme/useAppTheme';

export function TagSelector({ tags, selectedIds, onChange, label = 'TAGS' }: { tags: Tag[]; selectedIds: string[]; onChange: (ids: string[]) => void; label?: string }) {
  const theme = useAppTheme();
  if (!tags.length) return null;
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="caption" tone="secondary">{label}</AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
        {tags.map((tag) => {
          const active = selectedIds.includes(tag.id);
          const color = active ? theme.colors.accent : theme.colors.textSecondary;
          return (
            <Pressable key={tag.id} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onChange(active ? selectedIds.filter((id) => id !== tag.id) : [...selectedIds, tag.id])}
              style={({ pressed }) => ({ paddingHorizontal: 11, paddingVertical: 7, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: active ? theme.colors.accent : theme.colors.border, backgroundColor: active ? theme.colors.accentSoft : theme.colors.card, opacity: pressed ? 0.72 : 1 })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                {tag.icon_drawing?.strokes?.length ? <DrawnIcon strokes={tag.icon_drawing.strokes} size={16} color={color} /> : tag.icon ? <AppText variant="bodySmall" style={{ color }}>{tag.icon}</AppText> : null}
                <AppText variant="bodySmall" tone={active ? 'accent' : 'secondary'}>{tag.name}</AppText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
