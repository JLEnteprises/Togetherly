import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { PartnerPresencePill } from '@/components/common/PartnerPresencePill';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FormField } from '@/components/common/FormField';
import { ChoiceChips } from '@/components/common/ChoiceChips';
import { TagChip } from '@/components/common/TagChip';
import { TagSelector } from '@/components/common/TagSelector';
import { ToggleRow } from '@/components/common/ToggleRow';
import { EmptyState } from '@/components/common/EmptyState';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';
import { DetailsToggle } from '@/components/common/DetailsToggle';
import { RecordViewSheet } from '@/components/common/RecordViewSheet';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { IconButton } from '@/components/common/IconButton';
import { AppIcon } from '@/components/art/AppIcon';
import { createActivity, deleteActivity, getActivities, getTags, setActivityFavourite, setActivityInterest, updateActivity } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import type { ActivityCost, ActivityEnvironment, ActivityLocationType, ActivityMood, ActivityStatus, ActivityTime, CoupleActivity, Tag } from '@/types/database';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }
function durationLabel(minutes: number | null) { if (!minutes) return 'Flexible'; if (minutes < 60) return `${minutes} min`; const hours = minutes / 60; return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr`; }
function planActivityHref(activity: CoupleActivity) { return `/features/calendar?prefillTitle=${encodeURIComponent(activity.title)}&prefillDescription=${encodeURIComponent(activity.description ?? '')}&prefillDuration=${activity.duration_minutes ?? 120}&sourceActivityId=${encodeURIComponent(activity.id)}`; }
type Filter = 'all' | 'matches' | 'want_to_do' | 'planned' | 'favourite' | 'completed';

export default function ActivitiesScreen() {
  const theme = useAppTheme(); const params = useLocalSearchParams<{ focus?: string; edit?: string }>(); const { profile, partnerProfile, colorForUser } = useWorkspace();
  const [activities, setActivities] = useState<CoupleActivity[]>([]); const [tags, setTags] = useState<Tag[]>([]); const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [cost, setCost] = useState<ActivityCost>('free'); const [locationType, setLocationType] = useState<ActivityLocationType>('anywhere'); const [environment, setEnvironment] = useState<ActivityEnvironment>('either'); const [mood, setMood] = useState<ActivityMood>('any'); const [timeOfDay, setTimeOfDay] = useState<ActivityTime>('any'); const [rating, setRating] = useState(''); const [duration, setDuration] = useState(''); const [location, setLocation] = useState(''); const [kidFriendly, setKidFriendly] = useState(false); const [booking, setBooking] = useState(false); const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [composerOpen, setComposerOpen] = useState(false); const [viewTarget, setViewTarget] = useState<CoupleActivity | null>(null); const [advancedOpen, setAdvancedOpen] = useState(false); const [filter, setFilter] = useState<Filter>('all'); const [busy, setBusy] = useState(false); const [editingId, setEditingId] = useState<string | null>(null); const [deleteTarget, setDeleteTarget] = useState<CoupleActivity | null>(null); const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => { try { const [nextActivities, nextTags] = await Promise.all([getActivities(), getTags()]); setActivities(nextActivities); setTags(nextTags); } catch (error) { Alert.alert('Couldnâ€™t load activities', messageFrom(error)); } finally { setLoading(false); } }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]); useRealtimeRefresh('activities', refresh); useRealtimeRefresh('tags', refresh);
  const visible = useMemo(() => activities.filter((activity) => {
    if (filter === 'all') return true;
    if (filter === 'matches') return profile && partnerProfile
      ? Boolean(activity.interests?.[profile.id]) && Boolean(activity.interests?.[partnerProfile.id])
      : false;
    return filter === 'favourite' ? activity.is_favourite : activity.status === filter;
  }), [activities, filter, profile, partnerProfile]);
  const mutualMatches = useMemo(() => {
    if (!profile || !partnerProfile) return [];
    return activities
      .filter((activity) => Boolean(activity.interests?.[profile.id]) && Boolean(activity.interests?.[partnerProfile.id]))
      .filter((activity) => activity.status !== 'completed' && activity.status !== 'skip')
      .sort((a, b) => Number(Boolean(b.is_favourite)) - Number(Boolean(a.is_favourite)) || a.title.localeCompare(b.title));
  }, [activities, profile, partnerProfile]);
  const topMatch = mutualMatches[0] ?? null;
  function resetForm(close = true) { setEditingId(null); setTitle(''); setDescription(''); setCost('free'); setLocationType('anywhere'); setLocation(''); setEnvironment('either'); setMood('any'); setTimeOfDay('any'); setRating(''); setDuration(''); setKidFriendly(false); setBooking(false); setSelectedTags([]); setAdvancedOpen(false); if (close) setComposerOpen(false); }
  function beginEdit(activity: CoupleActivity) { setEditingId(activity.id); setTitle(activity.title); setDescription(activity.description ?? ''); setCost(activity.cost_level); setLocationType(activity.location_type); setLocation(activity.location ?? ''); setEnvironment(activity.environment); setMood(activity.mood); setTimeOfDay(activity.time_of_day); setRating(activity.rating == null ? '' : String(activity.rating)); setDuration(activity.duration_minutes == null ? '' : String(activity.duration_minutes)); setKidFriendly(Boolean(activity.kid_friendly)); setBooking(Boolean(activity.booking_required)); setSelectedTags((activity.tags ?? []).map((tag) => tag.id)); setAdvancedOpen(true); setComposerOpen(true); }
  useEffect(() => { if (!params.focus || !activities.length) return; const focused = activities.find((activity) => activity.id === params.focus); if (focused) setViewTarget(focused); }, [params.focus, activities]);
  useEffect(() => { if (!params.edit || editingId === params.edit || !activities.length) return; const target = activities.find((activity) => activity.id === params.edit); if (target) beginEdit(target); }, [params.edit, editingId, activities]);
  async function save() { const durationMinutes = duration.trim() ? Number(duration) : null; if (!title.trim() || (durationMinutes != null && (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1440))) { Alert.alert('Check the activity', 'Add a title and, if used, a duration between 1 and 1,440 minutes.'); return; } setBusy(true); try { const parsedRating = rating.trim() ? Number(rating) : null; if (parsedRating != null && (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5)) throw new Error('Rating must be a whole number from 1 to 5.'); const input = { title: title.trim(), description, costLevel: cost, locationType, location, environment, mood, timeOfDay, durationMinutes, kidFriendly, bookingRequired: booking, rating: parsedRating, tagIds: selectedTags }; if (editingId) await updateActivity(editingId, input); else await createActivity(input); resetForm(); await refresh(); } catch (error) { Alert.alert(editingId ? 'Couldnâ€™t update activity' : 'Couldnâ€™t add activity', messageFrom(error)); } finally { setBusy(false); } }
  async function toggleInterest(activity: CoupleActivity) {
    if (!profile) return;
    const current = Boolean(activity.interests?.[profile.id]);
    const partnerAlreadyInterested = partnerProfile ? Boolean(activity.interests?.[partnerProfile.id]) : false;
    try {
      await setActivityInterest(activity.id, !current);
      await refresh();
      if (!current && partnerAlreadyInterested) {
        const partnerName = partnerProfile?.display_name || 'your partner';
        Alert.alert(
          'It’s a match ❤️',
          `You and ${partnerName} both want to do “${activity.title}”.`,
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Plan it', onPress: () => router.push(planActivityHref(activity) as never) },
          ],
        );
      }
    } catch (error) {
      Alert.alert('Couldn’t update interest', messageFrom(error));
    }
  }
  async function toggleFavourite(activity: CoupleActivity) {
    try {
      await setActivityFavourite(activity.id, !activity.is_favourite);
      await refresh();
    } catch (error) {
      Alert.alert('Couldn’t update favourite', messageFrom(error));
    }
  }
  async function setStatus(activity: CoupleActivity, status: ActivityStatus) { try { await updateActivity(activity.id, { status }); await refresh(); } catch (error) { Alert.alert('Couldnâ€™t update activity', messageFrom(error)); } }
  async function removeConfirmed() { const target = deleteTarget; setDeleteTarget(null); if (!target) return; try { await deleteActivity(target.id); setActivities((current) => current.filter((activity) => activity.id !== target.id)); if (editingId === target.id) resetForm(); } catch (error) { Alert.alert('Couldnâ€™t delete activity', messageFrom(error)); } }
  function openActivityMenu(activity: CoupleActivity) {
    Alert.alert(activity.title, 'More actions', [
      { text: activity.is_favourite ? 'Remove favourite' : 'Favourite', onPress: () => toggleFavourite(activity) },
      { text: activity.status === 'completed' ? 'Do this again' : activity.status === 'do_again' ? 'Move back to ideas' : 'Mark as done', onPress: () => setStatus(activity, activity.status === 'completed' ? 'do_again' : activity.status === 'do_again' ? 'want_to_do' : 'completed') },
      { text: 'Edit idea', onPress: () => beginEdit(activity) },
      { text: 'Delete', style: 'destructive', onPress: () => setDeleteTarget(activity) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return <AppScreen>
    <BackHeader eyebrow="Together" title="Date ideas" subtitle="Keep the ideas. Surface the one you might actually do." />
      <PartnerPresencePill scope="date-ideas" />
    <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.lg, alignItems: 'center' }}>
      <View style={{ flex: 1 }}><AppButton compact label="Pick one for us" onPress={() => router.push('/features/activity-randomizer' as never)} /></View>
      <IconButton icon="date" label="Add a new date idea" tone="accent" onPress={() => setComposerOpen(true)} />
    </View>

    <CollapsibleComposer title={editingId ? 'Edit idea' : 'Add a date idea'} subtitle={editingId ? 'Change the details you want to keep.' : 'Start simple. Extra details are optional.'} open={composerOpen} actionLabel="New idea" closeLabel={editingId ? 'Cancel edit' : 'Close'} tone="accent" style={{ marginBottom: theme.spacing.lg }} onToggle={() => composerOpen ? resetForm() : setComposerOpen(true)}>
      <FormField label="What do you want to do?" value={title} onChangeText={setTitle} placeholder="Stargazing" />
      <DetailsToggle open={advancedOpen} onToggle={() => setAdvancedOpen((value) => !value)} closedLabel="Add details" openLabel="Hide details" hint="Cost, place, mood, duration and anything else." />
      {advancedOpen ? <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.sm }}><AppText variant="bodySmall" tone="secondary">Cost</AppText><ChoiceChips value={cost} onChange={setCost} options={[{ value: 'free', label: 'Free' }, { value: 'cheap', label: 'Cheap' }, { value: 'moderate', label: 'Moderate' }, { value: 'expensive', label: 'Expensive' }]} /></View>
        <View style={{ gap: theme.spacing.sm }}><AppText variant="bodySmall" tone="secondary">Where?</AppText><ChoiceChips value={locationType} onChange={setLocationType} options={[{ value: 'home', label: 'Home' }, { value: 'nearby', label: 'Nearby' }, { value: 'online', label: 'Online' }, { value: 'anywhere', label: 'Anywhere' }]} /></View>
        <FormField label="What makes this a good date?" value={description} onChangeText={setDescription} multiline placeholder="What makes this a good dateâ€¦" />
        <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">Setting</AppText><ChoiceChips value={environment} onChange={setEnvironment} options={[{ value: 'either', label: 'Either' }, { value: 'indoor', label: 'Indoor' }, { value: 'outdoor', label: 'Outdoor' }]} /></View>
        <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">Mood</AppText><ChoiceChips value={mood} onChange={setMood} options={[{ value: 'any', label: 'Anything' }, { value: 'romantic', label: 'Romantic' }, { value: 'relaxing', label: 'Relaxing' }, { value: 'adventurous', label: 'Adventure' }, { value: 'active', label: 'Active' }, { value: 'lazy', label: 'Lazy' }, { value: 'silly', label: 'Silly' }]} /></View>
        <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">Time of day</AppText><ChoiceChips value={timeOfDay} onChange={setTimeOfDay} options={[{ value: 'any', label: 'Any' }, { value: 'morning', label: 'Morning' }, { value: 'day', label: 'Day' }, { value: 'night', label: 'Night' }]} /></View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}><View style={{ flex: 1 }}><FormField label="DURATION Â· MIN" value={duration} onChangeText={setDuration} keyboardType="number-pad" placeholder="120" /></View><View style={{ flex: 1 }}><FormField label="LOCATION Â· OPTIONAL" value={location} onChangeText={setLocation} placeholder="Lake, Discordâ€¦" /></View></View>
        <FormField label="RATING Â· OPTIONAL 1â€“5" value={rating} onChangeText={setRating} keyboardType="number-pad" placeholder="5" />
        <ToggleRow label="Kid friendly" value={kidFriendly} onChange={setKidFriendly} /><ToggleRow label="Booking required" value={booking} onChange={setBooking} /><TagSelector tags={tags} selectedIds={selectedTags} onChange={setSelectedTags} />
      </View> : null}
      <AppButton label={busy ? 'Savingâ€¦' : editingId ? 'Save changes' : 'Save idea'} disabled={busy || !title.trim()} onPress={save} />
    </CollapsibleComposer>

    {topMatch ? <Card tone="accent" participantColor="both" style={{ gap: theme.spacing.md, marginBottom: theme.spacing.lg, padding: theme.spacing.xl }}>
      <AppText variant="caption" tone="accent">YOU BOTH PICKED THIS ❤️</AppText>
      <AppText variant="hero">{topMatch.title}</AppText>
      <AppText tone="secondary">{mutualMatches.length === 1 ? `You and ${partnerProfile?.display_name || 'your partner'} matched on this date idea.` : `You have ${mutualMatches.length} date ideas you both want.`}</AppText>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}><AppButton compact icon="heart" label="Plan this date" onPress={() => router.push(planActivityHref(topMatch) as never)} /></View>
        <View style={{ flex: 1 }}><AppButton compact variant="secondary" label={mutualMatches.length === 1 ? 'See the idea' : `See all ${mutualMatches.length}`} onPress={() => mutualMatches.length === 1 ? setViewTarget(topMatch) : setFilter('matches')} /></View>
      </View>
    </Card> : null}

    <View style={{ marginBottom: theme.spacing.xl }}><ChoiceChips value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'matches', label: 'Matches ❤️' }, { value: 'want_to_do', label: 'Want to do' }, { value: 'planned', label: 'Planned' }, { value: 'favourite', label: 'Favourites' }, { value: 'completed', label: 'Done' }]} /></View>

    <View style={{ gap: theme.spacing.md }}>
      {loading ? <AppText tone="muted">Loading ideasâ€¦</AppText> : null}
      {!loading && visible.length === 0 ? <EmptyState icon="date" title={activities.length ? 'No ideas in this view' : 'Your next date can start here'} body={activities.length ? 'Try another filter.' : 'Save a few things youâ€™d genuinely enjoy doing together.'} actionLabel={activities.length ? undefined : 'Add an idea'} onAction={activities.length ? undefined : () => setComposerOpen(true)} /> : null}
      {visible.map((activity) => {
        const myInterest = profile ? Boolean(activity.interests?.[profile.id]) : false;
        const partnerInterest = partnerProfile ? Boolean(activity.interests?.[partnerProfile.id]) : false;
        const statusText = myInterest && partnerInterest ? 'Both want this ❤️' : myInterest ? 'Youâ€™re interested' : partnerInterest ? `${partnerProfile!.display_name} is interested` : 'No interest votes yet';
        return <Card key={activity.id} participantColor="both" style={{ gap: theme.spacing.md, opacity: activity.status === 'skip' ? 0.56 : 1 }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Open date idea ${activity.title}`} onPress={() => setViewTarget(activity)} style={({ pressed }) => ({ flex: 1, gap: 5, opacity: pressed ? 0.76 : 1 })}><AppText variant="section">{activity.title}</AppText><ParticipantAttribution userId={activity.creator_id} />{activity.description ? <AppText variant="bodySmall" tone="secondary" numberOfLines={2}>{activity.description}</AppText> : <AppText variant="bodySmall" tone="muted">Tap to see the idea.</AppText>}</Pressable>
            <IconButton icon="overflow" label={`More actions for ${activity.title}`} onPress={() => openActivityMenu(activity)} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <TagChip subtle label={activity.cost_level.toUpperCase()} /><TagChip subtle label={durationLabel(activity.duration_minutes).toUpperCase()} /><TagChip subtle label={activity.location_type.toUpperCase()} />
            {activity.is_favourite ? <TagChip subtle label="★ FAVOURITE" /> : null}{activity.rating ? <TagChip subtle label={`${activity.rating}/5 â˜…`} /> : null}
            {(activity.tags ?? []).slice(0, 1).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}
            {(activity.tags ?? []).length > 1 ? <TagChip subtle label={`+${(activity.tags ?? []).length - 1} TAGS`} /> : null}
          </View>
          <AppText variant="caption" tone={myInterest && partnerInterest ? 'success' : 'secondary'}>{statusText.toUpperCase()}</AppText>{myInterest && partnerInterest ? <TagChip label="❤️ MATCH" /> : null}
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <View style={{ flex: 1 }}><AppButton compact variant={myInterest ? 'secondary' : 'ghost'} label={myInterest ? 'Interested âœ“' : 'Interested'} onPress={() => toggleInterest(activity)} /></View>
            <View style={{ flex: 1 }}><AppButton compact label={activity.status === 'planned' ? 'Planned' : 'Plan this'} onPress={() => router.push(planActivityHref(activity) as never)} /></View>
          </View>
        </Card>;
      })}
    </View>
    <RecordViewSheet visible={!!viewTarget} onClose={() => setViewTarget(null)} eyebrow="Date idea" title={viewTarget?.title ?? ''}>
      {viewTarget ? <View style={{ gap: theme.spacing.md }}>
        <ParticipantAttribution userId={viewTarget.creator_id} />
        {viewTarget.description ? <AppText tone="secondary">{viewTarget.description}</AppText> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <TagChip subtle label={viewTarget.cost_level.toUpperCase()} />
          <TagChip subtle label={durationLabel(viewTarget.duration_minutes).toUpperCase()} />
          <TagChip subtle label={viewTarget.location_type.toUpperCase()} />
          <TagChip subtle label={viewTarget.environment.toUpperCase()} />
          <TagChip subtle label={viewTarget.mood.toUpperCase()} />
          <TagChip subtle label={viewTarget.time_of_day.toUpperCase()} />
          {viewTarget.location ? <TagChip subtle label={viewTarget.location.toUpperCase()} /> : null}
          {viewTarget.rating ? <TagChip subtle label={`${viewTarget.rating}/5 ★`} /> : null}
          {viewTarget.kid_friendly ? <TagChip subtle label="KID FRIENDLY" /> : null}
          {viewTarget.booking_required ? <TagChip subtle label="BOOKING NEEDED" /> : null}
          {viewTarget.is_favourite ? <TagChip subtle label="★ FAVOURITE" /> : null}
          <TagChip subtle label={viewTarget.status.replace('_', ' ').toUpperCase()} />
          {(viewTarget.tags ?? []).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}
        </View>
      </View> : null}
    </RecordViewSheet>
    <ConfirmDialog visible={!!deleteTarget} title="Delete activity?" body={deleteTarget ? `Delete â€œ${deleteTarget.title}â€?` : ''} onCancel={() => setDeleteTarget(null)} onConfirm={() => removeConfirmed().catch(() => undefined)} />
  </AppScreen>;
}
