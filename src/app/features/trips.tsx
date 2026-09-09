import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FormField } from '@/components/common/FormField';
import { TagChip } from '@/components/common/TagChip';
import { TagSelector } from '@/components/common/TagSelector';
import { EmptyState } from '@/components/common/EmptyState';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';
import { DatePickerField } from '@/components/common/DatePickerField';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { IconButton } from '@/components/common/IconButton';
import { AppIcon } from '@/components/art/AppIcon';
import { createTrip, deleteTrip, getTags, getTrips, updateTrip } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import type { CoupleTrip, Tag } from '@/types/database';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }

export default function TripsScreen() {
  const theme = useAppTheme(); const params = useLocalSearchParams<{ focus?: string }>(); const { colorForUser } = useWorkspace();
  const [trips, setTrips] = useState<CoupleTrip[]>([]); const [tags, setTags] = useState<Tag[]>([]); const [title, setTitle] = useState(''); const [destination, setDestination] = useState(''); const [startDate, setStartDate] = useState(''); const [endDate, setEndDate] = useState(''); const [notes, setNotes] = useState(''); const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [composerOpen, setComposerOpen] = useState(false); const [busy, setBusy] = useState(false); const [editingId, setEditingId] = useState<string | null>(null); const [deleteTarget, setDeleteTarget] = useState<CoupleTrip | null>(null); const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => { try { const [nextTrips, nextTags] = await Promise.all([getTrips(), getTags()]); setTrips(nextTrips); setTags(nextTags); } catch (error) { Alert.alert('Couldn’t load trips', messageFrom(error)); } finally { setLoading(false); } }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]); useRealtimeRefresh('trips', refresh); useRealtimeRefresh('tags', refresh);
  function resetForm(close = true) { setEditingId(null); setTitle(''); setDestination(''); setStartDate(''); setEndDate(''); setNotes(''); setSelectedTags([]); if (close) setComposerOpen(false); }
  function beginEdit(trip: CoupleTrip) { setEditingId(trip.id); setTitle(trip.title); setDestination(trip.destination ?? ''); setStartDate(trip.start_date ?? ''); setEndDate(trip.end_date ?? ''); setNotes(trip.notes ?? ''); setSelectedTags((trip.tags ?? []).map((tag) => tag.id)); setComposerOpen(true); }
  useEffect(() => { if (!params.focus || editingId === params.focus || !trips.length) return; const focused = trips.find((trip) => trip.id === params.focus); if (focused) beginEdit(focused); }, [params.focus, trips]);
  async function save() { if (!title.trim()) return; if (startDate && endDate && endDate < startDate) { Alert.alert('Check the trip', 'End date cannot be before start date.'); return; } setBusy(true); try { const input = { title: title.trim(), destination, startDate: startDate || null, endDate: endDate || null, notes, tagIds: selectedTags }; if (editingId) await updateTrip(editingId, input); else await createTrip(input); resetForm(); await refresh(); } catch (error) { Alert.alert(editingId ? 'Couldn’t update trip' : 'Couldn’t create trip', messageFrom(error)); } finally { setBusy(false); } }
  async function removeConfirmed() { const target = deleteTarget; setDeleteTarget(null); if (!target) return; try { await deleteTrip(target.id); setTrips((current) => current.filter((trip) => trip.id !== target.id)); if (editingId === target.id) resetForm(); } catch (error) { Alert.alert('Couldn’t delete trip', messageFrom(error)); } }
  function openTripMenu(trip: CoupleTrip) {
    Alert.alert(trip.title, 'Manage this trip', [
      { text: 'Edit trip', onPress: () => beginEdit(trip) },
      { text: 'Delete trip', style: 'destructive', onPress: () => setDeleteTarget(trip) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }
  return <AppScreen>
    <BackHeader eyebrow="Plan" title="Trips" subtitle="Travel plans, dates and linked details." />
    <CollapsibleComposer title={editingId ? 'Edit trip' : 'Our trips'} subtitle={`${trips.length} planned or saved`} open={composerOpen} actionLabel="New trip" closeLabel={editingId ? 'Cancel edit' : 'Close'} tone="accent" style={{ marginBottom: theme.spacing.xxl }} onToggle={() => composerOpen ? resetForm() : setComposerOpen(true)}>
      <FormField label="TRIP NAME" value={title} onChangeText={setTitle} placeholder="October visit" /><FormField label="DESTINATION" value={destination} onChangeText={setDestination} placeholder="Chicago, IL" /><DatePickerField label="START · OPTIONAL" value={startDate} onChange={setStartDate} optional /><DatePickerField label="END · OPTIONAL" value={endDate} onChange={setEndDate} optional minimumDate={startDate || undefined} /><FormField label="NOTES" value={notes} onChangeText={setNotes} multiline placeholder="Flights, hotel, ideas, things to remember…" /><TagSelector tags={tags} selectedIds={selectedTags} onChange={setSelectedTags} /><AppButton label={busy ? 'Saving…' : editingId ? 'Save trip' : 'Create trip'} disabled={busy || !title.trim()} onPress={save} />
    </CollapsibleComposer>
    {/* F2_EMPTY_STATE_COACHING: trip empties suggest the smallest useful planning record. */}
    <View style={{ gap: theme.spacing.md }}>{loading ? <AppText tone="muted">Loading trips…</AppText> : null}{!loading && trips.length === 0 ? <EmptyState icon="trip" eyebrow="PUT THE NEXT PLACE ON THE MAP" title="No trips planned yet" body="Create a visit, weekend away, or future holiday." tip="You only need a name to start. Add dates, flights, hotel details and planning items when they become real." actionLabel="Plan a trip" onAction={() => setComposerOpen(true)} /> : null}{trips.map((trip) => <Card key={trip.id} participantColor="both" style={{ gap: theme.spacing.sm, borderColor: editingId === trip.id ? theme.colors.accent : theme.colors.border }}><View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' }}><Pressable accessibilityRole="button" onPress={() => router.push(`/features/trip-detail?id=${encodeURIComponent(trip.id)}` as never)} style={{ flex: 1, gap: 8 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><View style={{ flex: 1, gap: 5 }}><AppText variant="cardTitle">{trip.title}</AppText><ParticipantAttribution userId={trip.creator_id} />{trip.destination ? <AppText tone="secondary">{trip.destination}</AppText> : null}</View><AppIcon name="chevron" size={16} color={theme.colors.textMuted} /></View>{trip.notes ? <AppText variant="bodySmall" tone="secondary" numberOfLines={2}>{trip.notes}</AppText> : null}<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{trip.start_date ? <TagChip subtle label={trip.end_date ? `${trip.start_date} → ${trip.end_date}` : trip.start_date} /> : null}{trip.link_count ? <TagChip subtle label={`${trip.link_count} PLANNING ITEMS`} /> : null}{(trip.tags ?? []).slice(0, 3).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}</View></Pressable><IconButton icon="overflow" label={`More actions for ${trip.title}`} onPress={() => openTripMenu(trip)} /></View></Card>)}</View>
    <ConfirmDialog visible={!!deleteTarget} title="Delete trip?" body={deleteTarget ? `Delete “${deleteTarget.title}”?` : ''} onCancel={() => setDeleteTarget(null)} onConfirm={() => removeConfirmed().catch(() => undefined)} />
  </AppScreen>;
}
