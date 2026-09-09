import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FormField } from '@/components/common/FormField';
import { ChoiceChips } from '@/components/common/ChoiceChips';
import { TimePickerField } from '@/components/common/TimePickerField';
import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';
import { EmptyState } from '@/components/common/EmptyState';
import { TagChip } from '@/components/common/TagChip';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { IconButton } from '@/components/common/IconButton';
import { createSchedule, deleteSchedule, getAvailabilityOverlaps, getSchedules, updateSchedule } from '@/services/backend/availability';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import type { AvailabilityOverlap, ScheduleKind, ScheduleWindow } from '@/types/database';

const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }
function timeToMinute(value: string) { const [h = 0, m = 0] = value.split(':').map(Number); return h * 60 + m; }
function minuteToTime(value: number) { const normalized = value % 1440; return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`; }
function formatWindow(start: number, end: number) { const f = (value: number) => new Date(2000, 0, 1, Math.floor(value % 1440 / 60), value % 60).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); return `${f(start)} – ${f(end)}${end <= start ? ' · next day' : ''}`; }
function localTime(iso: string, timezone?: string) { try { return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timezone }).format(new Date(iso)); } catch { return new Date(iso).toLocaleString(); } }

export default function AvailabilityScreen() {
  const theme = useAppTheme(); const { profile, partnerProfile, colorForUser } = useWorkspace();
  const [schedules, setSchedules] = useState<ScheduleWindow[]>([]); const [overlaps, setOverlaps] = useState<AvailabilityOverlap[]>([]); const [reason, setReason] = useState(''); const [open, setOpen] = useState(false); const [editing, setEditing] = useState<ScheduleWindow | null>(null); const [deleteTarget, setDeleteTarget] = useState<ScheduleWindow | null>(null);
  const [label, setLabel] = useState('Free time'); const [kind, setKind] = useState<ScheduleKind>('free'); const [day, setDay] = useState('6'); const [start, setStart] = useState('18:00'); const [end, setEnd] = useState('22:00');
  const refresh = useCallback(async () => { try { const [nextSchedules, availability] = await Promise.all([getSchedules(), getAvailabilityOverlaps()]); setSchedules(nextSchedules); setOverlaps(availability.overlaps); setReason(availability.reason ?? ''); } catch (error) { Alert.alert('Couldn’t load availability', messageFrom(error)); } }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]); useRealtimeRefresh('schedules', refresh);
  const mine = useMemo(() => schedules.filter((row) => row.user_id === profile?.id), [profile?.id, schedules]); const theirs = useMemo(() => schedules.filter((row) => row.user_id === partnerProfile?.id), [partnerProfile?.id, schedules]);
  function reset(close = true) { setEditing(null); setLabel('Free time'); setKind('free'); setDay('6'); setStart('18:00'); setEnd('22:00'); if (close) setOpen(false); }
  function beginEdit(item: ScheduleWindow) { setEditing(item); setLabel(item.label); setKind(item.kind); setDay(String(item.day_of_week)); setStart(minuteToTime(item.start_minute)); setEnd(minuteToTime(item.end_minute)); setOpen(true); }
  async function save() { const startMinute = timeToMinute(start); const rawEndMinute = timeToMinute(end); const endMinute = end === '00:00' ? 1440 : rawEndMinute; if (!label.trim() || endMinute === startMinute) { Alert.alert('Check the time', 'Add a label and choose different start and end times. Overnight windows are allowed.'); return; } try { const input = { label: label.trim(), kind, dayOfWeek: Number(day), startMinute, endMinute }; if (editing) await updateSchedule(editing.id, input); else await createSchedule(input); reset(); await refresh(); } catch (error) { Alert.alert('Couldn’t save schedule', messageFrom(error)); } }
  async function remove() { const item = deleteTarget; setDeleteTarget(null); if (!item) return; try { await deleteSchedule(item.id); await refresh(); } catch (error) { Alert.alert('Couldn’t delete schedule', messageFrom(error)); } }
  function openScheduleMenu(item: ScheduleWindow) { Alert.alert(item.label, 'Choose what to do.', [{ text: 'Edit time', onPress: () => beginEdit(item) }, { text: 'Delete time', style: 'destructive', onPress: () => setDeleteTarget(item) }, { text: 'Cancel', style: 'cancel' }]); }
  const scheduleCard = (item: ScheduleWindow, editable: boolean) => <Card key={item.id} participantColor={colorForUser(item.user_id)} style={{ gap: theme.spacing.sm }}><View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }}><View style={{ flex: 1, gap: 3 }}><AppText variant="cardTitle">{item.label}</AppText><AppText variant="bodySmall" tone="secondary">{days[item.day_of_week]} · {formatWindow(item.start_minute, item.end_minute)}</AppText><TagChip subtle label={item.kind.toUpperCase()} /></View>{editable ? <IconButton icon="overflow" label={`More actions for ${item.label}`} onPress={() => openScheduleMenu(item)} /> : null}</View></Card>;
  return <AppScreen>
    <BackHeader eyebrow="Plan" title="When are we both free?" subtitle="Add the parts of your usual week that are free, busy, work or sleep. Togetherly finds the overlap." />
    <Card participantColor="both" style={{ gap: theme.spacing.md, marginBottom: theme.spacing.xxl }}><AppText variant="caption" tone="secondary">NEXT FREE TOGETHER</AppText>{overlaps.length ? overlaps.slice(0, 3).map((slot, index) => <View key={slot.startAt} style={{ gap: 3, paddingTop: index ? theme.spacing.sm : 0, borderTopWidth: index ? 1 : 0, borderColor: theme.colors.border }}><AppText variant="cardTitle">{Math.floor(slot.durationMinutes / 60)}h {slot.durationMinutes % 60 ? `${slot.durationMinutes % 60}m` : ''} together</AppText><AppText variant="bodySmall" tone="secondary">{profile?.display_name}: {localTime(slot.startAt, profile?.timezone)} → {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: profile?.timezone }).format(new Date(slot.endAt))}</AppText>{partnerProfile ? <AppText variant="bodySmall" tone="secondary">{partnerProfile.display_name}: {localTime(slot.startAt, partnerProfile.timezone)} → {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: partnerProfile.timezone }).format(new Date(slot.endAt))}</AppText> : null}<AppButton compact label="Plan something here" onPress={() => router.push(`/features/date-plans?startAt=${encodeURIComponent(slot.startAt)}&endAt=${encodeURIComponent(slot.endAt)}` as never)} /></View>) : <AppText tone="secondary">{reason || 'No time you’re both free showed up in the next two weeks.'}</AppText>}</Card>
    <CollapsibleComposer title={editing ? 'Edit this time' : 'My usual week'} subtitle="The times that usually repeat each week" open={open} actionLabel="Add time" closeLabel={editing ? 'Cancel edit' : 'Close'} tone="accent" style={{ marginBottom: theme.spacing.xxl }} onToggle={() => open ? reset() : setOpen(true)}><FormField label="LABEL" value={label} onChangeText={setLabel} placeholder="After work" /><View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">TYPE</AppText><ChoiceChips value={kind} onChange={setKind} options={[{ value: 'free', label: 'Free' }, { value: 'work', label: 'Work' }, { value: 'sleep', label: 'Sleep' }, { value: 'busy', label: 'Busy' }]} /></View><View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">DAY</AppText><ChoiceChips value={day} onChange={setDay} options={days.map((name, index) => ({ value: String(index), label: name }))} /></View><View style={{ flexDirection: 'row', gap: theme.spacing.sm }}><View style={{ flex: 1 }}><TimePickerField label="START" value={start} onChange={setStart} /></View><View style={{ flex: 1 }}><TimePickerField label="END" value={end} onChange={setEnd} /></View></View><AppButton label={editing ? 'Save changes' : 'Add time'} disabled={!label.trim()} onPress={save} /></CollapsibleComposer>
    <AppText variant="section" style={{ marginBottom: theme.spacing.md }}>{profile?.display_name ?? 'My'} schedule</AppText><View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.xxl }}>{mine.length ? mine.map((item) => scheduleCard(item, true)) : <EmptyState icon="availability" title="Add your usual free time" body="Start with one Free time. Work, Sleep and Busy times can narrow it down from there." actionLabel="Add time" onAction={() => setOpen(true)} />}</View>
    {partnerProfile ? <><AppText variant="section" style={{ marginBottom: theme.spacing.md }}>{partnerProfile.display_name}’s schedule</AppText><View style={{ gap: theme.spacing.md }}>{theirs.length ? theirs.map((item) => scheduleCard(item, false)) : <Card tone="secondary"><AppText tone="secondary">{partnerProfile.display_name} hasn’t added their usual times yet.</AppText></Card>}</View></> : null}
    <ConfirmDialog visible={!!deleteTarget} title="Delete this time?" body={deleteTarget ? `Delete “${deleteTarget.label}”?` : ''} onCancel={() => setDeleteTarget(null)} onConfirm={() => remove().catch(() => undefined)} />
  </AppScreen>;
}
