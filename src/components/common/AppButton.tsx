import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { AppIcon, type AppIconName } from '@/components/art/AppIcon';
import { useAppTheme } from '@/theme/useAppTheme';
import { useInteractionFeedback } from '@/hooks/useInteractionFeedback';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  compact?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  icon?: AppIconName;
};

export function AppButton({ label, onPress, variant = 'primary', compact = false, disabled = false, accessibilityHint, icon }: Props) {
  const theme = useAppTheme();
  const feedback = useInteractionFeedback();
  const backgroundColor = variant === 'primary'
    ? theme.colors.accentStrong
    : variant === 'secondary'
      ? theme.colors.secondarySoft
      : variant === 'danger'
        ? 'rgba(228,126,149,0.14)'
        : 'transparent';
  const textColor = variant === 'primary'
    ? theme.colors.onAccent
    : variant === 'secondary'
      ? theme.colors.secondaryAccent
      : variant === 'danger'
        ? theme.colors.error
        : theme.colors.accent;

  function press() { if (disabled) return; feedback(); onPress?.(); }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={press}
      style={({ pressed }) => [styles.base, {
        minHeight: compact ? 44 : 50,
        paddingHorizontal: compact ? theme.spacing.lg : theme.spacing.xl,
        borderRadius: theme.radii.pill,
        backgroundColor,
        borderColor: variant === 'primary' ? 'rgba(255,255,255,0.10)' : theme.colors.border,
        opacity: disabled ? 0.48 : pressed ? 0.82 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      }]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {icon ? <AppIcon name={icon} size={17} color={textColor} /> : null}
        <AppText variant="button" style={{ color: textColor }}>{label}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({ base: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 } });
