import { Image, View } from 'react-native';
import type { ParticipantColor } from '@/types/database';
import { AppText } from './AppText';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { LEGACY_PURPLE_COLOR, participantPalettes, participantPalette } from '@/theme/tokens';

export function Avatar({ initials, imageUrl, size = 46, participantColor = LEGACY_PURPLE_COLOR }: { initials: string; imageUrl?: string | null; size?: number; participantColor?: ParticipantColor }) {
  const palette = participantPalette(participantColor);
  const shell = { width: size, height: size, borderRadius: size / 2, backgroundColor: palette.accentSoft, borderWidth: 2, borderColor: palette.accent } as const;
  if (imageUrl) return <Image accessibilityLabel={`${initials} profile photo`} source={{ uri: imageUrl }} resizeMode="cover" style={shell} />;
  return <View accessibilityLabel={`${initials} avatar`} style={{ ...shell, alignItems: 'center', justifyContent: 'center' }}><AppText variant="cardTitle" style={{ color: palette.accent }}>{initials}</AppText></View>;
}

function initial(value: string | undefined, fallback: string) { const trimmed = value?.trim(); return trimmed ? trimmed.slice(0, 1).toUpperCase() : fallback; }

export function CoupleAvatar() {
  const { profile, partnerProfile, myColor, partnerColor } = useWorkspace();
  return <View style={{ width: 72, height: 48, flexDirection: 'row', alignItems: 'center' }}>
    <Avatar initials={initial(profile?.display_name, '?')} imageUrl={profile?.avatar_url} size={48} participantColor={myColor} />
    <View style={{ marginLeft: -18 }}><Avatar initials={initial(partnerProfile?.display_name, '♡')} imageUrl={partnerProfile?.avatar_url} size={48} participantColor={partnerColor} /></View>
  </View>;
}
