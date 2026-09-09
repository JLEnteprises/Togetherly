import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
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
import { ParticipantIdentityBadge } from '@/components/common/ParticipantIdentityBadge';
import { ComposerSheet } from '@/components/common/ComposerSheet';
import { RecordViewSheet } from '@/components/common/RecordViewSheet';
import { DatePickerField } from '@/components/common/DatePickerField';
import { TimePickerField } from '@/components/common/TimePickerField';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { IconButton } from '@/components/common/IconButton';
import { AppIcon } from '@/components/art/AppIcon';
import { createEvent, deleteEvent, getEvents, getTags, updateActivity, updateEvent } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import { participantPalettes, participantPalette } from '@/theme/tokens';
import { expandEvents, localDateKey, monthBounds, monthGrid, type EventOccurrence } from '@/utils/calendar';
import { localDateTimeInputFromIso, parseLocalDateTimeInput } from '@/utils/dates';
import type { CoupleEvent, EventRecurrence, Tag } from '@/types/database';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }
function occurrenceTime(occurrence: EventOccurrence) {
  if (occurrence.event.all_day) return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(occurrence.start) + ' · All day';
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(occurrence.start);
}
function splitDateTime(value: string | null | undefined) {
  const local = localDateTimeInputFromIso(value); const [date = '', time = '19:00'] = local.split(' '); return { date, time: time || '19:00' };
}
function combineDateTime(date: string, time: string, allDay: boolean) { return parseLocalDateTimeInput(`${date} ${allDay ? '12:00' : time}`); }

// G6_COMPOSER_SHEETS: major create/edit flow uses the explicit shared ComposerSheet primitive.
export default function CalendarScreen() {
  const theme = useAppTheme(); const params = useLocalSearchParams<{ focus?: string; edit?: string; prefillTitle?: string; prefillDescription?: string; prefillDuration?: string; sourceActivityId?: string }>(); const { colorForUser, profile, partnerProfile } = useWorkspace();
  const [events, setEvents] = useState<CoupleEvent[]>([]); const [tags, setTags] = useState<Tag[]>([]);
  const [title, setTitle] = useState(''); const [description, setDescription] = useState(''); const [startDate, setStartDate] = useState(''); const [startTime, setStartTime] = useState('19:00'); const [endDate, setEndDate] = useState(''); const [endTime, setEndTime] = useState('20:00'); const [location, setLocation] = useState('');
  const [allDay, setAllDay] = useState(false); const [assignee, setAssignee] = useState<'me' | 'partner' | 'both'>('both'); const [recurrence, setRecurrence] = useState<EventRecurrence>('none'); const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [calendarView, setCalendarView] = useState<'month' | 'week' | 'agenda'>('month'); const [monthAnchor, setMonthAnchor] = useState(() => new Date()); const [selectedDay, setSelectedDay] = useState(() => localDateKey(new Date()));
  const [composerOpen, setComposerOpen] = useState(false); const [viewTarget, setViewTarget] = useState<CoupleEvent | null>(null); const [prefillApplied, setPrefillApplied] = useState(false); const [advancedOpen, setAdvancedOpen] = useState(false); const [busy, setBusy] = useState(false); const [editingId, setEditingId] = useState<string | null>(null); const [deleteTarget, setDeleteTarget] = useState<CoupleEvent | null>(null); const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => { try { const [nextEvents, nextTags] = await Promise.all([getEvents(), getTags()]); setEvents(nextEvents); setTags(nextTags); } catch (error) { Alert.alert('Couldn’t load calendar', messageFrom(error)); } finally { setLoading(false); } }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]); useRealtimeRefresh('events', refresh); useRealtimeRefresh('tags', refresh);

  const bounds = useMemo(() => monthBounds(monthAnchor), [monthAnchor]); const gridDates = useMemo(() => monthGrid(monthAnchor), [monthAnchor]); const monthOccurrences = useMemo(() => expandEvents(events, bounds.gridStart, bounds.gridEnd), [events, bounds.gridEnd, bounds.gridStart]);
  const byDay = useMemo(() => {
    const map = new Map<string, EventOccurrence[]>();
    const add = (key: string, occurrence: EventOccurrence) => { const current = map.get(key) ?? []; current.push(occurrence); map.set(key, current); };
    for (const occurrence of monthOccurrences) {
      add(localDateKey(occurrence.start), occurrence);
      if (occurrence.event.all_day && occurrence.end) {
        const cursor = new Date(occurrence.start); cursor.setDate(cursor.getDate() + 1);
        while (cursor.getTime() <= occurrence.end.getTime()) { add(localDateKey(cursor), occurrence); cursor.setDate(cursor.getDate() + 1); }
      }
    }
    return map;
  }, [monthOccurrences]);
  const selectedOccurrences = byDay.get(selectedDay) ?? [];
  const agenda = useMemo(() => expandEvents(events, new Date(Date.now() - 86_400_000), new Date(Date.now() + 366 * 86_400_000)), [events]);
  const weekStart = useMemo(() => { const d = new Date(`${selectedDay}T12:00:00`); d.setDate(d.getDate() - d.getDay()); d.setHours(0,0,0,0); return d; }, [selectedDay]);
  const weekEnd = useMemo(() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); return d; }, [weekStart]);
  const weekOccurrences = useMemo(() => expandEvents(events, weekStart, weekEnd), [events, weekEnd, weekStart]);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, index) => { const d = new Date(weekStart); d.setDate(d.getDate() + index); return d; }), [weekStart]);

  function resetForm(close = true) { setEditingId(null); setTitle(''); setDescription(''); setStartDate(''); setStartTime('19:00'); setEndDate(''); setEndTime('20:00'); setLocation(''); setAllDay(false); setRecurrence('none'); setAssignee('both'); setSelectedTags([]); setAdvancedOpen(false); if (close) setComposerOpen(false); }
  function beginEdit(event: CoupleEvent) { const start = splitDateTime(event.start_at); const end = splitDateTime(event.end_at); setEditingId(event.id); setTitle(event.title); setDescription(event.description ?? ''); setStartDate(event.all_day && event.start_date ? event.start_date : start.date); setStartTime(start.time); setEndDate(event.all_day && event.end_date ? event.end_date : event.end_at ? end.date : ''); setEndTime(end.time); setLocation(event.location ?? ''); setAllDay(Boolean(event.all_day)); setRecurrence(event.recurrence); setAssignee(event.assign_to_both ? 'both' : event.assigned_user_id === profile?.id ? 'me' : 'partner'); setSelectedTags((event.tags ?? []).map((tag) => tag.id)); setAdvancedOpen(true); setComposerOpen(true); }
  useEffect(() => { if (!params.focus || !events.length) return; const focused = events.find((event) => event.id === params.focus); if (focused) setViewTarget(focused); }, [params.focus, events]);
  useEffect(() => { if (!params.edit || editingId === params.edit || !events.length) return; const target = events.find((event) => event.id === params.edit); if (target) beginEdit(target); }, [params.edit, editingId, events]);
  useEffect(() => {
    if (prefillApplied || !params.prefillTitle || params.focus) return;
    const now = new Date(); const dateKey = localDateKey(now); const duration = Math.max(15, Number(params.prefillDuration) || 120); const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0 + duration);
    setTitle(params.prefillTitle); setDescription(params.prefillDescription ?? ''); setStartDate(dateKey); setStartTime('19:00'); setEndDate(dateKey); setEndTime(`${String(end.getHours()).padStart(2,'0')}:${String(end.getMinutes()).padStart(2,'0')}`); setAdvancedOpen(true); setComposerOpen(true); setPrefillApplied(true);
  }, [params.focus, params.prefillDescription, params.prefillDuration, params.prefillTitle, prefillApplied]);

  async function save() {
    const startAt = startDate ? combineDateTime(startDate, startTime, allDay) : null;
    if (!title.trim() || !startAt) { Alert.alert('Check the event', 'Add a title and choose a start date.'); return; }
    const effectiveEndDate = endDate || (allDay ? startDate : ''); const endAt = effectiveEndDate ? combineDateTime(effectiveEndDate, endTime, allDay) : null;
    if (endAt && new Date(endAt).getTime() < new Date(startAt).getTime()) { Alert.alert('Check the event', 'End cannot be before start.'); return; }
    setBusy(true);
    try { const input = { title: title.trim(), description, startAt, endAt, startDate: allDay ? startDate : null, endDate: allDay ? (endDate || null) : null, allDay, location, recurrence, assignee, tagIds: selectedTags }; if (editingId) await updateEvent(editingId, input); else { await createEvent(input); if (params.sourceActivityId) await updateActivity(params.sourceActivityId, { status: 'planned' }).catch(() => undefined); } resetForm(); await refresh(); }
    catch (error) { Alert.alert(editingId ? 'Couldn’t update event' : 'Couldn’t add event', messageFrom(error)); } finally { setBusy(false); }
  }
  async function removeConfirmed() { const target = deleteTarget; setDeleteTarget(null); if (!target) return; try { await deleteEvent(target.id); setEvents((current) => current.filter((event) => event.id !== target.id)); if (editingId === target.id) resetForm(); } catch (error) { Alert.alert('Couldn’t delete event', messageFrom(error)); } }
  function openEventMenu(event: CoupleEvent) { Alert.alert(event.title, 'Manage this event', [{ text: 'Edit event', onPress: () => beginEdit(event) }, { text: 'Delete event', style: 'destructive', onPress: () => setDeleteTarget(event) }, { text: 'Cancel', style: 'cancel' }]); }
  function shiftMonth(amount: number) { const next = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + amount, 1); setMonthAnchor(next); setSelectedDay(localDateKey(next)); }

  const renderOccurrence = (occurrence: EventOccurrence) => { const event = occurrence.event; const eventIdentity = event.assign_to_both ? 'both' : colorForUser(event.assigned_user_id); return <Card key={occurrence.key} participantColor={eventIdentity} style={{ gap: theme.spacing.sm }}><View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' }}><Pressable accessibilityRole="button" onPress={() => setViewTarget(event)} style={{ flex: 1, gap: 5 }}><AppText variant="caption" tone="secondary">{occurrenceTime(occurrence).toUpperCase()}</AppText><AppText variant="cardTitle">{event.title}</AppText><ParticipantAttribution userId={event.creator_id} />{event.description ? <AppText variant="bodySmall" tone="secondary" numberOfLines={2}>{event.description}</AppText> : null}<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}><ParticipantIdentityBadge both={event.assign_to_both} userId={event.assigned_user_id} compact />{event.location ? <TagChip subtle label={event.location.toUpperCase()} /> : null}{event.recurrence !== 'none' ? <TagChip subtle label={`↻ ${event.recurrence.toUpperCase()}`} /> : null}{(event.tags ?? []).slice(0, 3).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}</View></Pressable><IconButton icon="overflow" label={`More actions for ${event.title}`} onPress={() => openEventMenu(event)} /></View></Card>; };

  return <AppScreen>
    <BackHeader eyebrow="Plan" title="Calendar" subtitle="Plans, dates and events." />
    <ComposerSheet title={editingId ? 'Edit event' : 'Calendar'} subtitle={editingId ? 'Update this event.' : 'Month, week and agenda views for everything you plan together.'} open={composerOpen} actionLabel="New event" closeLabel={editingId ? 'Cancel edit' : 'Close'} tone="accent" style={{ marginBottom: theme.spacing.lg }} onToggle={() => composerOpen ? resetForm() : setComposerOpen(true)}>
      <FormField label="TITLE" value={title} onChangeText={setTitle} placeholder="Game night" />
      <DatePickerField label="START DATE" value={startDate} onChange={setStartDate} />
      {!allDay ? <TimePickerField label="START TIME" value={startTime} onChange={setStartTime} /> : null}
      <ToggleRow label="All-day event" value={allDay} onChange={setAllDay} />
      <Pressable accessibilityRole="button" onPress={() => setAdvancedOpen((value) => !value)} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><AppText variant="bodySmall" tone="accent">{advancedOpen ? 'Hide options' : 'More options'}</AppText><AppIcon name={advancedOpen ? 'chevronUp' : 'chevronDown'} size={15} color={theme.colors.textMuted} /></Pressable>
      {advancedOpen ? <View style={{ gap: theme.spacing.lg }}><FormField label="DESCRIPTION · OPTIONAL" value={description} onChangeText={setDescription} placeholder="What you need to remember…" multiline /><DatePickerField label="END DATE · OPTIONAL" value={endDate} onChange={setEndDate} optional minimumDate={startDate || undefined} />{!allDay && endDate ? <TimePickerField label="END TIME" value={endTime} onChange={setEndTime} /> : null}<FormField label="LOCATION · OPTIONAL" value={location} onChangeText={setLocation} placeholder="Discord, Chicago, home…" /><View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">FOR</AppText><ChoiceChips value={assignee} onChange={setAssignee} options={[{ value: 'both', label: 'Both' }, { value: 'me', label: profile?.display_name ?? 'My account' }, ...(partnerProfile ? [{ value: 'partner' as const, label: partnerProfile.display_name }] : [])]} /></View><View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">REPEAT</AppText><ChoiceChips value={recurrence} onChange={setRecurrence} options={[{ value: 'none', label: 'Once' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }]} /></View><TagSelector tags={tags} selectedIds={selectedTags} onChange={setSelectedTags} /></View> : null}
      <AppButton label={busy ? 'Saving…' : editingId ? 'Save event' : 'Add event'} disabled={busy || !title.trim() || !startDate} onPress={save} />
    </ComposerSheet>

    <View style={{ gap: theme.spacing.md }}>
      <ChoiceChips value={calendarView} onChange={setCalendarView} options={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }, { value: 'agenda', label: 'Agenda' }]} />
      {loading ? <AppText tone="muted">Loading calendar…</AppText> : null}
      {!loading && calendarView === 'month' ? <><Card style={{ gap: theme.spacing.md }}><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><IconButton icon="back" label="Previous month" tone="accent" onPress={() => shiftMonth(-1)} /><AppText variant="section">{new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(monthAnchor)}</AppText><IconButton icon="chevron" label="Next month" tone="accent" onPress={() => shiftMonth(1)} /></View><View style={{ flexDirection: 'row' }}>{['S','M','T','W','T','F','S'].map((day, index) => <View key={`${day}-${index}`} style={{ flex: 1, alignItems: 'center' }}><AppText variant="caption" tone="muted">{day}</AppText></View>)}</View><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{gridDates.map((day) => { const key = localDateKey(day); const dayEvents = byDay.get(key) ?? []; const inMonth = day.getMonth() === monthAnchor.getMonth(); const selected = key === selectedDay; const today = key === localDateKey(new Date()); return <Pressable accessibilityRole="button" key={key} onPress={() => setSelectedDay(key)} style={{ width: '14.2857%', minHeight: 58, padding: 5, borderRadius: 12, backgroundColor: selected ? theme.colors.accentSoft : 'transparent', opacity: inMonth ? 1 : 0.35 }}><AppText variant="bodySmall" tone={today ? 'accent' : 'secondary'}>{day.getDate()}</AppText><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginTop: 6 }}>{dayEvents.slice(0, 3).map((occurrence) => <View key={occurrence.key} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: (() => { const owner = colorForUser(occurrence.event.creator_id); return owner === 'both' ? theme.colors.textMuted : participantPalette(owner).accent; })() }} />)}{dayEvents.length > 3 ? <AppText variant="caption" tone="muted">+{dayEvents.length - 3}</AppText> : null}</View></Pressable>; })}</View></Card><AppText variant="section">{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${selectedDay}T12:00:00`))}</AppText>{selectedOccurrences.length ? selectedOccurrences.map(renderOccurrence) : <EmptyState icon="calendar" title="Nothing planned this day" body="Pick another day or add something." actionLabel="Add an event" onAction={() => setComposerOpen(true)} />}</> : null}
      {!loading && calendarView === 'week' ? <><Card style={{ gap: theme.spacing.md }}><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><IconButton icon="back" label="Previous week" tone="accent" onPress={() => { const d = new Date(`${selectedDay}T12:00:00`); d.setDate(d.getDate() - 7); setSelectedDay(localDateKey(d)); }} /><AppText variant="section">Week of {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(weekStart)}</AppText><IconButton icon="chevron" label="Next week" tone="accent" onPress={() => { const d = new Date(`${selectedDay}T12:00:00`); d.setDate(d.getDate() + 7); setSelectedDay(localDateKey(d)); }} /></View><View style={{ flexDirection: 'row', gap: 5 }}>{weekDates.map((day) => { const key = localDateKey(day); const count = weekOccurrences.filter((item) => localDateKey(item.start) === key).length; const active = key === selectedDay; return <Pressable accessibilityRole="button" key={key} onPress={() => setSelectedDay(key)} style={{ flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center', backgroundColor: active ? theme.colors.accentSoft : theme.colors.elevatedBackground }}><AppText variant="caption" tone={active ? 'accent' : 'muted'}>{new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(day)}</AppText><AppText variant="cardTitle">{day.getDate()}</AppText>{count ? <AppText variant="caption" tone="accent">{count}</AppText> : null}</Pressable>; })}</View></Card><AppText variant="section">{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${selectedDay}T12:00:00`))}</AppText>{weekOccurrences.filter((item) => localDateKey(item.start) === selectedDay).length ? weekOccurrences.filter((item) => localDateKey(item.start) === selectedDay).map(renderOccurrence) : <EmptyState icon="calendar" title="Nothing planned this day" body="Choose another day in the week or add an event." actionLabel="Add an event" onAction={() => setComposerOpen(true)} />}</> : null}
      {!loading && calendarView === 'agenda' ? <><AppText variant="section">Next 12 months</AppText>{agenda.length === 0 ? <EmptyState icon="calendar" title="Your calendar is clear" body="Add your first shared event." actionLabel="Add an event" onAction={() => setComposerOpen(true)} /> : agenda.map(renderOccurrence)}</> : null}
    </View>
    <RecordViewSheet visible={!!viewTarget} onClose={() => setViewTarget(null)} eyebrow="Calendar event" title={viewTarget?.title ?? ''}>
      {viewTarget ? <View style={{ gap: theme.spacing.md }}>
        <ParticipantIdentityBadge both={viewTarget.assign_to_both} userId={viewTarget.assigned_user_id} compact />
        <ParticipantAttribution userId={viewTarget.creator_id} />
        <AppText variant="cardTitle">{viewTarget.all_day ? (viewTarget.start_date ?? splitDateTime(viewTarget.start_at).date) : new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(viewTarget.start_at))}</AppText>
        {viewTarget.recurrence === 'none' && new Date(viewTarget.end_at || viewTarget.start_at).getTime() < Date.now() ? <AppButton label="Save a memory from this day" onPress={() => { const id = viewTarget.id; setViewTarget(null); router.push(`/features/memories?sourceEvent=${id}` as never); }} /> : null}
        {viewTarget.description ? <AppText tone="secondary">{viewTarget.description}</AppText> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {viewTarget.location ? <TagChip subtle label={viewTarget.location.toUpperCase()} /> : null}
          {viewTarget.all_day ? <TagChip subtle label="ALL DAY" /> : null}
          {viewTarget.recurrence !== 'none' ? <TagChip subtle label={`↻ ${viewTarget.recurrence.toUpperCase()}`} /> : null}
          {(viewTarget.tags ?? []).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}
        </View>
      </View> : null}
    </RecordViewSheet>
    <ConfirmDialog visible={!!deleteTarget} title="Delete event?" body={deleteTarget ? `Delete “${deleteTarget.title}”?` : ''} onCancel={() => setDeleteTarget(null)} onConfirm={() => removeConfirmed().catch(() => undefined)} />
  </AppScreen>;
}
