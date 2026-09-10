import { Pressable } from 'react-native';
import { AppIcon, type AppIconName } from '@/components/art/AppIcon';
import { useAppTheme } from '@/theme/useAppTheme';
import { useInteractionFeedback } from '@/hooks/useInteractionFeedback';

type IconButtonProps = {
  icon: AppIconName;
  label: string;
  onPress: () => void;
  tone?: 'muted' | 'accent' | 'danger';
  disabled?: boolean;
  accessibilityHint?: string;
};

// F3_ICON_POLISH_ACCESSIBILITY_FINISH: icon-only actions use a true 44pt target and explicit accessibility metadata.
export function IconButton({ icon, label, onPress, tone = 'muted', disabled = false, accessibilityHint }: IconButtonProps) {
  const theme = useAppTheme();
  const feedback = useInteractionFeedback();
  const color = tone === 'accent' ? theme.colors.accent : tone === 'danger' ? theme.colors.error : theme.colors.textMuted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      onPress={() => { if (disabled) return; feedback(); onPress(); }}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed && !disabled ? theme.colors.cardElevated : theme.colors.elevatedBackground,
        opacity: disabled ? 0.34 : pressed ? 0.76 : 1,
      })}
    >
      <AppIcon name={icon} size={20} color={color} />
    </Pressable>
  );
}
