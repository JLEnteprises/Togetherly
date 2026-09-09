import { Pressable, View } from 'react-native';
import { AppText } from './AppText';
import { useAppTheme } from '@/theme/useAppTheme';
import { useInteractionFeedback } from '@/hooks/useInteractionFeedback';

// E4_FINAL_VISUAL_CONSISTENCY: section actions use the same touch target and pressed affordance across the app.
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const theme = useAppTheme();
  const feedback = useInteractionFeedback();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <AppText variant="section" style={{ flex: 1 }}>{title}</AppText>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action}
          accessibilityState={{ disabled: !onAction }}
          disabled={!onAction}
          hitSlop={4}
          onPress={() => { if (!onAction) return; feedback(); onAction(); }}
          style={({ pressed }) => ({
            minHeight: 44,
            minWidth: 44,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 10,
            marginRight: -10,
            borderRadius: theme.radii.pill,
            backgroundColor: pressed && onAction ? theme.colors.accentSoft : 'transparent',
            opacity: onAction ? (pressed ? 0.8 : 1) : 0.45,
          })}
        >
          <AppText variant="bodySmall" tone="accent">{action}</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
