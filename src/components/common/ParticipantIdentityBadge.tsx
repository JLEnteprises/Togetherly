import { View } from 'react-native';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { participantPalette } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import { Avatar } from './Avatar';
import { AppText } from './AppText';

function initial(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, 1).toUpperCase() : fallback;
}

export function ParticipantIdentityBadge({
  userId,
  both = false,
  detail,
  compact = true,
}: {
  userId?: string | null;
  both?: boolean;
  detail?: string;
  compact?: boolean;
}) {
  const theme = useAppTheme();
  const { profile, partnerProfile, myColor, partnerColor, colorForUser } = useWorkspace();
  const size = compact ? 22 : 28;
  const myPalette = participantPalette(myColor);
  const partnerPaletteValue = participantPalette(partnerColor);
  // E1_SHARED_OURS_VISUAL_IDENTITY: 'ours' uses both identities, never a third arbitrary colour.

  if (both) {
    const meName = profile?.display_name ?? 'You';
    const partnerName = partnerProfile?.display_name ?? 'Partner';
    return (
      <View
        accessibilityLabel={`Us. ${meName} and ${partnerName}${detail ? `. ${detail}` : ''}`}
        style={{
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
          paddingHorizontal: 9,
          paddingVertical: compact ? 5 : 7,
          borderRadius: theme.radii.pill,
          borderWidth: 1,
          borderLeftWidth: 3,
          borderRightWidth: 3,
          borderLeftColor: myPalette.accent,
          borderRightColor: partnerPaletteValue.accent,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.elevatedBackground,
          position: 'relative',
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 1,
            right: 1,
            bottom: 1,
            left: 1,
            borderRadius: theme.radii.pill,
            overflow: 'hidden',
            flexDirection: 'row',
          }}
        >
          <View style={{ flex: 1, backgroundColor: myPalette.accentSoft }} />
          <View style={{ flex: 1, backgroundColor: partnerPaletteValue.accentSoft }} />
        </View>
        <View style={{ width: size + 10, height: size, flexDirection: 'row', alignItems: 'center' }}>
          <Avatar initials={initial(profile?.display_name, '?')} imageUrl={profile?.avatar_url} size={size} participantColor={myColor} />
          <View style={{ marginLeft: -8 }}>
            <Avatar initials={initial(partnerProfile?.display_name, '♡')} imageUrl={partnerProfile?.avatar_url} size={size} participantColor={partnerColor} />
          </View>
        </View>
        <View style={{ gap: 1 }}>
          <AppText variant="caption" style={{ color: theme.colors.textPrimary }}>OURS · {meName} + {partnerName}</AppText>
          {detail ? <AppText variant="caption" tone="muted">{detail}</AppText> : null}
        </View>
      </View>
    );
  }

  const color = colorForUser(userId);
  if (color === 'both') return <ParticipantIdentityBadge both detail={detail} compact={compact} />;

  const isMe = Boolean(profile && userId === profile.id);
  const isPartner = Boolean(partnerProfile && userId === partnerProfile.id);
  const person = isMe ? profile : isPartner ? partnerProfile : null;
  const name = person?.display_name ?? 'Previous member';
  const imageUrl = person?.avatar_url ?? null;
  const role = isMe ? 'YOU' : isPartner ? 'PARTNER' : 'MEMBER';
  const palette = participantPalette(color);

  return (
    <View
      accessibilityLabel={`${role}. ${name}${detail ? `. ${detail}` : ''}`}
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 9,
        paddingVertical: compact ? 5 : 7,
        borderRadius: theme.radii.pill,
        borderWidth: 1,
        borderColor: palette.border,
        backgroundColor: palette.tint,
      }}
    >
      <Avatar initials={initial(name, '?')} imageUrl={imageUrl} size={size} participantColor={color} />
      <View style={{ gap: 1 }}>
        <AppText variant="caption" style={{ color: palette.accent }}>{role} · {name}</AppText>
        {detail ? <AppText variant="caption" tone="muted">{detail}</AppText> : null}
      </View>
    </View>
  );
}
