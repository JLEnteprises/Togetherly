import { Pressable, View } from 'react-native';
import { AppText } from './AppText';
import { useAppTheme } from '@/theme/useAppTheme';
import { useInteractionFeedback } from '@/hooks/useInteractionFeedback';

type Props = { label: string; subtitle?: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean };

export function ToggleRow({ label, subtitle, value, onChange, disabled = false }: Props) {
  const theme = useAppTheme();
  const feedback = useInteractionFeedback();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityHint={subtitle}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => { feedback(); onChange(!value); }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.lg, minHeight: 52, paddingVertical: 12, opacity: disabled ? 0.5 : pressed ? 0.76 : 1 })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="cardTitle">{label}</AppText>
        {subtitle ? <AppText variant="bodySmall" tone="secondary">{subtitle}</AppText> : null}
      </View>
      <View style={{ width: 48, height: 28, borderRadius: 14, padding: 3, backgroundColor: value ? theme.colors.accentStrong : theme.colors.elevatedBackground, alignItems: value ? 'flex-end' : 'flex-start', borderWidth: 1, borderColor: value ? theme.colors.accent : theme.colors.border }}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: value ? theme.colors.onAccent : theme.colors.textSecondary }} />
      </View>
    </Pressable>
  );
}
