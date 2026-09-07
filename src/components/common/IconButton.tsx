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
};

export function IconButton({ icon, label, onPress, tone = 'muted', disabled = false }: IconButtonProps) {
  const theme = useAppTheme();
  const feedback = useInteractionFeedback();
  const color = tone === 'accent' ? theme.colors.accent : tone === 'danger' ? theme.colors.error : theme.colors.textMuted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => { if (disabled) return; feedback(); onPress(); }}
      style={({ pressed }) => ({
        width: 42,
        height: 42,
        borderRadius: 14,
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
