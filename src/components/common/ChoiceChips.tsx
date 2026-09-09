import { Pressable, View } from 'react-native';
import { AppText } from './AppText';
import { useAppTheme } from '@/theme/useAppTheme';
import { useInteractionFeedback } from '@/hooks/useInteractionFeedback';

type Option<T extends string> = { value: T; label: string };

// F3_ICON_POLISH_ACCESSIBILITY_FINISH: single-choice chips expose radio semantics instead of generic button semantics.
export function ChoiceChips<T extends string>({ value, options, onChange }: { value: T | null; options: readonly Option<T>[]; onChange: (value: T) => void }) {
  const theme = useAppTheme();
  const feedback = useInteractionFeedback();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active, checked: active }}
            onPress={() => { feedback(); onChange(option.value); }}
            style={({ pressed }) => ({
              minHeight: 44,
              paddingHorizontal: 13,
              paddingVertical: 9,
              borderRadius: theme.radii.pill,
              borderWidth: 1,
              borderColor: active ? theme.colors.accent : theme.colors.border,
              backgroundColor: active ? theme.colors.accentSoft : theme.colors.card,
              opacity: pressed ? 0.75 : 1,
              justifyContent: 'center',
            })}
          >
            <AppText variant="bodySmall" tone={active ? 'accent' : 'secondary'}>{option.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}
