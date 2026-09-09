import { moodIsCurrent } from '@/utils/experience';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { PartnerPresencePill } from '@/components/common/PartnerPresencePill';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { TagChip } from '@/components/common/TagChip';
import { EmptyState } from '@/components/common/EmptyState';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { getAvailabilityOverlaps } from '@/services/backend/availability';
import { getLatestMoods, randomActivity, rejectActivity } from '@/services/backend/mvpFeatures';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import type { ActivityLocationType, ActivityMood, ActivityTime, CoupleActivity, MoodEntry } from '@/types/database';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }
function timeOfDayNow(date = new Date()): ActivityTime {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'day';
  return 'night';
}
function durationLabel(minutes: number | null) {
  if (!minutes) return 'Flexible time';
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`;
}
function moodNeedsSoftPlan(entry: MoodEntry | null) {
  return Boolean(moodIsCurrent(entry) && entry && ['low', 'frustrated', 'overwhelmed', 'tired', 'stressed'].includes(entry.mood));
}
function moodNeedsDistraction(entry: MoodEntry | null) { return moodIsCurrent(entry) && entry?.need === 'distraction'; }

type ContextPlan = {
  locationType?: ActivityLocationType;
  mood?: ActivityMood;
  timeOfDay: ActivityTime;
  maxMinutes?: number;
  reasons: string[];
};

export default function ActivityNowScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ context?: string }>();
  const { couple, partnerProfile, colorForUser } = useWorkspace();
  const [pick, setPick] = useState<CoupleActivity | null>(null);
  const [plan, setPlan] = useState<ContextPlan | null>(null);
  const [busy, setBusy] = useState(true);
  const [hasTried, setHasTried] = useState(false);

  const buildContext = useCallback(async (): Promise<ContextPlan> => {
    const [moodsResult, overlapResult] = await Promise.allSettled([
      getLatestMoods(),
      getAvailabilityOverlaps(1, 15),
    ]);
    const moods = moodsResult.status === 'fulfilled' ? moodsResult.value : { mine: null, partner: null };
    const overlaps = overlapResult.status === 'fulfilled' ? overlapResult.value.overlaps : [];
    const now = Date.now();
    const nearOverlap = overlaps.find((item) => {
      const start = new Date(item.startAt).getTime();
      const end = new Date(item.endAt).getTime();
      return end >= now && start <= now + 45 * 60_000;
    }) ?? null;

    const reasons: string[] = [];
    const locationType: ActivityLocationType | undefined = couple?.long_distance_enabled ? 'online' : undefined;
    if (locationType === 'online') reasons.push('You’re set up as long-distance, so this stays online-friendly.');

    let mood: ActivityMood | undefined;
    if (moodNeedsDistraction(moods.mine) || moodNeedsDistraction(moods.partner)) {
      mood = 'silly';
      reasons.push(`${moodNeedsDistraction(moods.partner) ? partnerProfile?.display_name ?? 'Your partner' : 'One of you'} asked for a distraction, so Togetherly is keeping it light.`);
    } else if (moodNeedsSoftPlan(moods.mine) || moodNeedsSoftPlan(moods.partner)) {
      mood = 'relaxing';
      reasons.push('A recent check-in suggests something low-pressure will fit better right now.');
    }

    const timeOfDay = timeOfDayNow();
    reasons.push(`It’s ${timeOfDay === 'night' ? 'evening' : timeOfDay} where you are, so the pick matches the moment.`);

    const maxMinutes = nearOverlap ? Math.max(15, Math.min(360, Math.floor((Date.parse(nearOverlap.endAt) - Math.max(now, Date.parse(nearOverlap.startAt))) / 60000))) : undefined;
    if (maxMinutes) reasons.push(`Your shared free-time window gives you about ${durationLabel(maxMinutes)} to work with.`);

    return { locationType, mood, timeOfDay, maxMinutes, reasons };
  }, [couple?.long_distance_enabled, partnerProfile?.display_name]);

  const choose = useCallback(async () => {
    if (busy && hasTried) return;
    setBusy(true);
    setHasTried(true);
    try {
      const nextPlan = await buildContext();
      setPlan(nextPlan);
      const contextualFilters = {
        locationType: nextPlan.locationType,
        mood: nextPlan.mood,
        timeOfDay: nextPlan.timeOfDay,
        maxMinutes: nextPlan.maxMinutes,
      };
      let nextPick = await randomActivity(contextualFilters);
      if (!nextPick && nextPlan.mood) {
        nextPick = await randomActivity({ locationType: nextPlan.locationType, timeOfDay: nextPlan.timeOfDay, maxMinutes: nextPlan.maxMinutes });
        if (nextPick) setPlan({ ...nextPlan, reasons: [...nextPlan.reasons.filter((reason) => !reason.includes('check-in') && !reason.includes('distraction')), 'No saved idea matched the mood preference. This alternative still fits the time and location filters.'] });
      }
      setPick(nextPick);
    } catch (error) {
      Alert.alert('Couldn’t choose something for right now', messageFrom(error));
    } finally {
      setBusy(false);
    }
  }, [buildContext, busy, hasTried]);

  useEffect(() => { choose().catch(() => undefined); }, []);

  async function notNow() {
    if (!pick || busy) return;
    setBusy(true);
    try {
      await rejectActivity(pick.id);
      setBusy(false);
      await choose();
    } catch (error) {
      setBusy(false);
      Alert.alert('Couldn’t pick another idea', messageFrom(error));
    }
  }

  function planPick() {
    if (!pick) return;
    const query = new URLSearchParams({ title: pick.title, activityId: pick.id });
    router.push(`/features/date-plans?${query.toString()}` as never);
  }

  const intro = useMemo(() => {
    if (params.context === 'distraction') return 'You asked for a distraction. Togetherly is using what it already knows to keep this easy.';
    if (params.context === 'question') return 'Keep the connection going without turning it into another planning session.';
    return 'Togetherly uses your current time, shared availability, distance setup and recent check-ins so you do less filtering.';
  }, [params.context]);

  return (
    <AppScreen>
      <BackHeader eyebrow="Connect" title="What fits right now?" subtitle="One suggestion based on the moment you’re already in." />
      <PartnerPresencePill scope="activity-now" />

      <Card participantColor="both" tone="secondary" style={{ gap: theme.spacing.md, marginBottom: theme.spacing.xl }}>
        <AppText variant="bodySmall" tone="secondary">{intro}</AppText>
        {plan?.reasons.map((reason) => <View key={reason} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}><AppText tone="accent">•</AppText><AppText variant="bodySmall" tone="secondary" style={{ flex: 1 }}>{reason}</AppText></View>)}
      </Card>

      {busy ? <Card tone="accent" participantColor="both" style={{ gap: theme.spacing.md, padding: theme.spacing.xxl, alignItems: 'center' }}><AppText variant="pageTitle" align="center">Reading the moment…</AppText><AppText tone="secondary" align="center">Checking what fits instead of making you fill in another form.</AppText></Card> : null}

      {!busy && !pick && hasTried ? <EmptyState icon="spark" title="Nothing fits cleanly yet" body="Your saved ideas don’t match the current context closely enough." actionLabel="Tune the filters myself" onAction={() => router.push('/features/activity-randomizer' as never)} /> : null}

      {!busy && pick ? <Card tone="accent" participantColor={colorForUser(pick.creator_id)} style={{ gap: theme.spacing.lg, padding: theme.spacing.xl }}>
        <View style={{ gap: 4 }}><AppText variant="caption" tone="accent">THIS FITS RIGHT NOW</AppText><AppText variant="hero">{pick.title}</AppText></View>
        <ParticipantAttribution userId={pick.creator_id} />
        {pick.description ? <AppText tone="secondary">{pick.description}</AppText> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <TagChip label={pick.cost_level.toUpperCase()} />
          <TagChip label={pick.location_type.toUpperCase()} />
          <TagChip subtle label={durationLabel(pick.duration_minutes).toUpperCase()} />
          {pick.mood !== 'any' ? <TagChip subtle label={pick.mood.toUpperCase()} /> : null}
        </View>
        <AppButton icon="heart" label="Suggest this to my partner" onPress={planPick} />
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}><AppButton variant="secondary" label="Another one" disabled={busy} onPress={() => void notNow()} /></View>
          <View style={{ flex: 1 }}><AppButton variant="ghost" label="Tune filters" onPress={() => router.push('/features/activity-randomizer' as never)} /></View>
        </View>
      </Card> : null}
    </AppScreen>
  );
}
