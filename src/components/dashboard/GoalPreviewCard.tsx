import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { ProgressBar } from '@/components/common/ProgressBar';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { getGoals } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import type { CoupleGoal } from '@/types/database';

export function GoalPreviewCard() {
  const theme = useAppTheme();
  const { colorForUser } = useWorkspace();
  const [goal, setGoal] = useState<CoupleGoal | null>(null);
  const refresh = useCallback(async () => { const goals = await getGoals(); setGoal(goals.find((item) => item.status !== 'completed') ?? goals[0] ?? null); }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('goals', refresh);
  const current = Number(goal?.current_value ?? 0); const target = Number(goal?.target_value ?? 0); const percent = target ? Math.min(100, Math.max(0, current / target * 100)) : 0;
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/features/goals' as never)}>
      {({ pressed }) => <Card participantColor={goal ? colorForUser(goal.creator_id) : 'both'} style={{ gap: theme.spacing.md, opacity: pressed ? 0.76 : 1 }}>{goal ? <><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}><View style={{ flex: 1 }}><AppText variant="caption" tone="secondary">SHARED GOAL</AppText><AppText variant="section">{goal.title}</AppText></View><AppText variant="cardTitle" tone="secondary">{Math.round(percent)}%</AppText></View><ParticipantAttribution userId={goal.creator_id} /><ProgressBar value={percent} /><AppText variant="bodySmall" tone="secondary">{current.toLocaleString()} / {target.toLocaleString()} {goal.unit}</AppText></> : <><AppText variant="caption" tone="secondary">SHARED GOALS</AppText><AppText variant="section">Choose something to work toward.</AppText><AppText variant="bodySmall" tone="secondary">Tap to create your first goal.</AppText></>}</Card>}
    </Pressable>
  );
}
