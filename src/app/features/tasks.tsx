import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { CelebrationMoment } from '@/components/common/CelebrationMoment';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FormField } from '@/components/common/FormField';
import { ChoiceChips } from '@/components/common/ChoiceChips';
import { TagChip } from '@/components/common/TagChip';
import { TagSelector } from '@/components/common/TagSelector';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { ParticipantIdentityBadge } from '@/components/common/ParticipantIdentityBadge';
import { ComposerSheet } from '@/components/common/ComposerSheet';
import { DetailsToggle } from '@/components/common/DetailsToggle';
import { RecordViewSheet } from '@/components/common/RecordViewSheet';
import { DatePickerField } from '@/components/common/DatePickerField';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { IconButton } from '@/components/common/IconButton';
import { AppIcon } from '@/components/art/AppIcon';
import { createSubtask, createTask, deleteSubtask, deleteTask, getTasks, updateSubtask, updateTask } from '@/services/backend/coreFeatures';
import { getTags } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useCelebrationMoment } from '@/hooks/useCelebrationMoment';
import type { CoupleTask, Priority, Tag, TaskRecurrence, TaskSubtask } from '@/types/database';
import { useAppTheme } from '@/theme/useAppTheme';
import { participantPalettes, participantPalette } from '@/theme/tokens';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { dateOnlyFromIso, dateOnlyToLocalIso } from '@/utils/dates';
import { taskAttentionDate } from '@/utils/taskTiming';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }
function dueLabel(task: CoupleTask) {
  const value = task.due_date ? `${task.due_date}T12:00:00` : task.due_at;
  if (!value) return 'No due date';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value));
}
function recurrenceLabel(value: TaskRecurrence) { return value === 'none' ? '' : value === 'fortnightly' ? 'Every 2 weeks' : `Every ${value.replace('ly', '')}`; }

type DurationUnit = 'minutes' | 'hours' | 'days' | 'weeks';
type DraftStep = { id: string; title: string; dueDate: string | null; estimatedMinutes: number | null };
function durationToMinutes(amount: string, unit: DurationUnit) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return null;
  const multiplier = unit === 'weeks' ? 10080 : unit === 'days' ? 1440 : unit === 'hours' ? 60 : 1;
  return Math.max(1, Math.round(value * multiplier));
}
function durationFromMinutes(minutes: number | null | undefined): { amount: string; unit: DurationUnit } {
  if (!minutes) return { amount: '', unit: 'hours' };
  if (minutes % 10080 === 0) return { amount: String(minutes / 10080), unit: 'weeks' };
  if (minutes % 1440 === 0) return { amount: String(minutes / 1440), unit: 'days' };
  if (minutes % 60 === 0) return { amount: String(minutes / 60), unit: 'hours' };
  return { amount: String(minutes), unit: 'minutes' };
}
function durationLabel(minutes: number | null | undefined) {
  if (!minutes) return '';
  const value = durationFromMinutes(minutes);
  const amount = Number(value.amount);
  const noun = amount === 1 ? value.unit.replace(/s$/, '') : value.unit;
  return `${value.amount} ${noun}`;
}
function shortDate(value: string | null | undefined) {
  if (!value) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

type AssignmentFilter = 'all' | 'mine' | 'partner' | 'both';
type StatusFilter = 'now' | 'open' | 'all' | 'completed';

// G6_COMPOSER_SHEETS: major create/edit flow uses the explicit shared ComposerSheet primitive.
export default function TasksScreen() {
  const theme = useAppTheme();
  const { celebration, celebrate, dismissCelebration } = useCelebrationMoment();
  const params = useLocalSearchParams<{ focus?: string; edit?: string }>();
  const { colorForUser, profile, partnerProfile } = useWorkspace();
  const [tasks, setTasks] = useState<CoupleTask[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [durationAmount, setDurationAmount] = useState('');
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('hours');
  const [priority, setPriority] = useState<Priority>('normal');
  const [recurrence, setRecurrence] = useState<TaskRecurrence>('none');
  const [draftSteps, setDraftSteps] = useState<DraftStep[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskDueDate, setNewSubtaskDueDate] = useState('');
  const [newSubtaskDurationAmount, setNewSubtaskDurationAmount] = useState('');
  const [newSubtaskDurationUnit, setNewSubtaskDurationUnit] = useState<DurationUnit>('hours');
  const [timingStepId, setTimingStepId] = useState<string | null>(null);
  const [stepDueDate, setStepDueDate] = useState('');
  const [stepDurationAmount, setStepDurationAmount] = useState('');
  const [stepDurationUnit, setStepDurationUnit] = useState<DurationUnit>('hours');
  const [assignee, setAssignee] = useState<'me' | 'partner' | 'both'>('both');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingUpdatedAt, setEditingUpdatedAt] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [assignmentFilter, setAssignmentFilter] = useState<AssignmentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('now');
  const [viewTarget, setViewTarget] = useState<CoupleTask | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CoupleTask | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [nextTasks, nextTags] = await Promise.all([getTasks(), getTags()]);
      setTasks(nextTasks); setTags(nextTags);
    } catch (error) { Alert.alert('Couldn’t load tasks', messageFrom(error)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('tasks', refresh);
  useRealtimeRefresh('tags', refresh);

  const completed = useMemo(() => tasks.filter((task) => task.status === 'completed').length, [tasks]);
  const visibleTasks = useMemo(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const needsAttention = (task: CoupleTask) => {
      if (task.status === 'completed' || task.status === 'skipped') return false;
      if (task.priority === 'high') return true;
      if (task.due_date && task.due_date <= today) return true;
      if ((task.subtasks ?? []).some((step) => !step.completed && step.due_date && step.due_date <= today)) return true;
      const attention = taskAttentionDate(task);
      return Boolean(attention && attention <= today);
    };
    return tasks.filter((task) => {
      if (statusFilter === 'now' && !needsAttention(task)) return false;
      if (statusFilter === 'open' && (task.status === 'completed' || task.status === 'skipped')) return false;
      if (statusFilter === 'completed' && task.status !== 'completed') return false;
      if (assignmentFilter === 'both' && !task.assign_to_both) return false;
      if (assignmentFilter === 'mine' && (task.assign_to_both || task.assignee_id !== profile?.id)) return false;
      if (assignmentFilter === 'partner' && (task.assign_to_both || task.assignee_id !== partnerProfile?.id)) return false;
      return true;
    }).sort((a, b) => {
      const aHigh = a.priority === 'high' ? 0 : 1; const bHigh = b.priority === 'high' ? 0 : 1;
      if (aHigh !== bHigh) return aHigh - bHigh;
      const aDate = taskAttentionDate(a) ?? a.due_date ?? '9999-12-31';
      const bDate = taskAttentionDate(b) ?? b.due_date ?? '9999-12-31';
      return aDate.localeCompare(bDate);
    });
  }, [assignmentFilter, partnerProfile?.id, profile?.id, statusFilter, tasks]);

  function resetEditor(close = true) {
    setEditingId(null); setEditingUpdatedAt(null); setTitle(''); setDescription(''); setDueDate(''); setStartDate(''); setDurationAmount(''); setDurationUnit('hours'); setPriority('normal'); setRecurrence('none'); setDraftSteps([]); setNewSubtaskTitle(''); setNewSubtaskDueDate(''); setNewSubtaskDurationAmount(''); setNewSubtaskDurationUnit('hours'); setTimingStepId(null); setAssignee('both'); setSelectedTagIds([]); setAdvancedOpen(false);
    if (close) setComposerOpen(false);
  }
  function beginEdit(task: CoupleTask) {
    setEditingId(task.id); setEditingUpdatedAt(task.updated_at); setTitle(task.title); setDescription(task.description); setDueDate(task.due_date ?? dateOnlyFromIso(task.due_at)); setStartDate(task.start_date ?? ''); const duration = durationFromMinutes(task.estimated_minutes); setDurationAmount(duration.amount); setDurationUnit(duration.unit); setPriority(task.priority); setRecurrence(task.recurrence ?? 'none');
    setAssignee(task.assign_to_both ? 'both' : task.assignee_id === profile?.id ? 'me' : 'partner');
    setDraftSteps([]); setSelectedTagIds((task.tags ?? []).map((tag) => tag.id)); setAdvancedOpen(true); setComposerOpen(true);
  }
  useEffect(() => {
    if (!params.focus || !tasks.length) return;
    const focused = tasks.find((task) => task.id === params.focus);
    if (focused) setViewTarget(focused);
  }, [params.focus, tasks]);
  useEffect(() => {
    if (!params.edit || editingId === params.edit || !tasks.length) return;
    const target = tasks.find((task) => task.id === params.edit);
    if (target) beginEdit(target);
  }, [params.edit, editingId, tasks]);

  async function saveTask() {
    if (!title.trim()) return;
    const dueAt = dueDate ? dateOnlyToLocalIso(dueDate, 23, 59) : null;
    if (dueDate && !dueAt) { Alert.alert('Check the date', 'Choose a valid due date.'); return; }
    if (recurrence !== 'none' && !dueDate) { Alert.alert('Repeating task needs a date', 'Choose a due date so Togetherly knows when the next occurrence should be created.'); return; }
    if (startDate && dueDate && startDate > dueDate) { Alert.alert('Check the dates', 'The start / attention date needs to be on or before the due date.'); return; }
    const estimatedMinutes = durationAmount.trim() ? durationToMinutes(durationAmount, durationUnit) : null;
    if (durationAmount.trim() && !estimatedMinutes) { Alert.alert('Check the duration', 'Enter a duration greater than zero.'); return; }
    setBusy(true);
    try {
      const input = { title: title.trim(), description: description.trim(), dueAt, dueDate: dueDate || null, startDate: startDate || null, estimatedMinutes, recurrence, priority, assignee, tagIds: selectedTagIds };
      if (editingId) {
        await updateTask(editingId, { ...input, updatedAt: editingUpdatedAt ?? undefined });
      } else {
        await createTask({ ...input, subtasks: draftSteps.map((step) => ({ title: step.title, dueDate: step.dueDate, estimatedMinutes: step.estimatedMinutes })) });
      }
      resetEditor(); await refresh();
    } catch (error) { Alert.alert(editingId ? 'Couldn’t update task' : 'Couldn’t add task', messageFrom(error)); }
    finally { setBusy(false); }
  }
  async function setStatus(task: CoupleTask, status: CoupleTask['status']) {
    const previous = task.status;
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status } : item));
    try {
      await updateTask(task.id, { status, updatedAt: task.updated_at });
      await refresh();
      if (status === 'completed' && previous !== 'completed') {
        celebrate({ title: 'Done ✓', body: task.title, icon: 'check' });
      }
    }
    catch (error) { setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: previous } : item)); Alert.alert('Couldn’t update task', messageFrom(error)); }
  }
  async function addStep() {
    if (!newSubtaskTitle.trim()) return;
    const estimatedMinutes = newSubtaskDurationAmount.trim() ? durationToMinutes(newSubtaskDurationAmount, newSubtaskDurationUnit) : null;
    if (newSubtaskDurationAmount.trim() && !estimatedMinutes) { Alert.alert('Check the duration', 'Enter a duration greater than zero.'); return; }
    if (newSubtaskDueDate && dueDate && newSubtaskDueDate > dueDate) { Alert.alert('Check the step date', 'A step can’t be due after the task itself.'); return; }
    if (!editingId) {
      setDraftSteps((current) => [...current, { id: `${Date.now()}-${current.length}`, title: newSubtaskTitle.trim(), dueDate: newSubtaskDueDate || null, estimatedMinutes }]);
      setNewSubtaskTitle(''); setNewSubtaskDueDate(''); setNewSubtaskDurationAmount('');
      return;
    }
    try {
      await createSubtask(editingId, { title: newSubtaskTitle.trim(), dueDate: newSubtaskDueDate || null, estimatedMinutes });
      setNewSubtaskTitle(''); setNewSubtaskDueDate(''); setNewSubtaskDurationAmount('');
      await refresh();
    } catch (error) { Alert.alert('Couldn’t add step', messageFrom(error)); }
  }
  function removeDraftStep(id: string) { setDraftSteps((current) => current.filter((step) => step.id !== id)); }
  async function toggleStep(step: TaskSubtask) {
    try { await updateSubtask(step.id, { completed: !step.completed }); await refresh(); }
    catch (error) { Alert.alert('Couldn’t update step', messageFrom(error)); }
  }
  function editStepTiming(step: TaskSubtask) {
    if (timingStepId === step.id) { setTimingStepId(null); return; }
    const duration = durationFromMinutes(step.estimated_minutes);
    setTimingStepId(step.id); setStepDueDate(step.due_date ?? ''); setStepDurationAmount(duration.amount); setStepDurationUnit(duration.unit);
  }
  async function saveStepTiming(step: TaskSubtask) {
    const estimatedMinutes = stepDurationAmount.trim() ? durationToMinutes(stepDurationAmount, stepDurationUnit) : null;
    if (stepDurationAmount.trim() && !estimatedMinutes) { Alert.alert('Check the duration', 'Enter a duration greater than zero.'); return; }
    try { await updateSubtask(step.id, { dueDate: stepDueDate || null, estimatedMinutes }); setTimingStepId(null); await refresh(); }
    catch (error) { Alert.alert('Couldn’t update step timing', messageFrom(error)); }
  }
  async function removeStep(step: TaskSubtask) {
    try { await deleteSubtask(step.id); await refresh(); }
    catch (error) { Alert.alert('Couldn’t remove step', messageFrom(error)); }
  }

  async function removeConfirmed() {
    const task = deleteTarget; setDeleteTarget(null); if (!task) return;
    try { await deleteTask(task.id); setTasks((current) => current.filter((item) => item.id !== task.id)); if (editingId === task.id) resetEditor(); }
    catch (error) { Alert.alert('Couldn’t delete task', messageFrom(error)); }
  }
  function openTaskMenu(task: CoupleTask) {
    Alert.alert(task.title, 'Choose what to do.', [
      { text: 'Edit task', onPress: () => beginEdit(task) },
      { text: 'Delete task', style: 'destructive', onPress: () => setDeleteTarget(task) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <AppScreen>
      <BackHeader eyebrow="Plan" title="Shared tasks" subtitle="What needs doing, who’s got it, and what matters next." />

      <Card tone="accent" style={{ gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View><AppText variant="caption" tone="accent">WHAT NEEDS DOING</AppText><AppText variant="pageTitle">{tasks.length - completed} remaining</AppText></View>
          <AppText variant="cardTitle" tone="secondary">{completed}/{tasks.length}</AppText>
        </View>
      </Card>

      <ComposerSheet
        title={editingId ? 'Edit task' : 'Add something to do'}
        subtitle={editingId ? undefined : `${tasks.length - completed} still open`}
        open={composerOpen}
        actionLabel="Add task"
        closeLabel={editingId ? 'Cancel edit' : 'Close'}
        tone="accent"
        style={{ marginBottom: theme.spacing.lg }}
        onToggle={() => composerOpen ? resetEditor() : setComposerOpen(true)}
      >
        <FormField label="What needs doing?" value={title} onChangeText={setTitle} placeholder="Book dinner for Saturday" returnKeyType="done" />
        <View style={{ gap: theme.spacing.sm }}><AppText variant="bodySmall" tone="secondary">Who’s doing it?</AppText><ChoiceChips value={assignee} onChange={setAssignee} options={[{ value: 'both', label: 'Both of us' }, { value: 'me', label: profile?.display_name ? `Me · ${profile.display_name}` : 'Me' }, ...(partnerProfile ? [{ value: 'partner' as const, label: partnerProfile.display_name }] : [])]} /></View>
        <DetailsToggle open={advancedOpen} onToggle={() => setAdvancedOpen((value) => !value)} closedLabel="Add dates & details" openLabel="Hide dates & details" hint="Due dates, steps, priority, repeat and tags." />
        {advancedOpen ? <View style={{ gap: theme.spacing.lg }}>
          <FormField label="Details" value={description} onChangeText={setDescription} placeholder="Booking link, reservation notes, what needs doing…" multiline />
          <DatePickerField label="Due date" value={dueDate} onChange={setDueDate} optional />
          <DatePickerField label="When should this start getting attention?" value={startDate} onChange={setStartDate} optional />
          <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">Estimated duration</AppText><View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}><View style={{ flex: 1 }}><FormField label="AMOUNT" value={durationAmount} onChangeText={setDurationAmount} keyboardType="numeric" placeholder="1" /></View><View style={{ flex: 2 }}><ChoiceChips value={durationUnit} onChange={setDurationUnit} options={[{ value: 'minutes', label: 'Min' }, { value: 'hours', label: 'Hours' }, { value: 'days', label: 'Days' }, { value: 'weeks', label: 'Weeks' }]} /></View></View><AppText variant="bodySmall" tone="muted">Helps work out when to start.</AppText></View>
          <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">Priority</AppText><ChoiceChips value={priority} onChange={setPriority} options={[{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }]} /></View>
          <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">Repeat</AppText><ChoiceChips value={recurrence} onChange={setRecurrence} options={[{ value: 'none', label: 'Never' }, { value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'fortnightly', label: '2 weeks' }, { value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }]} /></View>
          <TagSelector tags={tags} selectedIds={selectedTagIds} onChange={setSelectedTagIds} />
          <View style={{ gap: theme.spacing.md }}><AppText variant="caption" tone="secondary">Steps</AppText>{!editingId && draftSteps.map((step) => <View key={step.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 9 }}><View style={{ flex: 1, gap: 2 }}><AppText>{step.title}</AppText>{step.dueDate || step.estimatedMinutes ? <AppText variant="caption" tone="muted">{step.dueDate ? `Due ${shortDate(step.dueDate)}` : ''}{step.dueDate && step.estimatedMinutes ? ' · ' : ''}{step.estimatedMinutes ? `~${durationLabel(step.estimatedMinutes)}` : ''}</AppText> : null}</View><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${step.title}`} onPress={() => removeDraftStep(step.id)} hitSlop={8}><AppIcon name="close" size={15} color={theme.colors.textMuted} /></Pressable></View>)}{editingId ? <>{(tasks.find((item) => item.id === editingId)?.subtasks ?? []).map((step) => <View key={step.id} style={{ gap: 8, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 9 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked: step.completed }} onPress={() => toggleStep(step)} style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }}>{step.completed ? <AppIcon name="check" size={15} color={theme.colors.accent} /> : null}</Pressable><View style={{ flex: 1, gap: 2 }}><AppText style={{ textDecorationLine: step.completed ? 'line-through' : 'none' }}>{step.title}</AppText>{step.due_date || step.estimated_minutes ? <AppText variant="caption" tone="muted">{step.due_date ? `Due ${shortDate(step.due_date)}` : ''}{step.due_date && step.estimated_minutes ? ' · ' : ''}{step.estimated_minutes ? `~${durationLabel(step.estimated_minutes)}` : ''}</AppText> : null}</View><AppButton compact variant="ghost" label={timingStepId === step.id ? 'Close' : 'Timing'} onPress={() => editStepTiming(step)} /><Pressable accessibilityRole="button" accessibilityLabel={`Remove ${step.title}`} onPress={() => removeStep(step)} hitSlop={8}><AppIcon name="close" size={15} color={theme.colors.textMuted} /></Pressable></View>{timingStepId === step.id ? <View style={{ gap: theme.spacing.sm }}><DatePickerField label="STEP DUE DATE · OPTIONAL" value={stepDueDate} onChange={setStepDueDate} optional /><View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}><View style={{ flex: 1 }}><FormField label="DURATION" value={stepDurationAmount} onChangeText={setStepDurationAmount} keyboardType="numeric" placeholder="1" /></View><View style={{ flex: 2 }}><ChoiceChips value={stepDurationUnit} onChange={setStepDurationUnit} options={[{ value: 'minutes', label: 'Min' }, { value: 'hours', label: 'Hours' }, { value: 'days', label: 'Days' }, { value: 'weeks', label: 'Weeks' }]} /></View></View><AppButton compact variant="secondary" label="Save step timing" onPress={() => saveStepTiming(step)} /></View> : null}</View>)}</> : null}<View style={{ gap: theme.spacing.sm, paddingTop: 4 }}><FormField label="Add a step" value={newSubtaskTitle} onChangeText={setNewSubtaskTitle} placeholder="Book the restaurant…" /><DatePickerField label="STEP DUE DATE · OPTIONAL" value={newSubtaskDueDate} onChange={setNewSubtaskDueDate} optional /><View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}><View style={{ flex: 1 }}><FormField label="DURATION" value={newSubtaskDurationAmount} onChangeText={setNewSubtaskDurationAmount} keyboardType="numeric" placeholder="30" /></View><View style={{ flex: 2 }}><ChoiceChips value={newSubtaskDurationUnit} onChange={setNewSubtaskDurationUnit} options={[{ value: 'minutes', label: 'Min' }, { value: 'hours', label: 'Hours' }, { value: 'days', label: 'Days' }, { value: 'weeks', label: 'Weeks' }]} /></View></View><AppButton compact variant="secondary" label="Add step" disabled={!newSubtaskTitle.trim()} onPress={addStep} /></View></View>
        </View> : null}
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}><View style={{ flex: 1 }}><AppButton label={busy ? 'Saving…' : editingId ? 'Save changes' : 'Add task'} disabled={busy || !title.trim()} onPress={saveTask} /></View>{editingId ? <AppButton compact variant="secondary" label="Cancel" onPress={() => resetEditor()} /> : null}</View>
      </ComposerSheet>

      <Card tone="secondary" style={{ gap: theme.spacing.md, marginBottom: theme.spacing.xxl }}>
        <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">WHAT</AppText><ChoiceChips value={statusFilter} onChange={setStatusFilter} options={[{ value: 'now', label: 'Now' }, { value: 'open', label: 'Open' }, { value: 'all', label: 'All' }, { value: 'completed', label: 'Done' }]} /></View>
        <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">WHO</AppText><ChoiceChips value={assignmentFilter} onChange={setAssignmentFilter} options={[{ value: 'all', label: 'Everyone' }, { value: 'mine', label: profile?.display_name ?? 'My tasks' }, ...(partnerProfile ? [{ value: 'partner' as const, label: partnerProfile.display_name }] : []), { value: 'both', label: 'Both' }]} /></View>
      </Card>

      <View style={{ gap: theme.spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><AppText variant="section">{statusFilter === 'now' ? 'Needs attention' : 'Our tasks'}</AppText><AppText variant="bodySmall" tone="muted">{visibleTasks.length} shown</AppText></View>
        {loading ? <AppText tone="muted">Loading tasks…</AppText> : null}
        {/* F2_EMPTY_STATE_COACHING: empty task views offer a useful next move or a filter reset. */}
        {!loading && visibleTasks.length === 0 ? <EmptyState
          icon="task"
          eyebrow={tasks.length ? 'THIS VIEW IS CLEAR' : 'A GOOD FIRST STEP'}
          title={tasks.length ? 'Nothing matches this view' : 'Nothing to do yet'}
          body={tasks.length ? (statusFilter === 'now' ? 'Nothing needs attention right now.' : 'Your tasks are still here — this view is just filtered down.') : 'Add one real thing you want to remember, share or get done together.'}
          tip={tasks.length ? 'Show everything again, then narrow it down only when you need to.' : 'Start tiny: “Book dinner”, “Call the hotel”, or “Remember the parcel” is enough.'}
          actionLabel={tasks.length ? 'Show all tasks' : 'Add a task'}
          onAction={tasks.length ? () => { setStatusFilter('all'); setAssignmentFilter('all'); } : () => setComposerOpen(true)}
        /> : null}
        {visibleTasks.map((task) => {
          const done = task.status === 'completed';
          const creatorColor = colorForUser(task.creator_id);
          const assignmentColor = task.assign_to_both ? 'both' : colorForUser(task.assignee_id);
          const assignmentPalette = assignmentColor === 'both' ? null : participantPalette(assignmentColor);
          return (
            <Card key={task.id} participantColor={assignmentColor} style={{ gap: theme.spacing.md, opacity: done ? 0.68 : 1, borderColor: editingId === task.id ? theme.colors.accent : theme.colors.border }}>
              <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' }}>
                <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done }} onPress={() => setStatus(task, done ? 'not_started' : 'completed')} style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: assignmentPalette?.accent ?? theme.colors.textMuted, backgroundColor: done ? (assignmentPalette?.accentSoft ?? theme.colors.elevatedBackground) : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>{done ? <AppIcon name="check" size={16} color={assignmentPalette?.accent ?? theme.colors.textMuted} /> : null}</Pressable>
                <Pressable accessibilityRole="button" onPress={() => setViewTarget(task)} style={{ flex: 1, gap: 6 }}>
                  <AppText variant="cardTitle" style={done ? { textDecorationLine: 'line-through' } : undefined}>{task.title}</AppText>
                  <ParticipantAttribution userId={task.creator_id} />
                  {task.description ? <AppText variant="bodySmall" tone="secondary">{task.description}</AppText> : null}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}><ParticipantIdentityBadge both={task.assign_to_both} userId={task.assignee_id} compact /><TagChip subtle label={dueLabel(task).toUpperCase()} />{task.start_date ? <TagChip subtle label={`START ${shortDate(task.start_date).toUpperCase()}`} /> : null}{task.estimated_minutes ? <TagChip subtle label={`~${durationLabel(task.estimated_minutes).toUpperCase()}`} /> : null}{task.recurrence !== 'none' ? <TagChip subtle label={`↻ ${recurrenceLabel(task.recurrence).toUpperCase()}`} /> : null}{task.priority !== 'normal' ? <TagChip subtle label={`${task.priority.toUpperCase()} PRIORITY`} /> : null}{(task.tags ?? []).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}</View>
                  {(task.subtasks ?? []).length ? <View style={{ gap: 5, marginTop: 2 }}>{(task.subtasks ?? []).map((step) => <Pressable accessibilityRole="button" key={step.id} onPress={() => toggleStep(step)} style={{ flexDirection: 'row', gap: 7, alignItems: 'center' }}><AppIcon name={step.completed ? 'squareCheck' : 'square'} size={17} color={step.completed ? theme.colors.textMuted : theme.colors.textSecondary} /><View style={{ flex: 1 }}><AppText variant="bodySmall" tone={step.completed ? 'muted' : 'secondary'} style={step.completed ? { textDecorationLine: 'line-through' } : undefined}>{step.title}</AppText>{step.due_date || step.estimated_minutes ? <AppText variant="caption" tone="muted">{step.due_date ? `Due ${shortDate(step.due_date)}` : ''}{step.due_date && step.estimated_minutes ? ' · ' : ''}{step.estimated_minutes ? `~${durationLabel(step.estimated_minutes)}` : ''}</AppText> : null}</View></Pressable>)}<AppText variant="caption" tone="muted">{(task.subtasks ?? []).filter((step) => step.completed).length}/{(task.subtasks ?? []).length} steps complete</AppText></View> : null}
                  {!done ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>{task.status !== 'in_progress' ? <AppButton compact variant="secondary" label="Start" onPress={() => setStatus(task, 'in_progress')} /> : null}<AppButton compact variant="ghost" label="Skip" onPress={() => setStatus(task, 'skipped')} /></View> : null}
                </Pressable>
                <IconButton icon="overflow" label={`More actions for ${task.title}`} onPress={() => openTaskMenu(task)} />
              </View>
            </Card>
          );
        })}
      </View>
      <RecordViewSheet visible={!!viewTarget} onClose={() => setViewTarget(null)} eyebrow="Task" title={viewTarget?.title ?? ''} subtitle={viewTarget ? dueLabel(viewTarget) : undefined}>
        {viewTarget ? <View style={{ gap: theme.spacing.md }}>
          <ParticipantIdentityBadge both={viewTarget.assign_to_both} userId={viewTarget.assignee_id} compact />
          <ParticipantAttribution userId={viewTarget.creator_id} />
          {viewTarget.description ? <AppText tone="secondary">{viewTarget.description}</AppText> : <AppText tone="muted">No extra details.</AppText>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <TagChip subtle label={viewTarget.status.replace('_', ' ').toUpperCase()} />
            {viewTarget.start_date ? <TagChip subtle label={`START ${shortDate(viewTarget.start_date).toUpperCase()}`} /> : null}
            {viewTarget.estimated_minutes ? <TagChip subtle label={`~${durationLabel(viewTarget.estimated_minutes).toUpperCase()}`} /> : null}
            {viewTarget.recurrence !== 'none' ? <TagChip subtle label={`↻ ${recurrenceLabel(viewTarget.recurrence).toUpperCase()}`} /> : null}
            {viewTarget.priority !== 'normal' ? <TagChip subtle label={`${viewTarget.priority.toUpperCase()} PRIORITY`} /> : null}
            {(viewTarget.tags ?? []).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}
          </View>
          {(viewTarget.subtasks ?? []).length ? <View style={{ gap: 8 }}>
            <AppText variant="cardTitle">Steps</AppText>
            {(viewTarget.subtasks ?? []).map((step) => <View key={step.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><AppIcon name={step.completed ? 'squareCheck' : 'square'} size={17} color={step.completed ? theme.colors.textMuted : theme.colors.textSecondary} /><View style={{ flex: 1 }}><AppText variant="bodySmall" tone={step.completed ? 'muted' : 'secondary'} style={step.completed ? { textDecorationLine: 'line-through' } : undefined}>{step.title}</AppText>{step.due_date ? <AppText variant="caption" tone="muted">Due {shortDate(step.due_date)}</AppText> : null}</View></View>)}
          </View> : null}
        </View> : null}
      </RecordViewSheet>
      <ConfirmDialog visible={!!deleteTarget} title="Delete task?" body={deleteTarget ? `Delete “${deleteTarget.title}”? This can’t be undone.` : ''} onCancel={() => setDeleteTarget(null)} onConfirm={() => removeConfirmed().catch(() => undefined)} />
      <CelebrationMoment moment={celebration} onDismiss={dismissCelebration} />
    </AppScreen>
  );
}
