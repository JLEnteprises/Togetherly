import { View } from 'react-native';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { CoupleAvatar } from '@/components/common/Avatar';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { participantPalettes } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

function daysSince(value: string | null) {
  if (!value) return null;
  const start = new Date(`${value}T00:00:00`);
  const now = new Date();
  const difference = now.getTime() - start.getTime();
  return difference >= 0 ? Math.floor(difference / 86_400_000) : 0;
}

export function CoupleHero() {
  const theme = useAppTheme();
  const { profile, partnerProfile, couple, myColor, partnerColor } = useWorkspace();
  const partnerName = partnerProfile?.display_name ?? 'Waiting for partner';
  const togetherDays = daysSince(couple?.relationship_start_date ?? null);

  return (
    <Card participantColor="both" style={{ padding: theme.spacing.xl, gap: theme.spacing.lg, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: participantPalettes.purple.glow, right: -38, top: -48 }} />
      <View style={{ position: 'absolute', width: 110, height: 110, borderRadius: 55, backgroundColor: participantPalettes.green.glow, left: -42, bottom: -54 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md }}>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" tone="secondary" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>Our shared space</AppText>
          <AppText variant="pageTitle">
            <AppText variant="pageTitle" style={{ color: participantPalettes[myColor].accent }}>{profile!.display_name}</AppText>
            <AppText variant="pageTitle"> + </AppText>
            <AppText variant="pageTitle" style={{ color: participantPalettes[partnerColor].accent }}>{partnerName}</AppText>
          </AppText>
          <AppText variant="bodySmall" tone="secondary">
            {partnerProfile
              ? `${togetherDays === null ? 'Add your relationship date' : `${togetherDays} days together`} · ${couple?.long_distance_enabled ? 'Long distance' : 'Together'}`
              : 'Invite your partner when you’re ready to share this space.'}
          </AppText>
        </View>
        <CoupleAvatar />
      </View>
    </Card>
  );
}
