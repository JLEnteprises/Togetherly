import { useState } from 'react';
import { Alert, View } from 'react-native';
import { AppButton } from '@/components/common/AppButton';
import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { regenerateCoupleInvite } from '@/services/backend/workspace';
import { useAppTheme } from '@/theme/useAppTheme';

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

export function InvitePartnerCard() {
  const theme = useAppTheme();
  const { activeInvite, memberCount, refresh } = useWorkspace();
  const [busy, setBusy] = useState(false);

  if (memberCount >= 2) return null;

  async function regenerate() {
    setBusy(true);
    try {
      await regenerateCoupleInvite();
      await refresh();
    } catch (error) {
      Alert.alert('Couldn’t create a new invite', messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card tone="accent" style={{ gap: theme.spacing.md }}>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText variant="caption" tone="accent">INVITE YOUR PARTNER</AppText>
        <AppText variant="section">Your shared space is ready</AppText>
        <AppText variant="bodySmall" tone="secondary">Send this code to your partner. They create their own account, choose Join partner, and enter it.</AppText>
      </View>
      {activeInvite ? (
        <View style={{ alignItems: 'center', paddingVertical: theme.spacing.lg, borderRadius: theme.radii.lg, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }}>
          <AppText variant="caption" tone="muted">INVITE CODE</AppText>
          <AppText selectable variant="hero" tone="accent" style={{ letterSpacing: 4 }}>{activeInvite.invite_code}</AppText>
          <AppText variant="caption" tone="muted">Long-press the code to copy it</AppText>
        </View>
      ) : (
        <AppText variant="bodySmall" tone="secondary">There isn’t an active invite code right now.</AppText>
      )}
      <View style={{ alignSelf: 'flex-start' }}>
        <AppButton compact variant="secondary" label={busy ? 'Generating…' : 'Generate new code'} disabled={busy} onPress={regenerate} />
      </View>
    </Card>
  );
}
