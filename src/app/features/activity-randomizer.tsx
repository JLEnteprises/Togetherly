import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { ChoiceChips } from '@/components/common/ChoiceChips';
import { TagChip } from '@/components/common/TagChip';
import { TagSelector } from '@/components/common/TagSelector';
import { ToggleRow } from '@/components/common/ToggleRow';
import { EmptyState } from '@/components/common/EmptyState';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { getTags, randomActivity, rejectActivity, updateActivity } from '@/services/backend/mvpFeatures';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import type { ActivityCost, ActivityEnvironment, ActivityLocationType, ActivityMood, ActivityTime, CoupleActivity, Tag } from '@/types/database';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }
function durationLabel(minutes: number | null) { if (!minutes) return 'Flexible time'; if (minutes < 60) return `${minutes} minutes`; return `~${(minutes / 60).toFixed(minutes % 60 === 0 ? 0 : 1)} hours`; }

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

  const loadTags = useCallback(async () => {
    try { setTags(await getTags()); } catch { setTags([]); }
  }, []);
  useEffect(() => { loadTags().catch(() => undefined); }, [loadTags]);

  async function roll() {
    setBusy(true); setHasTried(true);
    try {
      setPick(await randomActivity({
        cost: cost === 'any' ? undefined : cost,
        locationType: locationType === 'any' ? undefined : locationType,
        environment: environment === 'any' ? undefined : environment,
        mood: mood === 'any' ? undefined : mood,
        timeOfDay: timeOfDay === 'any' ? undefined : timeOfDay,
        maxMinutes: time === 'any' ? undefined : Number(time),
        kidFriendly: kidFriendly ? true : undefined,
        tagIds: tagIds.length ? tagIds : undefined,
      }));
    } catch (error) { Alert.alert('Couldnâ€™t pick an activity', messageFrom(error)); }
    finally { setBusy(false); }
  }

  async function notTonight() {
    if (!pick || busy) return;
    setBusy(true);
    try { await rejectActivity(pick.id); }
    catch (error) { Alert.alert('Could not reroll', messageFrom(error)); setBusy(false); return; }
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

  async function choose(status: 'favourite') {
    if (!pick) return;
    try { const updated = await updateActivity(pick.id, { status }); setPick({ ...pick, ...updated }); }
    catch (error) { Alert.alert('Couldnâ€™t update activity', messageFrom(error)); }
  }

  return (
    <AppScreen>
      <BackHeader eyebrow="Together" title="Activity randomiser" subtitle="Choose from your saved date ideas." />
      <Card style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.xxl }}>
        <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">BUDGET</AppText><ChoiceChips value={cost} onChange={setCost} options={[{ value: 'any', label: 'Any' }, { value: 'free', label: 'Free' }, { value: 'cheap', label: 'Cheap' }, { value: 'moderate', label: 'Moderate' }, { value: 'expensive', label: 'Expensive' }]} /></View>
        <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">LOCATION</AppText><ChoiceChips value={locationType} onChange={setLocationType} options={[{ value: 'any', label: 'Any' }, { value: 'home', label: 'Home' }, { value: 'nearby', label: 'Nearby' }, { value: 'online', label: 'Online' }, { value: 'anywhere', label: 'Anywhere' }]} /></View>
        <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">ENVIRONMENT</AppText><ChoiceChips value={environment} onChange={setEnvironment} options={[{ value: 'any', label: 'Either' }, { value: 'indoor', label: 'Indoor' }, { value: 'outdoor', label: 'Outdoor' }]} /></View>
        <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">MOOD</AppText><ChoiceChips value={mood} onChange={setMood} options={[{ value: 'any', label: 'Any' }, { value: 'romantic', label: 'Romantic' }, { value: 'relaxing', label: 'Relaxing' }, { value: 'adventurous', label: 'Adventure' }, { value: 'active', label: 'Active' }, { value: 'lazy', label: 'Lazy' }, { value: 'silly', label: 'Silly' }]} /></View>
        <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">TIME OF DAY</AppText><ChoiceChips value={timeOfDay} onChange={setTimeOfDay} options={[{ value: 'any', label: 'Any' }, { value: 'morning', label: 'Morning' }, { value: 'day', label: 'Day' }, { value: 'night', label: 'Night' }]} /></View>
        <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">DURATION</AppText><ChoiceChips value={time} onChange={setTime} options={[{ value: 'any', label: 'Any' }, { value: '30', label: 'â‰¤30m' }, { value: '60', label: 'â‰¤1h' }, { value: '180', label: '<=3h' }, { value: '360', label: 'Half day' }, { value: '1440', label: 'Full day' }]} /></View>
        <ToggleRow label="Must be kid friendly" value={kidFriendly} onChange={setKidFriendly} />
        <TagSelector tags={tags} selectedIds={tagIds} onChange={setTagIds} label="MUST INCLUDE TAGS" />
        <AppButton label={busy ? 'Consulting the starsâ€¦' : 'âœ¦ Pick something for us'} disabled={busy} onPress={roll} />
      </Card>

      {hasTried && !busy && !pick ? <EmptyState icon="spark" title="Nothing matches" body="Nothing matches those filters. Try loosening one or add another idea." /> : null}
      {pick ? (
        <Card tone="accent" participantColor={colorForUser(pick.creator_id)} style={{ gap: theme.spacing.lg, padding: theme.spacing.xl }}>
          <AppText variant="caption" tone="accent">TONIGHTâ€™S PICK</AppText>
          <AppText variant="hero">{pick.title}</AppText>
          <ParticipantAttribution userId={pick.creator_id} />
          {pick.description ? <AppText tone="secondary">{pick.description}</AppText> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <TagChip label={pick.cost_level.toUpperCase()} /><TagChip label={pick.location_type.toUpperCase()} /><TagChip label={pick.environment.toUpperCase()} /><TagChip subtle label={pick.time_of_day.toUpperCase()} />
            {pick.kid_friendly ? <TagChip subtle label="KID FRIENDLY" /> : null}
            {(pick.tags ?? []).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}
          </View>
          <AppText variant="bodySmall" tone="secondary">{durationLabel(pick.duration_minutes)}{pick.location ? ` Â· ${pick.location}` : ''}</AppText>
          <View style={{ gap: theme.spacing.sm }}>
            <AppButton icon="heart" label="Letâ€™s do it" onPress={planPick} />
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}><View style={{ flex: 1 }}><AppButton icon="spark" label="Reroll" variant="secondary" disabled={busy} onPress={roll} /></View><View style={{ flex: 1 }}><AppButton label="Not tonight" variant="ghost" disabled={busy} onPress={notTonight} /></View></View>
            <AppButton label={pick.status === 'favourite' ? 'â˜… Favourite' : 'â˜† Save as favourite'} variant="ghost" disabled={busy} onPress={() => choose('favourite')} />
          </View>
        </Card>
      ) : null}
    </AppScreen>
  );
}
