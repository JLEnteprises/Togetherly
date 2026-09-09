import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { AppIcon, type AppIconName } from '@/components/art/AppIcon';
import { ProgressBar } from '@/components/common/ProgressBar';
import { TagChip } from '@/components/common/TagChip';
import { EmptyState } from '@/components/common/EmptyState';
import { createCountdown, createList, getCountdowns, getLists } from '@/services/backend/coreFeatures';
import { createEvent, getEvents, getGoals, getTrip, linkTripItem, unlinkTripItem } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import type { CoupleCountdown, CoupleEvent, CoupleGoal, CoupleList, CoupleTrip, TripLink, TripLinkType } from '@/types/database';
import { dateOnlyFromIso } from '@/utils/dates';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }
function targetIso(dateKey: string) { return new Date(`${dateKey}T12:00:00`).toISOString(); }
function linkHref(link: TripLink) {
  if (link.entity_type === 'list') return `/features/lists/${encodeURIComponent(link.entity_id)}`;
  if (link.entity_type === 'goal') return `/features/goals?focus=${encodeURIComponent(link.entity_id)}`;
  if (link.entity_type === 'countdown') return `/features/countdowns?focus=${encodeURIComponent(link.entity_id)}`;
  return `/features/calendar?focus=${encodeURIComponent(link.entity_id)}`;
}
function formatDateKey(value: string | null) {
  if (!value) return null;
  try { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T12:00:00`)); }
  catch { return value; }
}
function tripDateLabel(trip: CoupleTrip) {
  const start = formatDateKey(trip.start_date);
  const end = formatDateKey(trip.end_date);
  if (!start) return 'Dates not set yet';
  return end ? `${start} – ${end}` : start;
}
function daysFromToday(dateKey: string | null) {
  if (!dateKey) return null;
  const target = new Date(`${dateKey}T12:00:00`).getTime();
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.ceil((target - today.getTime()) / 86_400_000);
}
function tripTimingLabel(trip: CoupleTrip) {
  const until = daysFromToday(trip.start_date);
  const untilEnd = daysFromToday(trip.end_date ?? trip.start_date);
  if (until == null) return 'Add dates to start the countdown';
  if (until > 1) return `${until} days away`;
  if (until === 1) return 'Tomorrow ♥';
  if (until === 0) return 'Today ♥';
  if (until < 0 && (untilEnd ?? -1) >= 0) return 'You’re on this trip ♥';
  return 'A trip worth remembering';
}
function eventDateLabel(event: CoupleEvent | null) {
  if (!event) return 'Add your trip to the calendar';
  if (event.all_day && event.start_date) {
    const start = formatDateKey(event.start_date);
    const end = formatDateKey(event.end_date ?? event.start_date);
    return start && end && start !== end ? `${start} – ${end}` : start ?? event.title;
  }
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(event.start_at));
}
function countdownLabel(countdown: CoupleCountdown | null) {
  if (!countdown) return 'Add a countdown';
  const days = Math.ceil((new Date(countdown.target_at).getTime() - Date.now()) / 86_400_000);
  if (days > 1) return `${days} days to go`;
  if (days === 1) return 'Tomorrow';
  if (days === 0) return 'Today';
  return 'Trip has started';
}
function typePresentation(type: TripLinkType): { icon: AppIconName; label: string } {
  if (type === 'list') return { icon: 'list', label: 'List' };
  if (type === 'goal') return { icon: 'goal', label: 'Goal' };
  if (type === 'countdown') return { icon: 'countdown', label: 'Countdown' };
  return { icon: 'calendar', label: 'Calendar' };
}

function HubRow({ icon, eyebrow, title, detail, onPress, progress }: { icon: AppIconName; eyebrow: string; title: string; detail: string; onPress: () => void; progress?: number }) {
  const theme = useAppTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${eyebrow}. ${title}. ${detail}`} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.72 : 1 })}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center', paddingVertical: theme.spacing.sm }}>
        <View style={{ width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.elevatedBackground }}>
          <AppIcon name={icon} size={20} color={theme.colors.accent} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <AppText variant="caption" tone="muted">{eyebrow}</AppText>
          <AppText variant="cardTitle" numberOfLines={1}>{title}</AppText>
          <AppText variant="bodySmall" tone="secondary" numberOfLines={2}>{detail}</AppText>
          {progress == null ? null : <View style={{ paddingTop: 4 }}><ProgressBar value={progress} /></View>}
        </View>
        <AppIcon name="chevron" size={16} color={theme.colors.textMuted} />
      </View>
    </Pressable>
  );
}

export default function TripDetailScreen() {
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colorForUser } = useWorkspace();
  const [trip, setTrip] = useState<CoupleTrip | null>(null);
  const [links, setLinks] = useState<TripLink[]>([]);
  const [lists, setLists] = useState<CoupleList[]>([]);
  const [goals, setGoals] = useState<CoupleGoal[]>([]);
  const [countdowns, setCountdowns] = useState<CoupleCountdown[]>([]);
  const [events, setEvents] = useState<CoupleEvent[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [linkerOpen, setLinkerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const [detail, nextLists, nextGoals, nextCountdowns, nextEvents] = await Promise.all([getTrip(id), getLists(), getGoals(), getCountdowns(), getEvents()]);
      setTrip(detail.trip);
      setLinks(detail.links);
      setLists(nextLists);
      setGoals(nextGoals);
      setCountdowns(nextCountdowns);
      setEvents(nextEvents);
    } catch (error) {
      Alert.alert('Couldn’t load trip', messageFrom(error));
    }
  }, [id]);

  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('trips', refresh);
  useRealtimeRefresh('lists', refresh);
  useRealtimeRefresh('goals', refresh);
  useRealtimeRefresh('countdowns', refresh);
  useRealtimeRefresh('events', refresh);

  const linkedKeys = useMemo(() => new Set(links.map((link) => `${link.entity_type}:${link.entity_id}`)), [links]);
  const candidates: Array<{ type: TripLinkType; id: string; title: string; subtitle: string }> = [
    ...lists.map((item) => ({ type: 'list' as const, id: item.id, title: item.title, subtitle: `${item.item_count ?? 0} items` })),
    ...goals.map((item) => ({ type: 'goal' as const, id: item.id, title: item.title, subtitle: `${item.current_value} / ${item.target_value}${item.unit ? ` ${item.unit}` : ''}` })),
    ...countdowns.map((item) => ({ type: 'countdown' as const, id: item.id, title: item.title, subtitle: dateOnlyFromIso(item.target_at) || new Date(item.target_at).toLocaleDateString() })),
    ...events.map((item) => ({ type: 'event' as const, id: item.id, title: item.title, subtitle: eventDateLabel(item) })),
  ];

  const packingLink = links.find((item) => item.entity_type === 'list') ?? null;
  const goalLink = links.find((item) => item.entity_type === 'goal') ?? null;
  const countdownLink = links.find((item) => item.entity_type === 'countdown') ?? null;
  const eventLink = links.find((item) => item.entity_type === 'event') ?? null;
  const packing = packingLink ? lists.find((item) => item.id === packingLink.entity_id) ?? null : null;
  const goal = goalLink ? goals.find((item) => item.id === goalLink.entity_id) ?? null : null;
  const countdown = countdownLink ? countdowns.find((item) => item.id === countdownLink.entity_id) ?? null : null;
  const event = eventLink ? events.find((item) => item.id === eventLink.entity_id) ?? null : null;
  const packingTotal = packing?.item_count ?? 0;
  const packingDone = packing?.completed_count ?? 0;
  const packingProgress = packingTotal > 0 ? (packingDone / packingTotal) * 100 : 0;
  const goalCurrent = goal ? Number(goal.current_value) : 0;
  const goalTarget = goal ? Number(goal.target_value) : 0;
  const goalProgress = goal && Number.isFinite(goalCurrent) && Number.isFinite(goalTarget) && goalTarget > 0 ? (goalCurrent / goalTarget) * 100 : 0;
  const remainingLinks = links.filter((item) => item !== packingLink && item !== goalLink && item !== countdownLink && item !== eventLink);

  async function link(type: TripLinkType, entityId: string) {
    if (!id) return;
    try { await linkTripItem(id, type, entityId); await refresh(); }
    catch (error) { Alert.alert('Couldn’t add it to this trip', messageFrom(error)); }
  }
  async function unlink(item: TripLink) {
    if (!id) return;
    try { await unlinkTripItem(id, item.entity_type, item.entity_id); await refresh(); }
    catch (error) { Alert.alert('Couldn’t remove it from this trip', messageFrom(error)); }
  }
  async function createPacking() {
    if (!trip || !id) return;
    if (links.some((item) => item.entity_type === 'list')) { Alert.alert('Packing list already added', 'Open your trip list below, or add another existing list from Manage trip.'); return; }
    setBusy(true);
    try { const list = await createList(`${trip.title} packing`); await linkTripItem(id, 'list', list.id); await refresh(); }
    catch (error) { Alert.alert('Couldn’t create packing list', messageFrom(error)); }
    finally { setBusy(false); }
  }
  async function createTripCountdown() {
    if (links.some((item) => item.entity_type === 'countdown')) { Alert.alert('Countdown already added', 'Open the countdown from your trip hub if you want to change it.'); return; }
    if (!trip?.start_date || !id) { Alert.alert('Add trip dates first', 'Set a start date before creating a trip countdown.'); return; }
    setBusy(true);
    try {
      const targetAt = targetIso(trip.start_date);
      const now = new Date().toISOString();
      const next = await createCountdown({ title: `${trip.title} begins`, targetAt, startAt: new Date(now).getTime() < new Date(targetAt).getTime() ? now : null, type: 'visit' });
      await linkTripItem(id, 'countdown', next.id, true);
      await refresh();
    } catch (error) { Alert.alert('Could not create countdown', messageFrom(error)); }
    finally { setBusy(false); }
  }
  async function createCalendarEntry() {
    if (links.some((item) => item.entity_type === 'event')) { Alert.alert('Calendar dates already added', 'Open the calendar entry from your trip hub if you want to change it.'); return; }
    if (!trip?.start_date || !id) { Alert.alert('Add trip dates first', 'Set a start date before adding the trip to the calendar.'); return; }
    setBusy(true);
    try {
      const next = await createEvent({ title: trip.title, description: trip.notes, startAt: targetIso(trip.start_date), endAt: trip.end_date ? targetIso(trip.end_date) : null, startDate: trip.start_date, endDate: trip.end_date, allDay: true, location: trip.destination, assignee: 'both' });
      await linkTripItem(id, 'event', next.id, true);
      await refresh();
    } catch (error) { Alert.alert('Couldn’t add calendar entry', messageFrom(error)); }
    finally { setBusy(false); }
  }

  if (!trip) return <AppScreen><BackHeader eyebrow="Trip" title="Loading…" /><AppText tone="muted">Loading your trip…</AppText></AppScreen>;

  return (
    <AppScreen>
      <BackHeader eyebrow="Our trip" title={trip.title} subtitle={trip.destination || 'Somewhere together'} />

      <Card participantColor="both" style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.xl, padding: theme.spacing.lg, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', width: 150, height: 150, borderRadius: 75, right: -70, top: -75, backgroundColor: theme.colors.accentSoft }} />
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <AppIcon name="trip" size={18} color={theme.colors.accent} />
            <AppText variant="caption" tone="secondary">{trip.destination ? trip.destination.toUpperCase() : 'OUR NEXT ADVENTURE'}</AppText>
          </View>
          <AppText variant="pageTitle">{tripTimingLabel(trip)}</AppText>
          <AppText variant="bodySmall" tone="secondary">{tripDateLabel(trip)}</AppText>
        </View>
        {(trip.tags ?? []).length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{(trip.tags ?? []).slice(0, 4).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}</View> : null}
      </Card>

      <View style={{ gap: 4, marginBottom: theme.spacing.sm }}>
        <AppText variant="section">Everything for the trip</AppText>
        <AppText variant="bodySmall" tone="muted">The useful parts of your plan, in one place.</AppText>
      </View>

      <Card tone="secondary" style={{ gap: 2, marginBottom: theme.spacing.lg, paddingVertical: theme.spacing.sm }}>
        {packingLink ? (
          <HubRow icon="list" eyebrow="PACKING" title={packing?.title ?? packingLink.title} detail={packing ? (packingTotal ? `${packingDone} of ${packingTotal} packed` : 'Ready for your packing list') : packingLink.subtitle || 'Packing list'} progress={packingProgress} onPress={() => router.push(linkHref(packingLink) as never)} />
        ) : (
          <HubRow icon="list" eyebrow="PACKING" title="Start a packing list" detail="Keep everything you need for the trip together." onPress={() => void createPacking()} />
        )}

        {goalLink ? (
          <HubRow icon="goal" eyebrow="TRIP GOAL" title={goal?.title ?? goalLink.title} detail={goal ? `${goal.current_value} / ${goal.target_value}${goal.unit ? ` ${goal.unit}` : ''}` : goalLink.subtitle || 'Shared goal'} progress={goalProgress} onPress={() => router.push(linkHref(goalLink) as never)} />
        ) : (
          <HubRow icon="goal" eyebrow="TRIP GOAL" title="Add a goal or trip fund" detail="Link an existing goal when there’s something you’re working toward." onPress={() => { setManageOpen(true); setLinkerOpen(true); }} />
        )}

        {eventLink ? (
          <HubRow icon="calendar" eyebrow="CALENDAR" title={event?.title ?? eventLink.title} detail={eventDateLabel(event)} onPress={() => router.push(linkHref(eventLink) as never)} />
        ) : (
          <HubRow icon="calendar" eyebrow="CALENDAR" title="Add the trip dates" detail={trip.start_date ? tripDateLabel(trip) : 'Set trip dates first, then add them to your shared calendar.'} onPress={() => void createCalendarEntry()} />
        )}

        {countdownLink ? (
          <HubRow icon="countdown" eyebrow="COUNTDOWN" title={countdown?.title ?? countdownLink.title} detail={countdownLabel(countdown)} onPress={() => router.push(linkHref(countdownLink) as never)} />
        ) : (
          <HubRow icon="countdown" eyebrow="COUNTDOWN" title="Count down together" detail={trip.start_date ? 'Make the wait feel a little shorter.' : 'Set a start date before adding a countdown.'} onPress={() => void createTripCountdown()} />
        )}
      </Card>

      <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md, alignItems: 'center' }}>
          <AppText variant="section">Things to remember</AppText>
          <AppButton compact variant="ghost" label="Edit" onPress={() => router.push(`/features/trips?focus=${encodeURIComponent(trip.id)}` as never)} />
        </View>
        <Card participantColor={colorForUser(trip.creator_id)} tone="secondary" style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' }}>
            <AppIcon name="note" size={19} color={theme.colors.textSecondary} />
            <AppText tone={trip.notes ? 'secondary' : 'muted'} style={{ flex: 1 }}>{trip.notes || 'Flight numbers, hotel details, places you want to try, or anything else you don’t want to forget.'}</AppText>
          </View>
        </Card>
      </View>

      {remainingLinks.length ? (
        <View style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}>
          <AppText variant="section">More for this trip</AppText>
          {remainingLinks.map((item) => {
            const presentation = typePresentation(item.entity_type);
            return <HubRow key={`${item.entity_type}:${item.entity_id}`} icon={presentation.icon} eyebrow={presentation.label.toUpperCase()} title={item.title} detail={item.subtitle || 'Open'} onPress={() => router.push(linkHref(item) as never)} />;
          })}
        </View>
      ) : null}

      <View style={{ marginBottom: theme.spacing.md }}>
        <AppButton label={manageOpen ? 'Done managing trip' : '+ Add to trip'} variant={manageOpen ? 'secondary' : 'primary'} onPress={() => { setManageOpen((value) => !value); if (manageOpen) setLinkerOpen(false); }} />
      </View>

      {manageOpen ? (
        <Card tone="secondary" style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.xxl }}>
          <View style={{ gap: 4 }}>
            <AppText variant="section">Add to this trip</AppText>
            <AppText variant="bodySmall" tone="muted">Create the common pieces quickly, or bring in something you already made elsewhere in Togetherly.</AppText>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <AppButton compact variant="secondary" label={packingLink ? '✓ Packing' : '+ Packing'} disabled={busy || !!packingLink} onPress={createPacking} />
            <AppButton compact variant="secondary" label={countdownLink ? '✓ Countdown' : '+ Countdown'} disabled={busy || !!countdownLink} onPress={createTripCountdown} />
            <AppButton compact variant="secondary" label={eventLink ? '✓ Calendar' : '+ Calendar'} disabled={busy || !!eventLink} onPress={createCalendarEntry} />
            <AppButton compact variant="ghost" label={linkerOpen ? 'Hide existing' : 'Add existing'} onPress={() => setLinkerOpen((value) => !value)} />
          </View>

          {linkerOpen ? (
            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="bodySmall" tone="secondary">Things you can add</AppText>
              {candidates.filter((item) => !linkedKeys.has(`${item.type}:${item.id}`)).length === 0 ? <AppText tone="muted">Everything available is already part of this trip.</AppText> : candidates.filter((item) => !linkedKeys.has(`${item.type}:${item.id}`)).map((item) => {
                const presentation = typePresentation(item.type);
                return (
                  <View key={`${item.type}:${item.id}`} style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center', paddingVertical: 5 }}>
                    <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: theme.colors.elevatedBackground, alignItems: 'center', justifyContent: 'center' }}><AppIcon name={presentation.icon} size={17} color={theme.colors.textSecondary} /></View>
                    <View style={{ flex: 1, gap: 2 }}><AppText>{item.title}</AppText><AppText variant="caption" tone="muted">{presentation.label} · {item.subtitle}</AppText></View>
                    <AppButton compact variant="ghost" label="Add" onPress={() => void link(item.type, item.id)} />
                  </View>
                );
              })}
            </View>
          ) : null}

          {links.length ? (
            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="bodySmall" tone="secondary">Remove from this trip</AppText>
              {links.map((item) => <View key={`remove:${item.entity_type}:${item.entity_id}`} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}><AppText style={{ flex: 1 }} numberOfLines={1}>{item.title}</AppText><AppButton compact variant="ghost" label="Remove" onPress={() => void unlink(item)} /></View>)}
            </View>
          ) : <EmptyState icon="trip" title="Build the trip together" body="Add packing, a countdown, calendar dates, or a shared goal." />}
        </Card>
      ) : null}
    </AppScreen>
  );
}
