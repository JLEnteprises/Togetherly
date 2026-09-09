import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, View } from 'react-native';
import { AppIcon, type AppIconName } from '@/components/art/AppIcon';
import { AppButton } from '@/components/common/AppButton';
import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { ChoiceChips } from '@/components/common/ChoiceChips';
import { ParticipantIdentityBadge } from '@/components/common/ParticipantIdentityBadge';
import { useInteractionFeedback } from '@/hooks/useInteractionFeedback';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { createMood, createRelationshipPing } from '@/services/backend/mvpFeatures';
import { useAppTheme } from '@/theme/useAppTheme';
import { participantPalette } from '@/theme/tokens';
import type { MoodValue, NeedValue } from '@/types/database';

const moodOptions: readonly { value: MoodValue; label: string }[] = [
  { value: 'amazing', label: '😄 Amazing' },
  { value: 'good', label: '🙂 Good' },
  { value: 'okay', label: '😐 Okay' },
  { value: 'low', label: '😔 Low' },
  { value: 'frustrated', label: '😡 Frustrated' },
  { value: 'overwhelmed', label: '😫 Overwhelmed' },
  { value: 'tired', label: '😴 Tired' },
  { value: 'stressed', label: '😰 Stressed' },
];

const needOptions: readonly { value: NeedValue; label: string }[] = [
  { value: 'affection', label: 'Affection' },
  { value: 'reassurance', label: 'Reassurance' },
  { value: 'advice', label: 'Advice' },
  { value: 'listen', label: 'Listen' },
  { value: 'distraction', label: 'Distraction' },
  { value: 'space', label: 'Space' },
  { value: 'call', label: 'Call me' },
  { value: 'nothing', label: 'Nothing' },
];

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
        minHeight: 76,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: identity?.border ?? theme.colors.border,
        backgroundColor: pressed ? theme.colors.cardElevated : theme.colors.elevatedBackground,
        padding: theme.spacing.md,
        gap: 6,
        justifyContent: 'space-between',
        opacity: disabled ? 0.5 : pressed ? 0.74 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <AppIcon name={icon} size={18} color={identity?.accent ?? theme.colors.textSecondary} />
        {identity ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: identity.accent }} /> : null}
      </View>
      <View style={{ gap: 1 }}>
        <AppText variant="bodySmall" style={{ fontWeight: '700' }}>{label}</AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1}>{detail}</AppText>
      </View>
    </Pressable>
  );
}

export function HomeConnectionActions() {
  const theme = useAppTheme();
  const feedback = useInteractionFeedback();
  const { profile, partnerProfile, partnerColor } = useWorkspace();
  const [moodOpen, setMoodOpen] = useState(false);
  const [mood, setMood] = useState<MoodValue | null>(null);
  const [need, setNeed] = useState<NeedValue | null>(null);
  const [visibility, setVisibility] = useState<'shared' | 'private'>('shared');
  const [pingBusy, setPingBusy] = useState<'love' | 'thinking_of_you' | null>(null);
  const [recentSignal, setRecentSignal] = useState<'love' | 'thinking_of_you' | 'mood' | null>(null);
  const [moodBusy, setMoodBusy] = useState(false);

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

  async function saveMood() {
    if (!mood || !need || moodBusy) return;
    feedback();
    setMoodBusy(true);
    try {
      await createMood({ mood, need, visibility });
      setRecentSignal('mood');
      setMood(null);
      setNeed(null);
      setVisibility('shared');
      setMoodOpen(false);
      setTimeout(() => setRecentSignal((current) => current === 'mood' ? null : current), 2400);
    } catch (error) {
      Alert.alert('Couldn’t share check-in', messageFrom(error));
    } finally {
      setMoodBusy(false);
    }
  }

  const partnerName = partnerProfile.display_name;

  return (
    <>
      <View style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md }}>
          <View style={{ gap: 2 }}>
            <AppText variant="section">Between you</AppText>
            <AppText variant="bodySmall" tone="muted">Tiny ways to reach {partnerName} right now.</AppText>
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
          <QuickAction
            icon="mood"
            label={recentSignal === 'mood' ? 'Shared ✓' : 'How I’m feeling'}
            detail={`Share with ${partnerName}`}
            participantColor={profile.preferred_participant_color ?? undefined}
            onPress={() => { feedback(); setMoodOpen(true); }}
          />
        </View>
      </View>

      <Modal
        visible={moodOpen}
        transparent
        animationType={theme.reducedMotion ? 'none' : 'slide'}
        onRequestClose={() => setMoodOpen(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close quick check-in"
            onPress={() => setMoodOpen(false)}
            style={{ flex: 1 }}
          />
          <View
            style={{
              maxHeight: '86%',
              borderTopLeftRadius: theme.radii.xl,
              borderTopRightRadius: theme.radii.xl,
              borderWidth: 1,
              borderBottomWidth: 0,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.background,
              paddingTop: theme.spacing.sm,
              paddingBottom: theme.spacing.xxl,
            }}
          >
            <View style={{ width: 42, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: theme.colors.border, marginBottom: theme.spacing.sm }} />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.lg, gap: theme.spacing.lg }}
            >
              <View style={{ gap: 6 }}>
                <ParticipantIdentityBadge userId={profile.id} compact />
                <AppText variant="pageTitle">How are you?</AppText>
                <AppText variant="bodySmall" tone="secondary">Share just enough to help {partnerName} know where you’re at. You can always add more on the full check-in screen.</AppText>
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <AppText variant="cardTitle">I’m feeling…</AppText>
                <ChoiceChips value={mood} onChange={setMood} options={moodOptions} />
              </View>

              <View style={{ gap: theme.spacing.sm }}>
                <AppText variant="cardTitle">What would help?</AppText>
                <ChoiceChips value={need} onChange={setNeed} options={needOptions} />
              </View>

              <Card tone="secondary" style={{ gap: theme.spacing.sm }}>
                <AppText variant="bodySmall" tone="secondary">Who can see this?</AppText>
                <ChoiceChips
                  value={visibility}
                  onChange={setVisibility}
                  options={[
                    { value: 'shared' as const, label: `Share with ${partnerName}` },
                    { value: 'private' as const, label: 'Private to me' },
                  ]}
                />
              </Card>

              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <AppButton
                    label={moodBusy ? 'Sharing…' : visibility === 'shared' ? 'Share check-in' : 'Save privately'}
                    disabled={moodBusy || !mood || !need}
                    onPress={() => void saveMood()}
                  />
                </View>
                <AppButton compact variant="secondary" label="Cancel" onPress={() => setMoodOpen(false)} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}
