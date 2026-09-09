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
import { DetailsToggle } from '@/components/common/DetailsToggle';
import { RecordViewSheet } from '@/components/common/RecordViewSheet';
import { DatePickerField } from '@/components/common/DatePickerField';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { IconButton } from '@/components/common/IconButton';
import { FormField } from '@/components/common/FormField';
import { createCountdown, deleteCountdown, getCountdowns, updateCountdown } from '@/services/backend/coreFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import type { CoupleCountdown, CountdownType } from '@/types/database';
import { useAppTheme } from '@/theme/useAppTheme';
import { participantPalettes, participantPalette } from '@/theme/tokens';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { countdownDateKey, countdownProgress, countdownRemaining, countdownStorageIso, localNoonFromDateKey } from '@/utils/countdown';
import { isValidDateOnly } from '@/utils/dates';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }
function formatTarget(target: string) {
  const date = localNoonFromDateKey(countdownDateKey(target));
  return date ? new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(date) : '';
}

export default function CountdownsScreen() {
  const theme = useAppTheme(); const params = useLocalSearchParams<{ focus?: string; edit?: string }>(); const { colorForUser } = useWorkspace();
  const [countdowns, setCountdowns] = useState<CoupleCountdown[]>([]); const [title, setTitle] = useState(''); const [startDate, setStartDate] = useState(''); const [date, setDate] = useState(''); const [type, setType] = useState<CountdownType>('visit');
  const [busy, setBusy] = useState(false); const [viewTarget, setViewTarget] = useState<CoupleCountdown | null>(null); const [detailsOpen, setDetailsOpen] = useState(false); const [nowMs, setNowMs] = useState(() => Date.now()); const [loading, setLoading] = useState(true); const [editingId, setEditingId] = useState<string | null>(null); const [composerOpen, setComposerOpen] = useState(false); const [deleteTarget, setDeleteTarget] = useState<CoupleCountdown | null>(null);
  const refresh = useCallback(async () => { try { setCountdowns(await getCountdowns()); } catch (error) { Alert.alert('Couldn’t load countdowns', messageFrom(error)); } finally { setLoading(false); } }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]); useRealtimeRefresh('countdowns', refresh);
  useEffect(() => { const timer = setInterval(() => setNowMs(Date.now()), 60_000); return () => clearInterval(timer); }, []);

  function resetForm(close = true) { setEditingId(null); setTitle(''); setDate(''); setStartDate(''); setType('visit'); setDetailsOpen(false); if (close) setComposerOpen(false); }
  function beginEdit(countdown: CoupleCountdown) { setEditingId(countdown.id); setTitle(countdown.title); setDate(countdownDateKey(countdown.target_at)); setStartDate(countdownDateKey(countdown.start_at)); setType(countdown.type); setDetailsOpen(true); setComposerOpen(true); }
  useEffect(() => { if (!params.focus || !countdowns.length) return; const focused = countdowns.find((item) => item.id === params.focus); if (focused) setViewTarget(focused); }, [params.focus, countdowns]);
  useEffect(() => { if (!params.edit || editingId === params.edit || !countdowns.length) return; const target = countdowns.find((item) => item.id === params.edit); if (target) beginEdit(target); }, [params.edit, editingId, countdowns]);
  async function save() {
    if (!title.trim() || !date) return; const targetAt = countdownStorageIso(date); const startAt = startDate ? countdownStorageIso(startDate) : null;
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
    <CollapsibleComposer title={editingId ? 'Edit countdown' : 'Our countdowns'} subtitle={`${countdowns.filter((item) => !countdownRemaining(item.target_at, nowMs).passed).length} upcoming`} open={composerOpen} actionLabel="New countdown" closeLabel={editingId ? 'Cancel edit' : 'Close'} tone="accent" style={{ marginBottom: theme.spacing.xxl }} onToggle={() => composerOpen ? resetForm() : setComposerOpen(true)}>
      <FormField label="What are you counting down to?" value={title} onChangeText={setTitle} placeholder="Next time we're together" />
      <DatePickerField label="When is it?" value={date} onChange={setDate} />
      <DetailsToggle open={detailsOpen} onToggle={() => setDetailsOpen((value) => !value)} closedLabel="Add details" openLabel="Hide details" hint="Start date and countdown type." />
      {detailsOpen ? <View style={{ gap: theme.spacing.lg }}>
        <DatePickerField label="When did the wait start?" value={startDate} onChange={setStartDate} optional />
        <View style={{ gap: theme.spacing.sm }}><AppText variant="bodySmall" tone="secondary">What kind of countdown is it?</AppText><ChoiceChips value={type} onChange={setType} options={[{ value: 'visit', label: 'Visit' }, { value: 'flight', label: 'Flight' }, { value: 'anniversary', label: 'Anniversary' }, { value: 'birthday', label: 'Birthday' }, { value: 'moving', label: 'Moving' }, { value: 'wedding', label: 'Wedding' }, { value: 'holiday', label: 'Holiday' }, { value: 'custom', label: 'Custom' }]} /></View>
      </View> : null}
      <AppButton label={busy ? 'Saving…' : editingId ? 'Save changes' : 'Create countdown'} disabled={busy || !title.trim() || !date} onPress={save} />
    </CollapsibleComposer>
    <View style={{ gap: theme.spacing.md }}>
      {loading ? <AppText tone="muted">Loading countdowns…</AppText> : null}
      {!loading && countdowns.length === 0 ? <EmptyState icon="countdown" title="Something to look forward to" body="Create a visit, anniversary or milestone countdown." actionLabel="New countdown" onAction={() => setComposerOpen(true)} /> : null}
      {countdowns.map((countdown) => { const time = countdownRemaining(countdown.target_at, nowMs); const passed = time.passed; const percent = countdownProgress(countdown.start_at, countdown.target_at, nowMs); return <Card key={countdown.id} participantColor="both" style={{ gap: theme.spacing.md, borderColor: editingId === countdown.id ? theme.colors.accent : theme.colors.border }}><View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' }}><Pressable accessibilityRole="button" accessibilityLabel={`Open countdown ${countdown.title}`} onPress={() => setViewTarget(countdown)} style={({ pressed }) => ({ flex: 1, gap: 5, opacity: pressed ? 0.76 : 1 })}><TagChip subtle label={countdown.type.toUpperCase()} /><AppText variant="section" style={{ marginTop: 3 }}>{countdown.title}</AppText><ParticipantAttribution userId={countdown.creator_id} /><AppText variant="bodySmall" tone="secondary">{formatTarget(countdown.target_at)}</AppText></Pressable><IconButton icon="overflow" label={`More actions for ${countdown.title}`} onPress={() => openCountdownMenu(countdown)} /></View><View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}><AppText variant="numeric" style={{ color: passed ? theme.colors.textMuted : theme.colors.textPrimary }}>{passed ? '0' : Math.max(0, time.days)}</AppText><AppText variant="cardTitle" style={{ paddingBottom: 6 }}>{passed ? 'arrived' : 'days'}</AppText></View>{!passed ? <AppText variant="caption" tone="muted">{time.weeks ? `${time.weeks} weeks · ` : ''}{time.hours.toLocaleString()} hours remaining</AppText> : null}{percent != null ? <><ProgressBar value={percent} /><AppText variant="caption" tone="muted">{Math.round(percent)}% of the wait complete</AppText></> : null}</Card>; })}
    </View>
    <RecordViewSheet visible={!!viewTarget} onClose={() => setViewTarget(null)} eyebrow="Countdown" title={viewTarget?.title ?? ''} subtitle={viewTarget ? formatTarget(viewTarget.target_at) : undefined}>
      {viewTarget ? <View style={{ gap: theme.spacing.md }}>
        <ParticipantAttribution userId={viewTarget.creator_id} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <TagChip subtle label={viewTarget.type.toUpperCase()} />
          {viewTarget.start_at ? <TagChip subtle label={`STARTED ${formatTarget(viewTarget.start_at).toUpperCase()}`} /> : null}
        </View>
        <AppText variant="numeric">{Math.max(0, countdownRemaining(viewTarget.target_at, nowMs).days)}</AppText>
        <AppText tone="secondary">{countdownRemaining(viewTarget.target_at, nowMs).passed ? 'This countdown has arrived.' : 'days remaining'}</AppText>
      </View> : null}
    </RecordViewSheet>
    <ConfirmDialog visible={!!deleteTarget} title="Delete countdown?" body={deleteTarget ? `Delete “${deleteTarget.title}”?` : ''} onCancel={() => setDeleteTarget(null)} onConfirm={() => removeConfirmed().catch(() => undefined)} />
  </AppScreen>;
}
