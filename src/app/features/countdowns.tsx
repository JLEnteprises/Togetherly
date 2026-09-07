import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { ChoiceChips } from '@/components/common/ChoiceChips';
import { TagChip } from '@/components/common/TagChip';
import { ProgressBar } from '@/components/common/ProgressBar';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';
import { DatePickerField } from '@/components/common/DatePickerField';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { IconButton } from '@/components/common/IconButton';
import { FormField } from '@/components/common/FormField';
import { createCountdown, deleteCountdown, getCountdowns, updateCountdown } from '@/services/backend/coreFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import type { CoupleCountdown, CountdownType } from '@/types/database';
import { useAppTheme } from '@/theme/useAppTheme';
import { participantPalettes } from '@/theme/tokens';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { dateOnlyFromIso, dateOnlyToLocalIso } from '@/utils/dates';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }
function remaining(target: string) { const milliseconds = new Date(target).getTime() - Date.now(); const days = Math.ceil(milliseconds / 86_400_000); const hours = Math.max(0, Math.ceil(milliseconds / 3_600_000)); const weeks = Math.max(0, Math.floor(Math.max(0, days) / 7)); return { days, hours, weeks }; }
function progress(start: string | null, target: string) { if (!start) return null; const startMs = new Date(start).getTime(); const targetMs = new Date(target).getTime(); if (!Number.isFinite(startMs) || targetMs <= startMs) return null; return Math.min(100, Math.max(0, ((Date.now() - startMs) / (targetMs - startMs)) * 100)); }
function formatTarget(target: string) { return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(target)); }

export default function CountdownsScreen() {
  const theme = useAppTheme(); const params = useLocalSearchParams<{ focus?: string }>(); const { colorForUser } = useWorkspace();
  const [countdowns, setCountdowns] = useState<CoupleCountdown[]>([]); const [title, setTitle] = useState(''); const [startDate, setStartDate] = useState(''); const [date, setDate] = useState(''); const [type, setType] = useState<CountdownType>('visit');
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true); const [editingId, setEditingId] = useState<string | null>(null); const [composerOpen, setComposerOpen] = useState(false); const [deleteTarget, setDeleteTarget] = useState<CoupleCountdown | null>(null);
  const refresh = useCallback(async () => { try { setCountdowns(await getCountdowns()); } catch (error) { Alert.alert('Couldn’t load countdowns', messageFrom(error)); } finally { setLoading(false); } }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]); useRealtimeRefresh('countdowns', refresh);

  function resetForm(close = true) { setEditingId(null); setTitle(''); setDate(''); setStartDate(''); setType('visit'); if (close) setComposerOpen(false); }
  function beginEdit(countdown: CoupleCountdown) { setEditingId(countdown.id); setTitle(countdown.title); setDate(dateOnlyFromIso(countdown.target_at)); setStartDate(dateOnlyFromIso(countdown.start_at)); setType(countdown.type); setComposerOpen(true); }
  useEffect(() => { if (!params.focus || editingId === params.focus || !countdowns.length) return; const focused = countdowns.find((item) => item.id === params.focus); if (focused) beginEdit(focused); }, [params.focus, countdowns]);
  async function save() {
    if (!title.trim() || !date) return; const targetAt = dateOnlyToLocalIso(date); const startAt = startDate ? dateOnlyToLocalIso(startDate) : null;
    if (!targetAt) { Alert.alert('Check the target date', 'Choose a real target date.'); return; }
    if (startAt && new Date(startAt).getTime() >= new Date(targetAt).getTime()) { Alert.alert('Check the dates', 'Start date must be before the target date.'); return; }
    setBusy(true); try { if (editingId) await updateCountdown(editingId, { title: title.trim(), targetAt, startAt, type }); else await createCountdown({ title: title.trim(), targetAt, startAt, type }); resetForm(); await refresh(); } catch (error) { Alert.alert(editingId ? 'Couldn’t update countdown' : 'Couldn’t create countdown', messageFrom(error)); } finally { setBusy(false); }
  }
  async function removeConfirmed() { const target = deleteTarget; setDeleteTarget(null); if (!target) return; try { await deleteCountdown(target.id); setCountdowns((current) => current.filter((item) => item.id !== target.id)); if (editingId === target.id) resetForm(); } catch (error) { Alert.alert('Couldn’t delete countdown', messageFrom(error)); } }
  function openCountdownMenu(countdown: CoupleCountdown) {
    Alert.alert(countdown.title, 'Manage this countdown', [
      { text: 'Edit countdown', onPress: () => beginEdit(countdown) },
      { text: 'Delete countdown', style: 'destructive', onPress: () => setDeleteTarget(countdown) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return <AppScreen>
    <BackHeader eyebrow="Plan" title="Countdowns" subtitle="Visits, anniversaries and dates worth looking forward to." />
    <CollapsibleComposer title={editingId ? 'Edit countdown' : 'Our countdowns'} subtitle={`${countdowns.filter((item) => new Date(item.target_at).getTime() >= Date.now()).length} upcoming`} open={composerOpen} actionLabel="New countdown" closeLabel={editingId ? 'Cancel edit' : 'Close'} tone="accent" style={{ marginBottom: theme.spacing.xxl }} onToggle={() => composerOpen ? resetForm() : setComposerOpen(true)}>
      <FormField label="COUNTDOWN NAME" value={title} onChangeText={setTitle} placeholder="Next time we're together" />
      <DatePickerField label="TARGET DATE" value={date} onChange={setDate} />
      <DatePickerField label="START DATE · OPTIONAL" value={startDate} onChange={setStartDate} optional />
      <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">TYPE</AppText><ChoiceChips value={type} onChange={setType} options={[{ value: 'visit', label: 'Visit' }, { value: 'flight', label: 'Flight' }, { value: 'anniversary', label: 'Anniversary' }, { value: 'birthday', label: 'Birthday' }, { value: 'moving', label: 'Moving' }, { value: 'wedding', label: 'Wedding' }, { value: 'holiday', label: 'Holiday' }, { value: 'custom', label: 'Custom' }]} /></View>
      <AppButton label={busy ? 'Saving…' : editingId ? 'Save changes' : 'Create countdown'} disabled={busy || !title.trim() || !date} onPress={save} />
    </CollapsibleComposer>
    <View style={{ gap: theme.spacing.md }}>
      {loading ? <AppText tone="muted">Loading countdowns…</AppText> : null}
      {!loading && countdowns.length === 0 ? <EmptyState icon="countdown" title="Something to look forward to" body="Create a visit, anniversary or milestone countdown." actionLabel="New countdown" onAction={() => setComposerOpen(true)} /> : null}
      {countdowns.map((countdown) => { const time = remaining(countdown.target_at); const passed = time.days < 0; const percent = progress(countdown.start_at, countdown.target_at); const creatorColor = colorForUser(countdown.creator_id); const palette = creatorColor === 'both' ? null : participantPalettes[creatorColor]; return <Card key={countdown.id} participantColor={creatorColor} style={{ gap: theme.spacing.md, borderColor: editingId === countdown.id ? theme.colors.accent : theme.colors.border }}><View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' }}><View style={{ flex: 1, gap: 5 }}><TagChip subtle label={countdown.type.toUpperCase()} /><AppText variant="section" style={{ marginTop: 3 }}>{countdown.title}</AppText><ParticipantAttribution userId={countdown.creator_id} /><AppText variant="bodySmall" tone="secondary">{formatTarget(countdown.target_at)}</AppText></View><IconButton icon="overflow" label={`More actions for ${countdown.title}`} onPress={() => openCountdownMenu(countdown)} /></View><View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}><AppText variant="numeric" style={{ color: passed ? theme.colors.textMuted : (palette?.accent ?? theme.colors.textSecondary) }}>{passed ? '0' : Math.max(0, time.days)}</AppText><AppText variant="cardTitle" style={{ paddingBottom: 6 }}>{passed ? 'arrived' : 'days'}</AppText></View>{!passed ? <AppText variant="caption" tone="muted">{time.weeks ? `${time.weeks} weeks · ` : ''}{time.hours.toLocaleString()} hours remaining</AppText> : null}{percent != null ? <><ProgressBar value={percent} /><AppText variant="caption" tone="muted">{Math.round(percent)}% of the wait complete</AppText></> : null}</Card>; })}
    </View>
    <ConfirmDialog visible={!!deleteTarget} title="Delete countdown?" body={deleteTarget ? `Delete “${deleteTarget.title}”?` : ''} onCancel={() => setDeleteTarget(null)} onConfirm={() => removeConfirmed().catch(() => undefined)} />
  </AppScreen>;
}
