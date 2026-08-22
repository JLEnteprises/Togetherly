import { View } from 'react-native';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import { participantPalettes } from '@/theme/tokens';

function formatTime(timezone: string | undefined) { try { return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: timezone || 'UTC' }).format(new Date()); } catch { return '—'; } }
function timezoneLabel(timezone: string | undefined) { if (!timezone) return 'Not set'; return timezone.replace(/_/g, ' ').split('/').pop() ?? timezone; }

export function TimezoneCard() {
  const theme = useAppTheme(); const { profile, partnerProfile, myColor, partnerColor } = useWorkspace();
  return <Card participantColor="both"><AppText variant="cardTitle">Our time</AppText><View style={{ flexDirection: 'row', marginTop: theme.spacing.md }}>
    <View style={{ flex: 1, borderRightWidth: 1, borderColor: theme.colors.border }}><AppText variant="caption" style={{ color: participantPalettes[myColor].accent }}>{profile!.display_name.toUpperCase()} · {timezoneLabel(profile?.timezone)}</AppText><AppText variant="section" style={{ color: participantPalettes[myColor].accent }}>{formatTime(profile?.timezone)}</AppText></View>
    <View style={{ flex: 1, paddingLeft: theme.spacing.lg }}><AppText variant="caption" style={{ color: participantPalettes[partnerColor].accent }}>{partnerProfile ? `${partnerProfile.display_name.toUpperCase()} · ${timezoneLabel(partnerProfile.timezone)}` : 'WAITING FOR PARTNER'}</AppText><AppText variant="section" style={{ color: participantPalettes[partnerColor].accent }}>{partnerProfile ? formatTime(partnerProfile.timezone) : '—'}</AppText></View>
  </View></Card>;
}
