import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
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

export default function TripDetailScreen() {
  const theme = useAppTheme(); const { id } = useLocalSearchParams<{ id?: string }>(); const { colorForUser } = useWorkspace();
  const [trip, setTrip] = useState<CoupleTrip | null>(null); const [links, setLinks] = useState<TripLink[]>([]); const [lists, setLists] = useState<CoupleList[]>([]); const [goals, setGoals] = useState<CoupleGoal[]>([]); const [countdowns, setCountdowns] = useState<CoupleCountdown[]>([]); const [events, setEvents] = useState<CoupleEvent[]>([]); const [linkerOpen, setLinkerOpen] = useState(false); const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => { if (!id) return; try { const [detail, nextLists, nextGoals, nextCountdowns, nextEvents] = await Promise.all([getTrip(id), getLists(), getGoals(), getCountdowns(), getEvents()]); setTrip(detail.trip); setLinks(detail.links); setLists(nextLists); setGoals(nextGoals); setCountdowns(nextCountdowns); setEvents(nextEvents); } catch (error) { Alert.alert('Couldn’t load trip', messageFrom(error)); } }, [id]);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]); useRealtimeRefresh('trips', refresh); useRealtimeRefresh('lists', refresh); useRealtimeRefresh('goals', refresh); useRealtimeRefresh('countdowns', refresh); useRealtimeRefresh('events', refresh);
  const linkedKeys = useMemo(() => new Set(links.map((link) => `${link.entity_type}:${link.entity_id}`)), [links]);
  const candidates: Array<{ type: TripLinkType; id: string; title: string; subtitle: string }> = [
    ...lists.map((item) => ({ type: 'list' as const, id: item.id, title: item.title, subtitle: `${item.item_count ?? 0} items` })),
    ...goals.map((item) => ({ type: 'goal' as const, id: item.id, title: item.title, subtitle: `${item.current_value} / ${item.target_value}${item.unit ? ` ${item.unit}` : ''}` })),
    ...countdowns.map((item) => ({ type: 'countdown' as const, id: item.id, title: item.title, subtitle: dateOnlyFromIso(item.target_at) || new Date(item.target_at).toLocaleDateString() })),
    ...events.map((item) => ({ type: 'event' as const, id: item.id, title: item.title, subtitle: new Date(item.start_at).toLocaleString() })),
  ];
  async function link(type: TripLinkType, entityId: string) { if (!id) return; try { await linkTripItem(id, type, entityId); await refresh(); } catch (error) { Alert.alert('Couldn’t link item', messageFrom(error)); } }
  async function unlink(item: TripLink) { if (!id) return; try { await unlinkTripItem(id, item.entity_type, item.entity_id); await refresh(); } catch (error) { Alert.alert('Couldn’t unlink item', messageFrom(error)); } }
  async function createPacking() { if (!trip || !id) return; if (links.some((item) => item.entity_type === 'list')) { Alert.alert('Packing list already linked', 'Open the linked list below, or use Link existing if this trip needs another list.'); return; } setBusy(true); try { const list = await createList(`${trip.title} packing`); await linkTripItem(id, 'list', list.id); await refresh(); } catch (error) { Alert.alert('Couldn’t create packing list', messageFrom(error)); } finally { setBusy(false); } }
  async function createTripCountdown() { if (links.some((item) => item.entity_type === 'countdown')) { Alert.alert('Countdown already linked', 'Open the linked countdown below if you want to change it.'); return; } if (!trip?.start_date || !id) { Alert.alert('Add trip dates first', 'Set a start date before creating a trip countdown.'); return; } setBusy(true); try { const targetAt = targetIso(trip.start_date); const now = new Date().toISOString(); const countdown = await createCountdown({ title: `${trip.title} begins`, targetAt, startAt: new Date(now).getTime() < new Date(targetAt).getTime() ? now : null, type: 'visit' }); await linkTripItem(id, 'countdown', countdown.id, true); await refresh(); } catch (error) { Alert.alert('Could not create countdown', messageFrom(error)); } finally { setBusy(false); } }
  async function createCalendarEntry() { if (links.some((item) => item.entity_type === 'event')) { Alert.alert('Calendar dates already linked', 'Open the linked event below if you want to change it.'); return; } if (!trip?.start_date || !id) { Alert.alert('Add trip dates first', 'Set a start date before adding the trip to the calendar.'); return; } setBusy(true); try { const event = await createEvent({ title: trip.title, description: trip.notes, startAt: targetIso(trip.start_date), endAt: trip.end_date ? targetIso(trip.end_date) : null, startDate: trip.start_date, endDate: trip.end_date, allDay: true, location: trip.destination, assignee: 'both' }); await linkTripItem(id, 'event', event.id, true); await refresh(); } catch (error) { Alert.alert('Couldn’t add calendar entry', messageFrom(error)); } finally { setBusy(false); } }

  if (!trip) return <AppScreen><BackHeader eyebrow="Trip" title="Loading…" /><AppText tone="muted">Loading trip plan…</AppText></AppScreen>;
  return <AppScreen>
    <BackHeader eyebrow="Trip planner" title={trip.title} subtitle={trip.destination || 'Shared trip plan'} />
    <Card participantColor={colorForUser(trip.creator_id)} style={{ gap: theme.spacing.md, marginBottom: theme.spacing.lg }}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{trip.start_date ? <TagChip label={trip.end_date ? `${trip.start_date} → ${trip.end_date}` : trip.start_date} /> : <TagChip subtle label="DATES NOT SET" />}{(trip.tags ?? []).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}</View>{trip.notes ? <AppText tone="secondary">{trip.notes}</AppText> : null}<AppButton compact variant="ghost" label="Edit trip details" onPress={() => router.push(`/features/trips?focus=${encodeURIComponent(trip.id)}` as never)} /></Card>

    <Card tone="accent" style={{ gap: theme.spacing.md, marginBottom: theme.spacing.xxl }}><AppText variant="section">Quick setup</AppText><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><AppButton compact variant="secondary" label={links.some((item) => item.entity_type === 'list') ? "✓ Packing list" : "＋ Packing list"} disabled={busy || links.some((item) => item.entity_type === 'list')} onPress={createPacking} /><AppButton compact variant="secondary" label={links.some((item) => item.entity_type === 'countdown') ? "✓ Countdown" : "＋ Countdown"} disabled={busy || links.some((item) => item.entity_type === 'countdown')} onPress={createTripCountdown} /><AppButton compact variant="secondary" label={links.some((item) => item.entity_type === 'event') ? "✓ Calendar dates" : "＋ Calendar dates"} disabled={busy || links.some((item) => item.entity_type === 'event')} onPress={createCalendarEntry} /></View></Card>

    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md }}><View><AppText variant="section">Trip plan</AppText><AppText variant="bodySmall" tone="secondary">{links.length} linked items</AppText></View><AppButton compact variant="secondary" label={linkerOpen ? 'Done' : 'Link existing'} onPress={() => setLinkerOpen((value) => !value)} /></View>
    {linkerOpen ? <Card tone="secondary" style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xxl }}><AppText variant="caption" tone="secondary">AVAILABLE TO LINK</AppText>{candidates.filter((item) => !linkedKeys.has(`${item.type}:${item.id}`)).length === 0 ? <AppText tone="muted">Everything available is already linked.</AppText> : candidates.filter((item) => !linkedKeys.has(`${item.type}:${item.id}`)).map((item) => <View key={`${item.type}:${item.id}`} style={{ flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 5 }}><View style={{ flex: 1 }}><AppText>{item.title}</AppText><AppText variant="caption" tone="muted">{item.type.toUpperCase()} · {item.subtitle}</AppText></View><AppButton compact variant="ghost" label="Link" onPress={() => link(item.type, item.id)} /></View>)}</Card> : null}
    <View style={{ gap: theme.spacing.md }}>{links.length === 0 ? <EmptyState icon="trip" title="Your trip plan is ready to build" body="Create a packing list, countdown, calendar entry, or link an existing goal." /> : links.map((item) => <Card key={`${item.entity_type}:${item.entity_id}`} participantColor="both" style={{ gap: theme.spacing.sm }}><Pressable accessibilityRole="button" onPress={() => router.push(linkHref(item) as never)} style={{ gap: 5 }}><AppText variant="caption" tone="secondary">{item.entity_type.toUpperCase()}{item.managed_by_trip ? ' · SYNCED TO TRIP' : ''}</AppText><AppText variant="cardTitle">{item.title}</AppText>{item.subtitle ? <AppText variant="bodySmall" tone="muted">{item.subtitle}</AppText> : null}</Pressable><View style={{ flexDirection: 'row', gap: 8 }}><AppButton compact variant="ghost" label="Open" onPress={() => router.push(linkHref(item) as never)} /><AppButton compact variant="ghost" label="Unlink" onPress={() => unlink(item)} /></View></Card>)}</View>
  </AppScreen>;
}
