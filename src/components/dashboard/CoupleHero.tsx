import { View } from 'react-native';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { CoupleAvatar } from '@/components/common/Avatar';
import { AppIcon } from '@/components/art/AppIcon';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { participantPalettes, participantPalette } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';

function daysSince(value: string | null) {
  if (!value) return null;
  const start = new Date(`${value}T00:00:00`);
  const difference = Date.now() - start.getTime();
  return difference >= 0 ? Math.floor(difference / 86_400_000) : 0;
}

export function CoupleHero() {
  const theme = useAppTheme();
  const { profile, partnerProfile, couple, myColor, partnerColor } = useWorkspace();
  const partnerName = partnerProfile?.display_name ?? 'Waiting for partner';
  const togetherDays = daysSince(couple?.relationship_start_date ?? null);
  const status = !partnerProfile
    ? 'Invite your partner when you’re ready.'
    : couple?.long_distance_enabled
      ? `${togetherDays == null ? 'Add your relationship date' : `${togetherDays} days together`} · across the distance`
      : `${togetherDays == null ? 'Add your relationship date' : `${togetherDays} days together`} · sharing every day of life`;

  return (
    <Card participantColor="both" style={{ padding: theme.spacing.lg, gap: theme.spacing.md, overflow: 'hidden' }}>
      <View style={{ position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: participantPalette(myColor).glow, right: -50, top: -52 }} />
      <View style={{ position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: participantPalette(partnerColor).glow, left: -44, bottom: -48 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md }}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><AppIcon name="heart" size={14} color={theme.colors.accent} /><AppText variant="caption" tone="secondary" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>Our shared space</AppText></View>
          <AppText variant="section">
            <AppText variant="section" style={{ color: participantPalette(myColor).accent }}>{profile!.display_name}</AppText>
            <AppText variant="section"> + </AppText>
            <AppText variant="section" style={{ color: participantPalette(partnerColor).accent }}>{partnerName}</AppText>
          </AppText>
          <AppText variant="bodySmall" tone="secondary">{status}</AppText>
        </View>
        <CoupleAvatar />
      </View>
    </Card>
  );
}
