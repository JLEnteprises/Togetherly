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
  const sharedOwner = participantColor === 'both';
  // E1_SHARED_OURS_VISUAL_IDENTITY: shared surfaces visibly carry both participant identities.

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
        sharedOwner ? {
          borderLeftWidth: 4,
          borderLeftColor: theme.participants.me.accent,
          borderRightWidth: 4,
          borderRightColor: theme.participants.partner.accent,
        } : null,
        style,
      ]}
    >
      {sharedOwner ? (
        <View
          pointerEvents="none"
          style={[styles.sharedWash, { borderRadius: Math.max(0, theme.radii.lg - 1) }]}
        >
          <View style={{ flex: 1, backgroundColor: theme.participants.me.accentSoft }} />
          <View style={{ flex: 1, backgroundColor: theme.participants.partner.accentSoft }} />
          <View style={styles.sharedRail}>
            <View style={{ flex: 1, backgroundColor: theme.participants.me.accent }} />
            <View style={{ flex: 1, backgroundColor: theme.participants.partner.accent }} />
          </View>
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  sharedWash: {
    position: 'absolute',
    top: 1,
    right: 1,
    bottom: 1,
    left: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  sharedRail: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    height: 2,
    borderRadius: 1,
    flexDirection: 'row',
    overflow: 'hidden',
  },
});
