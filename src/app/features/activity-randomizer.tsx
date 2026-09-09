import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, View } from 'react-native';
import { router } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { PartnerPresencePill } from '@/components/common/PartnerPresencePill';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { ChoiceChips } from '@/components/common/ChoiceChips';
import { TagChip } from '@/components/common/TagChip';
import { TagSelector } from '@/components/common/TagSelector';
import { ToggleRow } from '@/components/common/ToggleRow';
import { EmptyState } from '@/components/common/EmptyState';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { AppIcon } from '@/components/art/AppIcon';
import { ConnectionOrbitArt } from '@/components/art/TogetherlyArt';
import { GentleFloat, RevealScale } from '@/components/motion/Motion';
import { getTags, randomActivity, rejectActivity, setActivityFavourite } from '@/services/backend/mvpFeatures';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import type { ActivityCost, ActivityEnvironment, ActivityLocationType, ActivityMood, ActivityTime, CoupleActivity, Tag } from '@/types/database';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }
function durationLabel(minutes: number | null) {
  if (!minutes) return 'Flexible time';
  if (minutes < 60) return `${minutes} minutes`;
  return `~${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)} hours`;
}
function pause(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export default function ActivityRandomizerScreen() {
  const theme = useAppTheme();
  const { colorForUser } = useWorkspace();
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [cost, setCost] = useState<ActivityCost | 'any'>('any');
  const [locationType, setLocationType] = useState<ActivityLocationType | 'any'>('any');
  const [environment, setEnvironment] = useState<ActivityEnvironment | 'any'>('any');
  const [mood, setMood] = useState<ActivityMood>('any');
  const [timeOfDay, setTimeOfDay] = useState<ActivityTime>('any');
  const [time, setTime] = useState<'any' | '30' | '60' | '180' | '360' | '1440'>('any');
  const [kidFriendly, setKidFriendly] = useState(false);
  const [pick, setPick] = useState<CoupleActivity | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasTried, setHasTried] = useState(false);
  const [revealKey, setRevealKey] = useState(0);

  const ritualSpin = useRef(new Animated.Value(0)).current;
  const ritualPulse = useRef(new Animated.Value(0)).current;

  const loadTags = useCallback(async () => {
    try { setTags(await getTags()); } catch { setTags([]); }
  }, []);

  useEffect(() => { loadTags().catch(() => undefined); }, [loadTags]);

  useEffect(() => {
    if (!busy || theme.reducedMotion) {
      ritualSpin.stopAnimation();
      ritualPulse.stopAnimation();
      ritualSpin.setValue(0);
      ritualPulse.setValue(0);
      return;
    }

    const spin = Animated.loop(Animated.timing(ritualSpin, {
      toValue: 1,
      duration: 1300,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(ritualPulse, {
        toValue: 1,
        duration: 460,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
      Animated.timing(ritualPulse, {
        toValue: 0,
        duration: 460,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      }),
    ]));

    spin.start();
    pulse.start();

    return () => {
      spin.stop();
      pulse.stop();
    };
  }, [busy, ritualPulse, ritualSpin, theme.reducedMotion]);

  async function roll() {
    if (busy) return;
    setBusy(true);
    setHasTried(true);
    setPick(null);

    try {
      const request = randomActivity({
        cost: cost === 'any' ? undefined : cost,
        locationType: locationType === 'any' ? undefined : locationType,
        environment: environment === 'any' ? undefined : environment,
        mood: mood === 'any' ? undefined : mood,
        timeOfDay: timeOfDay === 'any' ? undefined : timeOfDay,
        maxMinutes: time === 'any' ? undefined : Number(time),
        kidFriendly: kidFriendly ? true : undefined,
        tagIds: tagIds.length ? tagIds : undefined,
      });

      const [nextPick] = await Promise.all([
        request,
        theme.reducedMotion ? Promise.resolve() : pause(900),
      ]);

      setPick(nextPick);
      setRevealKey((value) => value + 1);
    } catch (error) {
      Alert.alert('Couldn’t pick an activity', messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  async function notTonight() {
    if (!pick || busy) return;
    setBusy(true);
    try {
      await rejectActivity(pick.id);
    } catch (error) {
      Alert.alert('Could not reroll', messageFrom(error));
      setBusy(false);
      return;
    }
    setBusy(false);
    await roll();
  }

  function planPick() {
    if (!pick) return;
    const query = new URLSearchParams({
      prefillTitle: pick.title,
      prefillDescription: pick.description || '',
      prefillDuration: String(pick.duration_minutes ?? 120),
      sourceActivityId: pick.id,
    });
    router.push(`/features/calendar?${query.toString()}` as never);
  }

  async function toggleFavourite() {
    if (!pick) return;
    try {
      const updated = await setActivityFavourite(pick.id, !pick.is_favourite);
      setPick({ ...pick, ...updated });
    } catch (error) {
      Alert.alert('Couldn’t update favourite', messageFrom(error));
    }
  }

  const ritualRotate = ritualSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  const ritualScale = ritualPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.96, 1.05],
  });

  return (
    <AppScreen>
      <BackHeader
        eyebrow="Connect"
        title="Pick something for us"
        subtitle="Set the vibe, then let Togetherly choose."
      />
      <PartnerPresencePill scope="activity-randomizer" />

      <Card style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.xxl }}>
        <View style={{ gap: 4 }}>
          <AppText variant="section">What kind of moment are we after?</AppText>
          <AppText variant="bodySmall" tone="secondary">Keep it loose or narrow it down. These are only filters, not homework.</AppText>
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" tone="secondary">BUDGET</AppText>
          <ChoiceChips value={cost} onChange={setCost} options={[
            { value: 'any', label: 'Any' },
            { value: 'free', label: 'Free' },
            { value: 'cheap', label: 'Cheap' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'expensive', label: 'Expensive' },
          ]} />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" tone="secondary">LOCATION</AppText>
          <ChoiceChips value={locationType} onChange={setLocationType} options={[
            { value: 'any', label: 'Any' },
            { value: 'home', label: 'Home' },
            { value: 'nearby', label: 'Nearby' },
            { value: 'online', label: 'Online' },
            { value: 'anywhere', label: 'Anywhere' },
          ]} />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" tone="secondary">ENVIRONMENT</AppText>
          <ChoiceChips value={environment} onChange={setEnvironment} options={[
            { value: 'any', label: 'Either' },
            { value: 'indoor', label: 'Indoor' },
            { value: 'outdoor', label: 'Outdoor' },
          ]} />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" tone="secondary">MOOD</AppText>
          <ChoiceChips value={mood} onChange={setMood} options={[
            { value: 'any', label: 'Any' },
            { value: 'romantic', label: 'Romantic' },
            { value: 'relaxing', label: 'Relaxing' },
            { value: 'adventurous', label: 'Adventure' },
            { value: 'active', label: 'Active' },
            { value: 'lazy', label: 'Lazy' },
            { value: 'silly', label: 'Silly' },
          ]} />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" tone="secondary">TIME OF DAY</AppText>
          <ChoiceChips value={timeOfDay} onChange={setTimeOfDay} options={[
            { value: 'any', label: 'Any' },
            { value: 'morning', label: 'Morning' },
            { value: 'day', label: 'Day' },
            { value: 'night', label: 'Night' },
          ]} />
        </View>

        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="caption" tone="secondary">DURATION</AppText>
          <ChoiceChips value={time} onChange={setTime} options={[
            { value: 'any', label: 'Any' },
            { value: '30', label: '≤30m' },
            { value: '60', label: '≤1h' },
            { value: '180', label: '≤3h' },
            { value: '360', label: 'Half day' },
            { value: '1440', label: 'Full day' },
          ]} />
        </View>

        <ToggleRow label="Must be kid friendly" value={kidFriendly} onChange={setKidFriendly} />
        <TagSelector tags={tags} selectedIds={tagIds} onChange={setTagIds} label="MUST INCLUDE TAGS" />

        <AppButton
          icon="spark"
          label={busy ? 'Mixing our ideas…' : pick ? 'Pick another one' : 'Pick one for us'}
          disabled={busy}
          onPress={roll}
        />
      </Card>

      {busy ? (
        <Card
          tone="accent"
          participantColor="both"
          style={{
            minHeight: 260,
            gap: theme.spacing.lg,
            marginBottom: theme.spacing.xl,
            padding: theme.spacing.xl,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <View style={{ position: 'absolute', right: -22, top: 18, opacity: 0.42 }}>
            <GentleFloat distance={3}>
              <ConnectionOrbitArt width={180} height={100} />
            </GentleFloat>
          </View>

          <Animated.View style={{ transform: [{ rotate: ritualRotate }, { scale: ritualScale }] }}>
            <View
              style={{
                width: 78,
                height: 78,
                borderRadius: 28,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.accentSoft,
                borderWidth: 1,
                borderColor: theme.colors.accent,
              }}
            >
              <AppIcon name="spark" size={36} color={theme.colors.accentStrong} />
            </View>
          </Animated.View>

          <View style={{ gap: 5, alignItems: 'center', maxWidth: 290 }}>
            <AppText variant="pageTitle" align="center">Mixing your little list…</AppText>
            <AppText tone="secondary" align="center">One of the things you saved is about to become the plan.</AppText>
          </View>

          <View style={{ flexDirection: 'row', gap: 7, alignItems: 'center' }}>
            <AppIcon name="heart" size={15} color={theme.colors.accent} />
            <AppText variant="caption" tone="accent">NO OVERTHINKING ALLOWED</AppText>
          </View>
        </Card>
      ) : null}

      {hasTried && !busy && !pick ? (
        <EmptyState
          icon="spark"
          title="Nothing matches"
          body="Those filters boxed the list in a little too tightly. Loosen one and try again."
        />
      ) : null}

      {!busy && pick ? (
        <RevealScale trigger={revealKey}>
          <Card
            tone="accent"
            participantColor={colorForUser(pick.creator_id)}
            style={{ gap: theme.spacing.lg, padding: theme.spacing.xl, overflow: 'hidden' }}
          >
            <View style={{ position: 'absolute', right: -18, top: -20, opacity: 0.36 }}>
              <GentleFloat distance={2}>
                <ConnectionOrbitArt width={150} height={84} />
              </GentleFloat>
            </View>

            <View style={{ gap: 5 }}>
              <AppText variant="caption" tone="accent">OKAY, THIS ONE ♥</AppText>
              <AppText variant="hero" style={{ maxWidth: '90%' }}>{pick.title}</AppText>
            </View>

            <ParticipantAttribution userId={pick.creator_id} />

            {pick.description ? <AppText tone="secondary">{pick.description}</AppText> : null}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              <TagChip label={pick.cost_level.toUpperCase()} />
              <TagChip label={pick.location_type.toUpperCase()} />
              <TagChip label={pick.environment.toUpperCase()} />
              <TagChip subtle label={pick.time_of_day.toUpperCase()} />
              {pick.kid_friendly ? <TagChip subtle label="KID FRIENDLY" /> : null}
              {(pick.tags ?? []).map((tag) => (
                <TagChip
                  key={tag.id}
                  subtle
                  icon={tag.icon}
                  iconDrawing={tag.icon_drawing}
                  label={tag.name.toUpperCase()}
                />
              ))}
            </View>

            <AppText variant="bodySmall" tone="secondary">
              {durationLabel(pick.duration_minutes)}{pick.location ? ` · ${pick.location}` : ''}
            </AppText>

            <View style={{ gap: theme.spacing.sm }}>
              <AppButton icon="heart" label="Let’s do it" onPress={planPick} />
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <AppButton icon="spark" label="Pick again" variant="secondary" disabled={busy} onPress={roll} />
                </View>
                <View style={{ flex: 1 }}>
                  <AppButton label="Not tonight" variant="ghost" disabled={busy} onPress={notTonight} />
                </View>
              </View>
              <AppButton
                label={pick.is_favourite ? '★ Favourite' : '☆ Save as favourite'}
                variant="ghost"
                disabled={busy}
                onPress={toggleFavourite}
              />
            </View>
          </Card>
        </RevealScale>
      ) : null}
    </AppScreen>
  );
}
