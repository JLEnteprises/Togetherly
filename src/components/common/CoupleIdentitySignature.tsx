import { View } from 'react-native';
import { Avatar } from './Avatar';
import { AppText } from './AppText';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { participantPalette } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

// E3_PAIRED_COUPLE_IDENTITY: couple-owned spaces show both people as one paired identity.
export function CoupleIdentitySignature({ detail }: { detail?: string }) {
  const theme = useAppTheme();
  const { profile, partnerProfile, myColor, partnerColor } = useWorkspace();
  const myPalette = participantPalette(myColor);
  const partnerPaletteValue = participantPalette(partnerColor);
  const meName = profile?.display_name ?? 'You';
  const partnerName = partnerProfile?.display_name ?? 'Partner';
  const meInitial = meName.trim().slice(0, 1).toUpperCase() || '?';
  const partnerInitial = partnerName.trim().slice(0, 1).toUpperCase() || '♡';

  return (
    <View
      accessibilityLabel={['Ours', meName, partnerName, detail].filter(Boolean).join('. ')}
      style={{
        alignSelf: 'stretch',
        position: 'relative',
        overflow: 'hidden',
        borderWidth: 1,
        borderLeftWidth: 3,
        borderRightWidth: 3,
        borderColor: theme.colors.border,
        borderLeftColor: myPalette.accent,
        borderRightColor: partnerPaletteValue.accent,
        borderRadius: theme.radii.lg,
        backgroundColor: theme.colors.elevatedBackground,
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          flexDirection: 'row',
        }}
      >
        <View style={{ flex: 1, backgroundColor: myPalette.glowSoft }} />
        <View style={{ flex: 1, backgroundColor: partnerPaletteValue.glowSoft }} />
      </View>

      <View style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 2, flexDirection: 'row', overflow: 'hidden', borderRadius: 1 }}>
        <View style={{ flex: 1, backgroundColor: myPalette.accent }} />
        <View style={{ flex: 1, backgroundColor: partnerPaletteValue.accent }} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm }}>
        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Avatar initials={meInitial} imageUrl={profile?.avatar_url} size={34} participantColor={myColor} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <AppText variant="caption" style={{ color: myPalette.accent }}>YOU</AppText>
            <AppText variant="bodySmall" numberOfLines={1}>{meName}</AppText>
          </View>
        </View>

        <View style={{ alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, paddingVertical: 5, borderRadius: theme.radii.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card }}>
          <AppText variant="caption" style={{ color: theme.colors.textPrimary, letterSpacing: 0.7 }}>OURS</AppText>
        </View>

        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
            <AppText variant="caption" style={{ color: partnerPaletteValue.accent }}>PARTNER</AppText>
            <AppText variant="bodySmall" numberOfLines={1} align="right">{partnerName}</AppText>
          </View>
          <Avatar initials={partnerInitial} imageUrl={partnerProfile?.avatar_url} size={34} participantColor={partnerColor} />
        </View>
      </View>

      {detail ? (
        <View style={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
          <AppText variant="caption" tone="muted" align="center">{detail}</AppText>
        </View>
      ) : null}
    </View>
  );
}
