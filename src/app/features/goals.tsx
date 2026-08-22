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
import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';
import { DatePickerField } from '@/components/common/DatePickerField';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { contributeToGoal, createGoal, deleteGoal, getGoals, getTags, updateGoal } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import type { CoupleGoal, GoalStatus, Tag } from '@/types/database';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }
function amount(goal: CoupleGoal, value: number | string) { const n = Number(value); return goal.unit === '$' ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `${n.toLocaleString()}${goal.unit ? ` ${goal.unit}` : ''}`; }

export default function GoalsScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ focus?: string }>();
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
    if (!params.focus || editingId === params.focus || !goals.length) return;
    const focused = goals.find((goal) => goal.id === params.focus); if (focused) beginEdit(focused);
  }, [params.focus, goals]);

  async function saveGoal() {
    const targetValue = Number(target); const currentValue = Number(current || '0');
    if (!title.trim() || !Number.isFinite(targetValue) || targetValue <= 0 || !Number.isFinite(currentValue) || currentValue < 0) { Alert.alert('Check the goal', 'Add a title and a target greater than zero.'); return; }
    setBusy(true);
    try {
      const input = { title: title.trim(), description, currentValue, targetValue, unit: unit.trim(), deadline: deadline || null, tagIds: selectedTags };
      if (editingId) await updateGoal(editingId, input); else await createGoal(input);
      resetEditor(); await refresh();
    } catch (error) { Alert.alert(editingId ? 'Couldn’t update goal' : 'Couldn’t create goal', messageFrom(error)); }
    finally { setBusy(false); }
  }
  async function contribute(goal: CoupleGoal) {
    const raw = contributions[goal.id] ?? ''; const value = Number(raw);
    if (!Number.isFinite(value) || value === 0) { Alert.alert('Contribution', 'Enter a non-zero number. Negative values can correct a goal total.'); return; }
    try { await contributeToGoal(goal.id, value); setContributions((state) => ({ ...state, [goal.id]: '' })); setContributionOpen(null); await refresh(); }
    catch (error) { Alert.alert('Couldn’t update goal', messageFrom(error)); }
  }
  async function setGoalStatus(goal: CoupleGoal, status: GoalStatus) { try { await updateGoal(goal.id, { status }); await refresh(); } catch (error) { Alert.alert('Couldn’t update goal', messageFrom(error)); } }
  async function removeConfirmed() { const goal = deleteTarget; setDeleteTarget(null); if (!goal) return; try { await deleteGoal(goal.id); setGoals((currentGoals) => currentGoals.filter((item) => item.id !== goal.id)); if (editingId === goal.id) resetEditor(); } catch (error) { Alert.alert('Couldn’t delete goal', messageFrom(error)); } }

  return (
    <AppScreen>
      <BackHeader eyebrow="Plan" title="Shared goals" subtitle="Things you’re working toward together." />
      <CollapsibleComposer title={editingId ? 'Edit goal' : 'Our goals'} subtitle={editingId ? 'Update the target, deadline or details.' : `${goals.filter((goal) => goal.status === 'active').length} active`} open={composerOpen} actionLabel="New goal" closeLabel={editingId ? 'Cancel edit' : 'Close'} tone="accent" style={{ marginBottom: theme.spacing.xxl }} onToggle={() => composerOpen ? resetEditor() : setComposerOpen(true)}>
        <FormField label="GOAL" value={title} onChangeText={setTitle} placeholder="Next visit fund" />
        <FormField label="DESCRIPTION · OPTIONAL" value={description} onChangeText={setDescription} placeholder="What this gets us closer to…" multiline />
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}><View style={{ flex: 1 }}><FormField label="CURRENT" value={current} onChangeText={setCurrent} keyboardType="decimal-pad" placeholder="0" /></View><View style={{ flex: 1 }}><FormField label="TARGET" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="4000" /></View><View style={{ width: 84 }}><FormField label="UNIT" value={unit} onChangeText={setUnit} placeholder="$" /></View></View>
        <DatePickerField label="DEADLINE · OPTIONAL" value={deadline} onChange={setDeadline} optional />
        <TagSelector tags={tags} selectedIds={selectedTags} onChange={setSelectedTags} />
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}><View style={{ flex: 1 }}><AppButton label={busy ? 'Saving…' : editingId ? 'Save goal' : 'Create goal'} disabled={busy || !title.trim() || !target.trim()} onPress={saveGoal} /></View>{editingId ? <AppButton compact variant="secondary" label="Cancel" onPress={() => resetEditor()} /> : null}</View>
      </CollapsibleComposer>

      <View style={{ gap: theme.spacing.md }}>
        {loading ? <AppText tone="muted">Loading goals…</AppText> : null}
        {!loading && goals.length === 0 ? <EmptyState icon="◎" title="Pick something worth moving toward" body="Your first shared goal will show progress from both of you." actionLabel="Create a goal" onAction={() => setComposerOpen(true)} /> : null}
        {goals.map((goal) => {
          const currentValue = Number(goal.current_value); const targetValue = Number(goal.target_value); const percent = Math.max(0, Math.min(100, targetValue ? (currentValue / targetValue) * 100 : 0));
          const openContribution = contributionOpen === goal.id;
          const contributionsByUser: Record<string, number> = (goal.contributions ?? []).reduce((acc: Record<string, number>, entry) => { acc[entry.creator_id] = (acc[entry.creator_id] ?? 0) + Number(entry.amount); return acc; }, {} as Record<string, number>);
          return (
            <Card key={goal.id} participantColor={colorForUser(goal.creator_id)} style={{ gap: theme.spacing.md, borderColor: editingId === goal.id ? theme.colors.accent : theme.colors.border }}>
              <Pressable accessibilityRole="button" onPress={() => beginEdit(goal)} style={{ gap: theme.spacing.md }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}><View style={{ flex: 1, gap: 5 }}><AppText variant="cardTitle">{goal.title}</AppText><ParticipantAttribution userId={goal.creator_id} />{goal.description ? <AppText variant="bodySmall" tone="secondary">{goal.description}</AppText> : null}</View><AppText tone="muted">›</AppText></View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}><AppText variant="section">{amount(goal, currentValue)} / {amount(goal, targetValue)}</AppText><AppText variant="cardTitle" tone={percent >= 100 ? 'success' : 'secondary'}>{Math.round(percent)}%</AppText></View>
                <ProgressBar value={percent} />
                {Object.keys(contributionsByUser).length > 0 ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{Object.entries(contributionsByUser).map(([userId, value]) => <TagChip key={userId} participantColor={colorForUser(userId)} label={amount(goal, Number(value))} />)}</View> : null}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{goal.deadline ? <TagChip subtle label={`BY ${goal.deadline}`} /> : null}<TagChip subtle label={goal.status.toUpperCase()} />{(goal.tags ?? []).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}</View>
              </Pressable>
              {goal.status !== 'completed' ? <View style={{ gap: theme.spacing.sm }}><Pressable accessibilityRole="button" onPress={() => setContributionOpen(openContribution ? null : goal.id)} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><AppText variant="bodySmall" tone="accent">＋ Add progress</AppText><AppText tone="muted">{openContribution ? '⌃' : '⌄'}</AppText></Pressable>{openContribution ? <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}><View style={{ flex: 1 }}><FormField label="AMOUNT" value={contributions[goal.id] ?? ''} onChangeText={(value) => setContributions((state) => ({ ...state, [goal.id]: value }))} keyboardType="decimal-pad" placeholder="100" /></View><AppButton compact label="Add" onPress={() => contribute(goal)} disabled={!contributions[goal.id]?.trim()} /></View> : null}</View> : <AppText variant="bodySmall" tone="success">Goal reached ✦</AppText>}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}><AppButton compact variant="ghost" label="Edit" onPress={() => beginEdit(goal)} />{goal.status === 'active' ? <AppButton compact variant="ghost" label="Pause" onPress={() => setGoalStatus(goal, 'paused')} /> : null}{goal.status === 'paused' ? <AppButton compact variant="ghost" label="Resume" onPress={() => setGoalStatus(goal, 'active')} /> : null}{goal.status !== 'completed' ? <AppButton compact variant="ghost" label="Mark complete" onPress={() => setGoalStatus(goal, 'completed')} /> : null}{goal.status === 'completed' && currentValue < targetValue ? <AppButton compact variant="ghost" label="Reopen" onPress={() => setGoalStatus(goal, 'active')} /> : null}<AppButton compact variant="danger" label="Delete" onPress={() => setDeleteTarget(goal)} /></View>
            </Card>
          );
        })}
      </View>
      <ConfirmDialog visible={!!deleteTarget} title="Delete goal?" body={deleteTarget ? `Delete “${deleteTarget.title}” and its contribution history?` : ''} onCancel={() => setDeleteTarget(null)} onConfirm={() => removeConfirmed().catch(() => undefined)} />
    </AppScreen>
  );
}
