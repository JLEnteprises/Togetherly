import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { getTasks } from '@/services/backend/coreFeatures';
import { getDailyQuestion, getEvents, getLatestMoods } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import { expandEvents, type EventOccurrence } from '@/utils/calendar';
import type { CoupleTask, DailyQuestionState, MoodEntry, MoodValue } from '@/types/database';
import { durationShortLabel, taskAttentionDate } from '@/utils/taskTiming';

const moodShort: Record<MoodValue, string> = {
  amazing: '😄', good: '🙂', okay: '😐', low: '😔', frustrated: '😡', overwhelmed: '😫', tired: '😴', stressed: '😰',
};

function formatEvent(occurrence: EventOccurrence | null) {
  if (!occurrence) return 'Nothing scheduled';
  const event = occurrence.event;
  const when = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: event.all_day ? undefined : 'numeric',
    minute: event.all_day ? undefined : '2-digit',
  }).format(occurrence.start);
  return `${event.title} · ${when}`;
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function shortDate(dateKey: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${dateKey}T12:00:00`));
}
function shortTitle(value: string) { return value.length > 30 ? `${value.slice(0, 28)}…` : value; }
function smartTaskSummary(tasks: CoupleTask[]) {
  const open = tasks.filter((task) => task.status !== 'completed' && task.status !== 'skipped');
  if (!open.length) return { text: 'Nothing open', tone: 'muted' as const };
  const today = localDateKey();
  const stepDeadlines = open.flatMap((task) => (task.subtasks ?? []).filter((step) => !step.completed && step.due_date).map((step) => ({ task, step, due: step.due_date! })));
  const overdueStep = stepDeadlines.filter((item) => item.due < today).sort((a, b) => a.due.localeCompare(b.due))[0];
  if (overdueStep) return { text: `${open.length} open · Step overdue: ${shortTitle(overdueStep.step.title)}`, tone: 'error' as const };
  const high = open.filter((task) => task.priority === 'high').sort((a, b) => (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31'))[0];
  if (high) return { text: `${open.length} open · High: ${shortTitle(high.title)}${high.due_date ? ` · ${shortDate(high.due_date)}` : ''}`, tone: 'warning' as const };
  const activeWindow = open.filter((task) => {
    const attention = taskAttentionDate(task);
    return attention != null && attention <= today && (!task.due_date || task.due_date >= today);
  }).sort((a, b) => (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31'))[0];
  if (activeWindow) return { text: `${open.length} open · Start: ${shortTitle(activeWindow.title)}${activeWindow.estimated_minutes ? ` · ~${durationShortLabel(activeWindow.estimated_minutes)}` : ''}`, tone: 'accent' as const };
  const nextStep = stepDeadlines.sort((a, b) => a.due.localeCompare(b.due))[0];
  if (nextStep) return { text: `${open.length} open · Next step: ${shortTitle(nextStep.step.title)} · ${shortDate(nextStep.due)}`, tone: 'primary' as const };
  const nextTask = open.filter((task) => task.due_date).sort((a, b) => a.due_date!.localeCompare(b.due_date!))[0];
  if (nextTask?.due_date) return { text: `${open.length} open · Next: ${shortTitle(nextTask.title)} · ${shortDate(nextTask.due_date)}`, tone: 'primary' as const };
  return { text: `${open.length} open`, tone: 'primary' as const };
}

function Row({ icon, title, value, href, valueTone = 'primary' }: { icon: string; title: string; value: string; href: string; valueTone?: 'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'warning' | 'error' }) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${value}`}
      onPress={() => router.push(href as never)}
      style={({ pressed }) => ({
        minHeight: 52,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: 8,
        paddingHorizontal: theme.spacing.sm,
        borderRadius: theme.radii.md,
        backgroundColor: pressed ? theme.colors.elevatedBackground : 'transparent',
        opacity: pressed ? 0.82 : 1,
      })}
    >
      <View style={{ width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.elevatedBackground }}>
        <AppText variant="cardTitle" tone="accent">{icon}</AppText>
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <AppText variant="bodySmall" tone="secondary" style={{ fontWeight: '600' }}>{title}</AppText>
        <AppText variant="bodySmall" tone={valueTone} numberOfLines={2}>{value}</AppText>
      </View>
      <AppText tone="muted">›</AppText>
    </Pressable>
  );
}

export function HomeTodayCard() {
  const theme = useAppTheme();
  const { profile, partnerProfile } = useWorkspace();
  const [tasks, setTasks] = useState<CoupleTask[]>([]);
  const [event, setEvent] = useState<EventOccurrence | null>(null);
  const [question, setQuestion] = useState<DailyQuestionState | null>(null);
  const [moods, setMoods] = useState<{ mine: MoodEntry | null; partner: MoodEntry | null }>({ mine: null, partner: null });

  const refresh = useCallback(async () => {
    const [taskResult, eventResult, questionResult, moodResult] = await Promise.allSettled([
      getTasks(), getEvents(), getDailyQuestion(), getLatestMoods(),
    ]);
    if (taskResult.status === 'fulfilled') setTasks(taskResult.value.filter((task) => task.status !== 'completed'));
    if (eventResult.status === 'fulfilled') {
      const now = new Date();
      setEvent(expandEvents(eventResult.value, now, new Date(now.getTime() + 366 * 86_400_000))[0] ?? null);
    }
    if (questionResult.status === 'fulfilled') setQuestion(questionResult.value);
    if (moodResult.status === 'fulfilled') setMoods(moodResult.value);
  }, []);

  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('tasks', refresh);
  useRealtimeRefresh('events', refresh);
  useRealtimeRefresh('questions', refresh);
  useRealtimeRefresh('moods', refresh);

  const taskSummary = useMemo(() => smartTaskSummary(tasks), [tasks]);
  const questionSummary = question?.bothAnswered
    ? 'Both answered · tap to reveal'
    : question?.myAnswer
      ? `Waiting for ${partnerProfile?.display_name ?? 'your partner'}`
      : question?.question
        ? 'Ready when you are'
        : 'No question today';
  const moodSummary = `${moods.mine ? moodShort[moods.mine.mood] : '—'} ${profile?.display_name ?? 'You'}  ·  ${moods.partner ? moodShort[moods.partner.mood] : '—'} ${partnerProfile?.display_name ?? 'Partner'}`;

  return (
    <Card participantColor="both" style={{ gap: theme.spacing.xs }}>
      <AppText variant="section">Today</AppText>
      <Row icon="◷" title="Calendar" value={formatEvent(event)} href="/features/calendar" />
      <Row icon="✓" title="Tasks" value={taskSummary.text} valueTone={taskSummary.tone} href="/features/tasks" />
      <Row icon="?" title="Daily question" value={questionSummary} href="/features/daily-question" />
      <Row icon="☾" title="Check-in" value={moodSummary} href="/features/mood" />
    </Card>
  );
}
