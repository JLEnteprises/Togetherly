import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { AppIcon } from '@/components/art/AppIcon';
import { RevealScale } from '@/components/motion/Motion';
import { createRelationshipPing } from '@/services/backend/mvpFeatures';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Couldn’t send that right now.'; }

export function ConnectionPingsCard() {
  const theme = useAppTheme();
  const { partnerProfile } = useWorkspace();
  const [sending, setSending] = useState<'love' | 'thinking_of_you' | null>(null);
  const [sent, setSent] = useState<{ kind: 'love' | 'thinking_of_you'; at: number } | null>(null);

  async function send(kind: 'love' | 'thinking_of_you') {
    if (sending) return;
    setSending(kind);
    try {
      await createRelationshipPing(kind);
      setSent({ kind, at: Date.now() });
    } catch (error) { Alert.alert('Couldn’t send it', messageFrom(error)); }
    finally { setSending(null); }
  }

  const partner = partnerProfile?.display_name ?? 'your partner';
  return (
    <Card participantColor="both" tone="secondary" style={{ gap: theme.spacing.md, overflow: 'hidden' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentSoft, borderWidth: 1, borderColor: theme.colors.border }}>
          <AppIcon name="heart" size={23} color={theme.colors.accent} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" tone="accent">A LITTLE SIGNAL</AppText>
          <AppText variant="cardTitle">Reach out without needing words.</AppText>
          <AppText variant="bodySmall" tone="secondary">A tiny tap on {partner}’s phone or Watch to say you’re here.</AppText>
        </View>
      </View>
      {sent ? (
        <RevealScale trigger={sent.at}>
          <View style={{ paddingVertical: 10, paddingHorizontal: 13, borderRadius: theme.radii.md, backgroundColor: theme.colors.secondarySoft, flexDirection: 'row', alignItems: 'center', gap: 9 }}>
            <AppIcon name={sent.kind === 'love' ? 'heart' : 'spark'} size={18} color={sent.kind === 'love' ? theme.colors.accent : theme.colors.partnerAccent} />
            <AppText variant="bodySmall">{sent.kind === 'love' ? `Love sent to ${partner}.` : `${partner} knows they crossed your mind.`}</AppText>
          </View>
        </RevealScale>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><AppButton label={sending === 'love' ? 'Sending…' : 'Love tap'} icon="heart" disabled={Boolean(sending)} onPress={() => send('love')} /></View>
        <View style={{ flex: 1 }}><AppButton label={sending === 'thinking_of_you' ? 'Sending…' : 'Thinking of you'} icon="spark" variant="secondary" disabled={Boolean(sending)} onPress={() => send('thinking_of_you')} /></View>
      </View>
    </Card>
  );
}
