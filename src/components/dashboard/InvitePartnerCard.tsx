import { useState } from 'react';
import { Alert, Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { AppButton } from '@/components/common/AppButton';
import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { AppIcon } from '@/components/art/AppIcon';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { regenerateCoupleInvite } from '@/services/backend/workspace';
import { useAppTheme } from '@/theme/useAppTheme';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }

export function InvitePartnerCard() {
  const theme = useAppTheme();
  const { activeInvite, memberCount, refresh } = useWorkspace();
  const [busy, setBusy] = useState(false);
  if (memberCount >= 2) return null;

  async function regenerate() {
    setBusy(true);
    try { await regenerateCoupleInvite(); await refresh(); }
    catch (error) { Alert.alert('Couldn’t create a new invite', messageFrom(error)); }
    finally { setBusy(false); }
  }
  async function copyInvite() {
    if (!activeInvite) return;
    try {
      await Clipboard.setStringAsync(activeInvite.invite_code);
      Alert.alert('Invite copied', 'The Togetherly invite code is ready to paste.');
    } catch (error) { Alert.alert('Couldn’t copy invite', messageFrom(error)); }
  }
  async function shareInvite() {
    if (!activeInvite) return;
    try { await Share.share({ message: `Join our Togetherly space ❤️\nInvite code: ${activeInvite.invite_code}` }); }
    catch (error) { Alert.alert('Couldn’t share invite', messageFrom(error)); }
  }

  return (
    <Card tone="accent" style={{ gap: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' }}>
        <View style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: theme.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}><AppIcon name="together" size={21} color={theme.colors.accent} /></View>
        <View style={{ flex: 1, gap: 4 }}><AppText variant="caption" tone="accent">INVITE YOUR PARTNER</AppText><AppText variant="section">Your shared space is ready</AppText><AppText variant="bodySmall" tone="secondary">Send one invite. They keep their own account and join the same private space.</AppText></View>
      </View>
      {activeInvite ? <View style={{ alignItems: 'center', paddingVertical: theme.spacing.lg, borderRadius: theme.radii.lg, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }}><AppText variant="caption" tone="muted">INVITE CODE</AppText><AppText selectable variant="hero" tone="accent" style={{ letterSpacing: 4 }}>{activeInvite.invite_code}</AppText><AppText variant="caption" tone="muted">One code · one shared space</AppText></View> : <AppText variant="bodySmall" tone="secondary">There isn’t an active invite code right now.</AppText>}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
        {activeInvite ? <><View style={{ flex: 1, minWidth: 120 }}><AppButton compact icon="copy" variant="secondary" label="Copy code" onPress={copyInvite} /></View><View style={{ flex: 1, minWidth: 130 }}><AppButton compact icon="share" label="Share invite" onPress={shareInvite} /></View></> : null}
        <View style={{ flex: 1, minWidth: 140 }}><AppButton compact variant="secondary" label={busy ? 'Generating…' : 'New code'} disabled={busy} onPress={regenerate} /></View>
      </View>
    </Card>
  );
}
