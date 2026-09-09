import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FormField } from '@/components/common/FormField';
import { ProgressBar } from '@/components/common/ProgressBar';
import { TagChip } from '@/components/common/TagChip';
import { TagSelector } from '@/components/common/TagSelector';
import { EmptyState } from '@/components/common/EmptyState';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { ParticipantIdentityBadge } from '@/components/common/ParticipantIdentityBadge';
import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';
import { RecordViewSheet } from '@/components/common/RecordViewSheet';
import { DatePickerField } from '@/components/common/DatePickerField';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { IconButton } from '@/components/common/IconButton';
import { AppIcon } from '@/components/art/AppIcon';
import { contributeToGoal, createGoal, deleteGoal, getGoals, getTags, updateGoal } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import type { CoupleGoal, GoalStatus, Tag } from '@/types/database';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }
function amount(goal: CoupleGoal, value: number | string) { const n = Number(value); return goal.unit === '$' ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `${n.toLocaleString()}${goal.unit ? ` ${goal.unit}` : ''}`; }

export default function GoalsScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ focus?: string; edit?: string }>();
  const { colorForUser } = useWorkspace();
  const [goals, setGoals] = useState<CoupleGoal[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [title, setTitle] = useState('');
  const [target, setTarget] = useState('');
  const [current, setCurrent] = useState('0');
  const [unit, setUnit] = useState('$');
  const [deadline, setDeadline] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [contributionOpen, setContributionOpen] = useState<string | null>(null);
  const [contributions, setContributions] = useState<Record<string, string>>({});
  const [viewTarget, setViewTarget] = useState<CoupleGoal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CoupleGoal | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try { const [nextGoals, nextTags] = await Promise.all([getGoals(), getTags()]); setGoals(nextGoals); setTags(nextTags); }
    catch (error) { Alert.alert('Couldn’t load goals', messageFrom(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('goals', refresh); useRealtimeRefresh('tags', refresh);

  function resetEditor(close = true) {
    setEditingId(null); setTitle(''); setTarget(''); setCurrent('0'); setUnit('$'); setDeadline(''); setDescription(''); setSelectedTags([]); if (close) setComposerOpen(false);
  }
  function beginEdit(goal: CoupleGoal) {
    setEditingId(goal.id); setTitle(goal.title); setTarget(String(goal.target_value)); setCurrent(String(goal.current_value)); setUnit(goal.unit); setDeadline(goal.deadline ?? ''); setDescription(goal.description); setSelectedTags((goal.tags ?? []).map((tag) => tag.id)); setComposerOpen(true);
  }
  useEffect(() => {
    if (!params.focus || !goals.length) return;
    const focused = goals.find((goal) => goal.id === params.focus); if (focused) setViewTarget(focused);
  }, [params.focus, goals]);
  useEffect(() => {
    if (!params.edit || editingId === params.edit || !goals.length) return;
    const target = goals.find((goal) => goal.id === params.edit); if (target) beginEdit(target);
  }, [params.edit, editingId, goals]);

  async function saveGoal() {
    const targetValue = Number(target);
    const startingValue = Number(current || '0');
    if (!title.trim() || !Number.isFinite(targetValue) || targetValue <= 0 || (!editingId && (!Number.isFinite(startingValue) || startingValue < 0))) {
      Alert.alert('Check the goal', 'Add a title and a target greater than zero.');
      return;
    }
    setBusy(true);
    try {
      const common = { title: title.trim(), description, targetValue, unit: unit.trim(), deadline: deadline || null, tagIds: selectedTags };
      if (editingId) await updateGoal(editingId, common);
      else await createGoal({ ...common, currentValue: startingValue });
      resetEditor();
      await refresh();
    } catch (error) {
      Alert.alert(editingId ? 'Couldn’t update goal' : 'Couldn’t create goal', messageFrom(error));
    } finally {
      setBusy(false);
    }
  }
  async function contribute(goal: CoupleGoal) {
    const raw = contributions[goal.id] ?? ''; const value = Number(raw);
    if (!Number.isFinite(value) || value === 0) { Alert.alert('Contribution', 'Enter a non-zero number. Negative values can correct a goal total.'); return; }
    try { await contributeToGoal(goal.id, value); setContributions((state) => ({ ...state, [goal.id]: '' })); setContributionOpen(null); await refresh(); }
    catch (error) { Alert.alert('Couldn’t update goal', messageFrom(error)); }
  }
  async function setGoalStatus(goal: CoupleGoal, status: GoalStatus) { try { await updateGoal(goal.id, { status }); await refresh(); } catch (error) { Alert.alert('Couldn’t update goal', messageFrom(error)); } }
  async function removeConfirmed() { const goal = deleteTarget; setDeleteTarget(null); if (!goal) return; try { await deleteGoal(goal.id); setGoals((currentGoals) => currentGoals.filter((item) => item.id !== goal.id)); if (editingId === goal.id) resetEditor(); } catch (error) { Alert.alert('Couldn’t delete goal', messageFrom(error)); } }
  function openGoalMenu(goal: CoupleGoal) {
    const actions: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[] = [
      { text: 'Edit goal', onPress: () => beginEdit(goal) },
    ];
    if (goal.status === 'active') actions.push({ text: 'Pause goal', onPress: () => setGoalStatus(goal, 'paused') });
    if (goal.status === 'paused') actions.push({ text: 'Resume goal', onPress: () => setGoalStatus(goal, 'active') });
    if (goal.status !== 'completed') actions.push({ text: 'Mark complete', onPress: () => setGoalStatus(goal, 'completed') });
    if (goal.status === 'completed' && Number(goal.current_value) < Number(goal.target_value)) actions.push({ text: 'Reopen goal', onPress: () => setGoalStatus(goal, 'active') });
    actions.push({ text: 'Delete goal', style: 'destructive', onPress: () => setDeleteTarget(goal) }, { text: 'Cancel', style: 'cancel' });
    Alert.alert(goal.title, 'Manage this goal', actions);
  }

  return (
    <AppScreen>
      <BackHeader eyebrow="Plan" title="Shared goals" subtitle="Things you’re working toward together." />
      <CollapsibleComposer title={editingId ? 'Edit goal' : 'Our goals'} subtitle={editingId ? 'Update the target, deadline or details.' : `${goals.filter((goal) => goal.status === 'active').length} active`} open={composerOpen} actionLabel="New goal" closeLabel={editingId ? 'Cancel edit' : 'Close'} tone="accent" style={{ marginBottom: theme.spacing.xxl }} onToggle={() => composerOpen ? resetEditor() : setComposerOpen(true)}>
        <FormField label="GOAL" value={title} onChangeText={setTitle} placeholder="Next visit fund" />
        <FormField label="DESCRIPTION · OPTIONAL" value={description} onChangeText={setDescription} placeholder="What this gets us closer to…" multiline />
        {!editingId ? <FormField label="STARTING AMOUNT · OPTIONAL" value={current} onChangeText={setCurrent} keyboardType="decimal-pad" placeholder="0" /> : <AppText variant="bodySmall" tone="muted">Progress is changed through Add progress so the contribution history always matches the total.</AppText>}
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}><View style={{ flex: 1 }}><FormField label="TARGET" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="4000" /></View><View style={{ width: 84 }}><FormField label="UNIT" value={unit} onChangeText={setUnit} placeholder="$" /></View></View>
        <DatePickerField label="DEADLINE · OPTIONAL" value={deadline} onChange={setDeadline} optional />
        <TagSelector tags={tags} selectedIds={selectedTags} onChange={setSelectedTags} />
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}><View style={{ flex: 1 }}><AppButton label={busy ? 'Saving…' : editingId ? 'Save goal' : 'Create goal'} disabled={busy || !title.trim() || !target.trim()} onPress={saveGoal} /></View>{editingId ? <AppButton compact variant="secondary" label="Cancel" onPress={() => resetEditor()} /> : null}</View>
      </CollapsibleComposer>

      <View style={{ gap: theme.spacing.md }}>
        {loading ? <AppText tone="muted">Loading goals…</AppText> : null}
        {!loading && goals.length === 0 ? <EmptyState icon="goal" title="Pick something worth moving toward" body="Your first shared goal will show progress from both of you." actionLabel="Create a goal" onAction={() => setComposerOpen(true)} /> : null}
        {goals.map((goal) => {
          const currentValue = Number(goal.current_value); const targetValue = Number(goal.target_value); const percent = Math.max(0, Math.min(100, targetValue ? (currentValue / targetValue) * 100 : 0));
          const openContribution = contributionOpen === goal.id;
          const contributionsByUser: Record<string, number> = (goal.contributions ?? []).reduce((acc: Record<string, number>, entry) => { acc[entry.creator_id] = (acc[entry.creator_id] ?? 0) + Number(entry.amount); return acc; }, {} as Record<string, number>);
          return (
            <Card key={goal.id} participantColor="both" style={{ gap: theme.spacing.md, borderColor: editingId === goal.id ? theme.colors.accent : theme.colors.border }}>
              <View style={{ gap: theme.spacing.md }}>
                <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' }}><Pressable accessibilityRole="button" accessibilityLabel={`Open goal ${goal.title}`} onPress={() => setViewTarget(goal)} style={({ pressed }) => ({ flex: 1, gap: 5, opacity: pressed ? 0.76 : 1 })}><AppText variant="cardTitle">{goal.title}</AppText><ParticipantAttribution userId={goal.creator_id} />{goal.description ? <AppText variant="bodySmall" tone="secondary" numberOfLines={2}>{goal.description}</AppText> : <AppText variant="bodySmall" tone="muted">Tap to view this goal.</AppText>}</Pressable><IconButton icon="overflow" label={`More actions for ${goal.title}`} onPress={() => openGoalMenu(goal)} /></View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}><AppText variant="section">{amount(goal, currentValue)} / {amount(goal, targetValue)}</AppText><AppText variant="cardTitle" tone={percent >= 100 ? 'success' : 'secondary'}>{Math.round(percent)}%</AppText></View>
                <ProgressBar value={percent} />
                {Object.keys(contributionsByUser).length > 0 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{Object.entries(contributionsByUser).map(([userId, value]) => <ParticipantIdentityBadge key={userId} userId={userId} detail={amount(goal, Number(value))} compact />)}</View> : null}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{goal.deadline ? <TagChip subtle label={`BY ${goal.deadline}`} /> : null}<TagChip subtle label={goal.status.toUpperCase()} />{(goal.tags ?? []).slice(0, 3).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}</View>
              </View>
              {goal.status === 'active' ? <View style={{ gap: theme.spacing.sm }}><Pressable accessibilityRole="button" onPress={() => setContributionOpen(openContribution ? null : goal.id)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><AppIcon name="plus" size={16} color={theme.colors.accent} /><AppText variant="bodySmall" tone="accent">Add progress</AppText></View><AppIcon name={openContribution ? 'chevronUp' : 'chevronDown'} size={15} color={theme.colors.textMuted} /></Pressable>{openContribution ? <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}><View style={{ flex: 1 }}><FormField label="AMOUNT" value={contributions[goal.id] ?? ''} onChangeText={(value) => setContributions((state) => ({ ...state, [goal.id]: value }))} keyboardType="decimal-pad" placeholder="100" /></View><AppButton compact label="Add" onPress={() => contribute(goal)} disabled={!contributions[goal.id]?.trim()} /></View> : null}</View> : goal.status === 'paused' ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><AppText variant="bodySmall" tone="muted">Goal paused</AppText></View> : <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><AppIcon name="spark" size={16} color={theme.colors.success} /><AppText variant="bodySmall" tone="success">{percent >= 100 ? 'Goal reached' : 'Goal marked complete'}</AppText></View>}
            </Card>
          );
        })}
      </View>
      <RecordViewSheet visible={!!viewTarget} onClose={() => setViewTarget(null)} eyebrow="Shared goal" title={viewTarget?.title ?? ''}>
        {viewTarget ? <View style={{ gap: theme.spacing.md }}>
          <ParticipantAttribution userId={viewTarget.creator_id} />
          {viewTarget.description ? <AppText tone="secondary">{viewTarget.description}</AppText> : null}
          <AppText variant="section">{amount(viewTarget, viewTarget.current_value)} / {amount(viewTarget, viewTarget.target_value)}</AppText>
          <ProgressBar value={Math.max(0, Math.min(100, Number(viewTarget.target_value) ? (Number(viewTarget.current_value) / Number(viewTarget.target_value)) * 100 : 0))} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <TagChip subtle label={viewTarget.status.toUpperCase()} />
            {viewTarget.deadline ? <TagChip subtle label={`BY ${viewTarget.deadline}`} /> : null}
            {(viewTarget.tags ?? []).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}
          </View>
          {(viewTarget.contributions ?? []).length ? <View style={{ gap: 7 }}><AppText variant="cardTitle">Contribution history</AppText>{(viewTarget.contributions ?? []).slice(-8).reverse().map((entry) => <ParticipantIdentityBadge key={entry.id} userId={entry.creator_id} detail={amount(viewTarget, Number(entry.amount))} compact />)}</View> : null}
        </View> : null}
      </RecordViewSheet>
      <ConfirmDialog visible={!!deleteTarget} title="Delete goal?" body={deleteTarget ? `Delete “${deleteTarget.title}” and its contribution history?` : ''} onCancel={() => setDeleteTarget(null)} onConfirm={() => removeConfirmed().catch(() => undefined)} />
    </AppScreen>
  );
}
