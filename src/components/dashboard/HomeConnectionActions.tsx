import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AppIcon, type AppIconName } from '@/components/art/AppIcon';
import { AppText } from '@/components/common/AppText';
import { ParticipantIdentityBadge } from '@/components/common/ParticipantIdentityBadge';
import { useInteractionFeedback } from '@/hooks/useInteractionFeedback';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { createRelationshipPing } from '@/services/backend/mvpFeatures';
import { useAppTheme } from '@/theme/useAppTheme';
import { participantPalette } from '@/theme/tokens';

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function QuickAction({
  icon,
  label,
  detail,
  onPress,
  disabled,
  participantColor,
}: {
  icon: AppIconName;
  label: string;
  detail: string;
  onPress: () => void;
  disabled?: boolean;
  participantColor?: string;
}) {
  const theme = useAppTheme();
  const identity = participantColor ? participantPalette(participantColor) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${detail}`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: '30%',
        minHeight: 66,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: identity?.border ?? theme.colors.border,
        backgroundColor: pressed ? theme.colors.cardElevated : theme.colors.elevatedBackground,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: 10,
        gap: 7,
        opacity: disabled ? 0.5 : pressed ? 0.74 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <AppIcon name={icon} size={18} color={identity?.accent ?? theme.colors.textSecondary} />
        {identity ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: identity.accent }} /> : null}
      </View>
      <View style={{ gap: 1 }}>
        <AppText variant="bodySmall" style={{ fontWeight: '700' }} numberOfLines={1}>{label}</AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>{detail}</AppText>
      </View>
    </Pressable>
  );
}

type HomeConnectionActionsProps = {
  context?: 'home' | 'together';
};

// G2_HOME_DECLUTTER: Home keeps only tiny immediate relationship signals; mood check-in is owned by Together.
// G3_TOGETHER_CONSOLIDATION: Together adds the single canonical mood entry without duplicating the Mood CTA in adjacent groups.
export function HomeConnectionActions({ context = 'home' }: HomeConnectionActionsProps) {
  const theme = useAppTheme();
  const feedback = useInteractionFeedback();
  const { profile, partnerProfile, partnerColor } = useWorkspace();
  const [pingBusy, setPingBusy] = useState<'love' | 'thinking_of_you' | null>(null);
  const [recentSignal, setRecentSignal] = useState<'love' | 'thinking_of_you' | null>(null);

  if (!profile || !partnerProfile) return null;

  async function sendPing(kind: 'love' | 'thinking_of_you') {
    if (pingBusy) return;
    feedback();
    setPingBusy(kind);
    try {
      await createRelationshipPing(kind);
      setRecentSignal(kind);
      setTimeout(() => setRecentSignal((current) => current === kind ? null : current), 2400);
    } catch (error) {
      Alert.alert('Couldn’t send it', messageFrom(error));
    } finally {
      setPingBusy(null);
    }
  }

  const partnerName = partnerProfile.display_name;
  const together = context === 'together';

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md }}>
        <View style={{ gap: 2 }}>
          <AppText variant="section">Between you</AppText>
          <AppText variant="bodySmall" tone="muted">
            {together ? `Tiny ways to reach ${partnerName} or check in right now.` : 'A quick little signal, without turning Home into another menu.'}
          </AppText>
        </View>
        <ParticipantIdentityBadge userId={partnerProfile.id} compact />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        <QuickAction
          icon="heart"
          label={recentSignal === 'love' ? 'Love sent ♥' : pingBusy === 'love' ? 'Sending…' : 'Love Tap'}
          detail={`To ${partnerName}`}
          participantColor={partnerColor}
          disabled={Boolean(pingBusy)}
          onPress={() => void sendPing('love')}
        />
        <QuickAction
          icon="spark"
          label={recentSignal === 'thinking_of_you' ? 'Sent ✦' : pingBusy === 'thinking_of_you' ? 'Sending…' : 'Thinking of you'}
          detail={`To ${partnerName}`}
          participantColor={partnerColor}
          disabled={Boolean(pingBusy)}
          onPress={() => void sendPing('thinking_of_you')}
        />
        {together ? (
          <QuickAction
            icon="mood"
            label="How I’m feeling"
            detail="Open your check-in"
            participantColor={profile.preferred_participant_color ?? undefined}
            onPress={() => {
              feedback();
              router.push('/features/mood' as never);
            }}
          />
        ) : null}
      </View>
    </View>
  );
}
