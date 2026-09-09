import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import type { ParticipantColor } from '@/types/database';
import { participantPalettes, participantPalette } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

type Props = {
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  tone?: 'default' | 'accent' | 'secondary';
  padded?: boolean;
  participantColor?: ParticipantColor | 'both';
};

export function Card({ children, style, tone = 'default', padded = true, participantColor }: Props) {
  const theme = useAppTheme();
  const backgroundColor = tone === 'accent' ? theme.colors.accentSoft : tone === 'secondary' ? theme.colors.secondarySoft : theme.colors.card;
  const ownerPalette = participantColor && participantColor !== 'both' ? participantPalette(participantColor) : null;

  return (
    <View
      style={[
        styles.card,
        tone === 'accent' ? theme.shadows.card : null,
        {
          backgroundColor,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.lg,
          padding: padded ? theme.spacing.lg : 0,
          shadowColor: theme.colors.shadow,
        },
        ownerPalette ? {
          borderLeftWidth: 4,
          borderLeftColor: ownerPalette.accent,
        } : null,
        participantColor === 'both' ? {
          borderLeftWidth: 4,
          borderLeftColor: theme.participants.me.accent,
          borderRightWidth: 4,
          borderRightColor: theme.participants.partner.accent,
        } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
});
