import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/common/AppButton';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { EyebrowText } from '@/components/common/EyebrowText';
import { AppIcon, type AppIconName } from '@/components/art/AppIcon';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import { useInteractionFeedback } from '@/hooks/useInteractionFeedback';
import { dismissFirstTimeGuide, shouldShowFirstTimeGuide } from '@/services/firstTimeGuide';

type GuideStep = {
  icon: AppIconName;
  title: string;
  body: string;
  href?: string;
};

const linkedSteps: readonly GuideStep[] = [
  { icon: 'question', title: 'Check in together', body: 'Answer today’s question separately, then open it together.', href: '/features/daily-question' },
  { icon: 'task', title: 'Plan one real thing', body: 'Add one task so Plan immediately has something useful in it.', href: '/features/tasks' },
  { icon: 'memory', title: 'Save one moment', body: 'Add a photo, funny moment or ordinary memory to start your story.', href: '/features/memories' },
];

const waitingSteps: readonly GuideStep[] = [
  { icon: 'together', title: 'Connect is for connection', body: 'Questions, moods, location and playful things you do with each other.' },
  { icon: 'plan', title: 'Plan is practical life', body: 'Tasks, calendars, trips, goals and the things you are coordinating.' },
  { icon: 'us', title: 'Our story keeps your moments', body: 'Memories, photos and milestones build up here over time.' },
];

// F1_FIRST_TIME_USER_GUIDANCE: this guide appears only after onboarding explicitly queues it for this profile.
export function FirstTimeGuideCard() {
  const theme = useAppTheme();
  const feedback = useInteractionFeedback();
  const { profile, partnerProfile } = useWorkspace();
  const [visible, setVisible] = useState(false);
  const userId = profile?.id;

  useEffect(() => {
    let active = true;
    setVisible(false);
    if (!userId) return () => { active = false; };
    shouldShowFirstTimeGuide(userId)
      .then((show) => { if (active) setVisible(show); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [userId]);

  if (!visible || !userId) return null;

  const linked = Boolean(partnerProfile);
  const steps = linked ? linkedSteps : waitingSteps;

  function openStep(href: string) {
    feedback();
    router.push(href as never);
  }

  async function dismiss() {
    setVisible(false);
    await dismissFirstTimeGuide(userId).catch(() => undefined);
  }

  return (
    <Card participantColor={linked ? 'both' : undefined} tone="secondary" style={{ gap: theme.spacing.md, overflow: 'hidden' }}>
      <View style={{ gap: 4 }}>
        <EyebrowText>New here</EyebrowText>
        <AppText variant="section">{linked ? 'A good first five minutes' : 'Your next step is the invite'}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {linked
            ? 'You do not need to set everything up. Three small things are enough to make Togetherly start feeling like yours.'
            : 'Send the invite card above. While you wait, this is the simple map of where things live.'}
        </AppText>
      </View>

      <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.border }}>
        {steps.map((step, index) => {
          const content = (
            <>
              <View style={{ width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentSoft }}>
                <AppIcon name={step.icon} size={19} color={theme.colors.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="cardTitle">{step.title}</AppText>
                <AppText variant="caption" tone="muted">{step.body}</AppText>
              </View>
              {step.href ? <AppIcon name="chevron" size={16} color={theme.colors.textMuted} /> : null}
            </>
          );
          const rowStyle = {
            minHeight: 68,
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            gap: theme.spacing.md,
            paddingVertical: 10,
            borderTopWidth: index === 0 ? 0 : 1,
            borderTopColor: theme.colors.border,
          };

          return step.href ? (
            <Pressable
              key={step.title}
              accessibilityRole="button"
              accessibilityLabel={`${step.title}. ${step.body}`}
              onPress={() => openStep(step.href!)}
              style={({ pressed }) => [rowStyle, { opacity: pressed ? 0.72 : 1, backgroundColor: pressed ? theme.colors.elevatedBackground : 'transparent', borderRadius: pressed ? theme.radii.sm : 0 }]}
            >
              {content}
            </Pressable>
          ) : <View key={step.title} style={rowStyle}>{content}</View>;
        })}
      </View>

      <AppButton compact variant="ghost" label="Got it" onPress={() => dismiss().catch(() => undefined)} />
    </Card>
  );
}
