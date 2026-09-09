import { View } from 'react-native';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { participantPalettes, participantPalette } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import { AppText } from './AppText';

function initial(name: string) { return name.trim().slice(0, 1).toUpperCase() || '•'; }

export function ParticipantAttribution({ userId, verb = 'Added by', suffix }: { userId: string | null | undefined; verb?: string; suffix?: string }) {
  const theme = useAppTheme();
  const { profile, partnerProfile, colorForUser } = useWorkspace();
  const color = colorForUser(userId);
  const palette = color === 'both' ? null : participantPalette(color);
  const accent = palette?.accent ?? theme.colors.textMuted;
  const name = profile && userId === profile.id
    ? profile.display_name
    : partnerProfile && userId === partnerProfile.id
      ? partnerProfile.display_name
      : 'Previous member';
  const isMe = Boolean(profile && userId === profile.id);
  const isPartner = Boolean(partnerProfile && userId === partnerProfile.id);
  const role = isMe ? 'YOU' : isPartner ? 'PARTNER' : '';

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <View style={{
        width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: palette?.border ?? theme.colors.border,
        backgroundColor: palette?.tint ?? theme.colors.elevatedBackground,
      }}>
        <AppText variant="caption" style={{ color: accent, fontSize: 9, lineHeight: 11 }}>{initial(name)}</AppText>
      </View>
      <AppText variant="caption" style={{ color: accent }}>
        {verb} {name}{role ? ` · ${role}` : ''}{suffix ? ` · ${suffix}` : ''}
      </AppText>
    </View>
  );
}
