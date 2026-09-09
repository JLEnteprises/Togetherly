import type { ReactNode } from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';
import { useAppTheme } from '@/theme/useAppTheme';

export type TextVariant = 'hero' | 'pageTitle' | 'section' | 'cardTitle' | 'body' | 'bodySmall' | 'caption' | 'button' | 'numeric';

type Props = TextProps & {
  children: ReactNode;
  variant?: TextVariant;
  tone?: 'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'warning' | 'error';
  align?: TextStyle['textAlign'];
};

export function AppText({ children, variant = 'body', tone = 'primary', align, style, ...props }: Props) {
  const theme = useAppTheme();
  const toneColor = {
    primary: theme.colors.textPrimary,
    secondary: theme.colors.textSecondary,
    muted: theme.colors.textMuted,
    accent: theme.colors.accentStrong,
    success: theme.colors.success,
    warning: theme.colors.warning,
    error: theme.colors.error,
  }[tone];

  return (
    <Text
      {...props}
      style={[theme.typography[variant], { color: toneColor, textAlign: align }, style]}
      maxFontSizeMultiplier={props.maxFontSizeMultiplier ?? 0}
    >
      {children}
    </Text>
  );
}
