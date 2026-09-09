import { Pressable, View } from 'react-native';
import { AppIcon } from '@/components/art/AppIcon';
import { useInteractionFeedback } from '@/hooks/useInteractionFeedback';
import { useAppTheme } from '@/theme/useAppTheme';
import { AppText } from './AppText';

export function DetailsToggle({
  open,
  onToggle,
  closedLabel = 'Add details',
  openLabel = 'Hide details',
  hint,
}: {
  open: boolean;
  onToggle: () => void;
  closedLabel?: string;
  openLabel?: string;
  hint?: string;
}) {
  const theme = useAppTheme();
  const feedback = useInteractionFeedback();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={open ? openLabel : closedLabel}
      onPress={() => { feedback(); onToggle(); }}
      style={({ pressed }) => ({
        minHeight: 46,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: theme.colors.border,
        paddingVertical: 9,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodySmall" style={{ fontWeight: '700' }}>{open ? openLabel : closedLabel}</AppText>
        {!open && hint ? <AppText variant="caption" tone="muted">{hint}</AppText> : null}
      </View>
      <AppIcon name={open ? 'chevronUp' : 'chevronDown'} size={15} color={theme.colors.textMuted} />
    </Pressable>
  );
}
