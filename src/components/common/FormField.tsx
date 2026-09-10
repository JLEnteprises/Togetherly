import { useState } from 'react';
import { TextInput, View, type KeyboardTypeOptions, type TextInputProps } from 'react-native';
import { AppText } from './AppText';
import { useAppTheme } from '@/theme/useAppTheme';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
};

export function FormField({ label, error, multiline, accessibilityLabel, ...props }: Props) {
  const theme = useAppTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="caption" tone="secondary">{label}</AppText>
      <TextInput
        {...props}
        onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
        selectionColor={theme.colors.accent}
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: props.editable === false }}
        multiline={multiline}
        placeholderTextColor={theme.colors.textMuted}
        style={{
          minHeight: multiline ? 112 : 50,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: multiline ? theme.spacing.md : 0,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: error ? theme.colors.error : focused ? theme.colors.accent : theme.colors.border,
          backgroundColor: theme.colors.elevatedBackground,
          color: theme.colors.textPrimary,
          fontSize: 16,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
      {error ? <AppText variant="caption" tone="error" accessibilityLiveRegion="polite">{error}</AppText> : null}
    </View>
  );
}
