import { View } from 'react-native';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { participantPalettes } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import { AppText } from './AppText';

export function ParticipantAttribution({ userId, verb = 'Added by', suffix }: { userId: string | null | undefined; verb?: string; suffix?: string }) {
  const theme = useAppTheme();
  const { profile, partnerProfile, colorForUser } = useWorkspace();
  const color = colorForUser(userId);
  const accent = color === 'both' ? theme.colors.textMuted : participantPalettes[color].accent;
  const name = profile && userId === profile.id
    ? profile.display_name
    : partnerProfile && userId === partnerProfile.id
      ? partnerProfile.display_name
      : 'Previous member';
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: accent }} /><AppText variant="caption" style={{ color: accent }}>{verb} {name}{suffix ? ` · ${suffix}` : ''}</AppText></View>;
}
