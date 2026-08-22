import { View } from 'react-native';
import type { Task } from '@/types/product';
import { AppText } from '@/components/common/AppText';
import { useAppTheme } from '@/theme/useAppTheme';

export function TaskRow({ task }: { task: Task }) {
  const theme = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.sm }}>
      <View style={{ width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, borderColor: task.completed ? theme.colors.success : theme.colors.border, backgroundColor: task.completed ? theme.colors.secondarySoft : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        {task.completed ? <AppText variant="caption" tone="success">✓</AppText> : null}
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodySmall" style={task.completed ? { textDecorationLine: 'line-through' } : undefined}>{task.title}</AppText>
        <AppText variant="caption" tone="muted">{task.assignee}{task.dueLabel ? ` · ${task.dueLabel}` : ''}</AppText>
      </View>
    </View>
  );
}
