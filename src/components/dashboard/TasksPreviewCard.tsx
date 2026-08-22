import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { TagChip } from '@/components/common/TagChip';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { getTasks, updateTask } from '@/services/backend/coreFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import type { CoupleTask } from '@/types/database';
import { useAppTheme } from '@/theme/useAppTheme';
import { participantPalettes } from '@/theme/tokens';
import { useWorkspace } from '@/providers/WorkspaceProvider';

export function TasksPreviewCard() {
  const theme = useAppTheme();
  const { colorForUser } = useWorkspace();
  const [tasks, setTasks] = useState<CoupleTask[]>([]);
  const refresh = useCallback(async () => setTasks((await getTasks()).filter((task) => task.status !== 'completed').slice(0, 3)), []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('tasks', refresh);

  async function toggle(task: CoupleTask) {
    setTasks((current) => current.filter((item) => item.id !== task.id));
    await updateTask(task.id, { status: 'completed' }).catch(() => refresh());
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText variant="section">Shared tasks</AppText>
        <Pressable accessibilityRole="button" onPress={() => router.push('/features/tasks' as never)}><AppText variant="bodySmall" tone="accent">See all</AppText></Pressable>
      </View>
      <Card style={{ gap: theme.spacing.sm }}>
        {tasks.length === 0 ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/features/tasks' as never)}>
            <AppText variant="bodySmall" tone="secondary">Nothing due right now. Tap to add something together.</AppText>
          </Pressable>
        ) : tasks.map((task, index) => {
          const creatorColor = colorForUser(task.creator_id);
          const palette = creatorColor === 'both' ? null : participantPalettes[creatorColor];
          return (
            <Pressable accessibilityRole="button" key={task.id} onPress={() => toggle(task)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md, paddingVertical: 9, borderBottomWidth: index === tasks.length - 1 ? 0 : 1, borderBottomColor: theme.colors.border }}>
              <View style={{ width: 24, height: 24, borderRadius: 8, borderWidth: 1, borderColor: palette?.accent ?? theme.colors.textMuted, alignItems: 'center', justifyContent: 'center', marginTop: 1 }} />
              <View style={{ flex: 1, gap: 3 }}>
                <AppText variant="bodySmall">{task.title}</AppText>
                <ParticipantAttribution userId={task.creator_id} />
                <AppText variant="caption" tone="muted">Assigned: {task.assign_to_both ? 'Both' : task.assignee_name ?? 'Assigned'}</AppText>
              </View>
              {task.priority === 'high' ? <TagChip subtle label="HIGH" /> : null}
            </Pressable>
          );
        })}
      </Card>
    </View>
  );
}
