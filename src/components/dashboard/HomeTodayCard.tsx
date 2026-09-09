import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/common/Card';
import { ParticipantIdentityBadge } from '@/components/common/ParticipantIdentityBadge';
import { AppText } from '@/components/common/AppText';
import { AppIcon, type AppIconName } from '@/components/art/AppIcon';
import { FadeSlideIn } from '@/components/motion/Motion';
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
const needText = { affection: 'affection', reassurance: 'reassurance', advice: 'advice', listen: 'someone to listen', distraction: 'a distraction', space: 'some space', call: 'a call', nothing: 'nothing right now' } as const;

function formatEvent(occurrence: EventOccurrence | null) {
  if (!occurrence) return 'Nothing scheduled';
  const event = occurrence.event;
  const when = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: event.all_day ? undefined : 'numeric', minute: event.all_day ? undefined : '2-digit' }).format(occurrence.start);
  return `${event.title} · ${when}`;
}
function localDateKey(date = new Date()) { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; }
function shortDate(dateKey: string) { return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(`${dateKey}T12:00:00`)); }
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
  const activeWindow = open.filter((task) => { const attention = taskAttentionDate(task); return attention != null && attention <= today && (!task.due_date || task.due_date >= today); }).sort((a, b) => (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31'))[0];
  if (activeWindow) return { text: `${open.length} open · Start: ${shortTitle(activeWindow.title)}${activeWindow.estimated_minutes ? ` · ~${durationShortLabel(activeWindow.estimated_minutes)}` : ''}`, tone: 'accent' as const };
  const nextStep = stepDeadlines.sort((a, b) => a.due.localeCompare(b.due))[0];
  if (nextStep) return { text: `${open.length} open · Next step: ${shortTitle(nextStep.step.title)} · ${shortDate(nextStep.due)}`, tone: 'primary' as const };
  const nextTask = open.filter((task) => task.due_date).sort((a, b) => a.due_date!.localeCompare(b.due_date!))[0];
  if (nextTask?.due_date) return { text: `${open.length} open · Next: ${shortTitle(nextTask.title)} · ${shortDate(nextTask.due_date)}`, tone: 'primary' as const };
  return { text: `${open.length} open`, tone: 'primary' as const };
}
function isRecent(entry: MoodEntry | null, hours = 12) { return !!entry && Date.now() - new Date(entry.created_at).getTime() < hours * 3_600_000; }

function Row({ icon, title, value, href, valueTone = 'primary', topBorder = false }: { icon: AppIconName; title: string; value: string; href: string; valueTone?: 'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'warning' | 'error'; topBorder?: boolean }) {
  const theme = useAppTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${value}`} onPress={() => router.push(href as never)} style={({ pressed }) => ({ minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: 10, borderTopWidth: topBorder ? 1 : 0, borderTopColor: theme.colors.border, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.elevatedBackground }}><AppIcon name={icon} size={19} color={theme.colors.textSecondary} /></View>
      <View style={{ flex: 1, gap: 2 }}><AppText variant="bodySmall" tone="secondary" style={{ fontWeight: '700' }}>{title}</AppText><AppText variant="bodySmall" tone={valueTone} numberOfLines={2}>{value}</AppText></View>
      <AppIcon name="chevron" size={16} color={theme.colors.textMuted} />
    </Pressable>
  );
}

export function HomeTodayCard() {
  const theme = useAppTheme();
  const { profile, partnerProfile, partnerColor } = useWorkspace();
  const [tasks, setTasks] = useState<CoupleTask[]>([]);
  const [event, setEvent] = useState<EventOccurrence | null>(null);
  const [question, setQuestion] = useState<DailyQuestionState | null>(null);
  const [moods, setMoods] = useState<{ mine: MoodEntry | null; partner: MoodEntry | null }>({ mine: null, partner: null });

  const refresh = useCallback(async () => {
    const [taskResult, eventResult, questionResult, moodResult] = await Promise.allSettled([getTasks(), getEvents(), getDailyQuestion(), getLatestMoods()]);
    if (taskResult.status === 'fulfilled') setTasks(taskResult.value.filter((task) => task.status !== 'completed'));
    if (eventResult.status === 'fulfilled') { const now = new Date(); setEvent(expandEvents(eventResult.value, now, new Date(now.getTime() + 366 * 86_400_000))[0] ?? null); }
    if (questionResult.status === 'fulfilled') setQuestion(questionResult.value);
    if (moodResult.status === 'fulfilled') setMoods(moodResult.value);
  }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('tasks', refresh); useRealtimeRefresh('events', refresh); useRealtimeRefresh('questions', refresh); useRealtimeRefresh('moods', refresh);

  const taskSummary = useMemo(() => smartTaskSummary(tasks), [tasks]);
  const questionSummary = question?.bothAnswered ? (question.revealed ? 'Both answered · revealed' : 'Both answered · ready to reveal') : question?.myAnswer ? `Waiting for ${partnerProfile?.display_name ?? 'your partner'}` : question?.question ? 'A question is waiting for you' : 'No question today';
  const moodSummary = `${moods.mine ? moodShort[moods.mine.mood] : '—'} ${profile?.display_name ?? 'You'}  ·  ${moods.partner ? moodShort[moods.partner.mood] : '—'} ${partnerProfile?.display_name ?? 'Partner'}`;
  const partnerMood = moods.partner;
  const partnerNeedsAttention = isRecent(partnerMood) && partnerMood?.need !== 'nothing' && !partnerMood?.acknowledged_by_me;
  const revealReady = Boolean(question?.question && question.bothAnswered && !question.revealed);
  const answerWaiting = Boolean(question?.question && !question.myAnswer);

  const priority: 'partner_mood' | 'reveal' | 'question' | null =
    partnerNeedsAttention ? 'partner_mood' : revealReady ? 'reveal' : answerWaiting ? 'question' : null;

  const regularRows: Array<{ icon: AppIconName; title: string; value: string; href: string; tone?: 'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'warning' | 'error' }> = [];
  regularRows.push({ icon: 'calendar', title: 'Calendar', value: formatEvent(event), href: '/features/calendar' });
  regularRows.push({ icon: 'task', title: 'Tasks', value: taskSummary.text, href: '/features/tasks', tone: taskSummary.tone });
  if (!priority || priority === 'partner_mood') regularRows.push({ icon: 'question', title: 'Daily question', value: questionSummary, href: '/features/daily-question' });
  if (priority !== 'partner_mood') regularRows.push({ icon: 'mood', title: 'Check-in', value: moodSummary, href: '/features/mood' });

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ gap: 2 }}>
        <AppText variant="section">Today</AppText>
        <AppText variant="bodySmall" tone="muted">The things that matter right now.</AppText>
      </View>

      {priority === 'partner_mood' && partnerMood ? (
        <FadeSlideIn>
          <Pressable accessibilityRole="button" onPress={() => router.push('/features/mood' as never)}>
            {({ pressed }) => (
              <Card participantColor={partnerColor} style={{ gap: theme.spacing.sm, opacity: pressed ? 0.78 : 1, padding: theme.spacing.lg }}>
                <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
                  <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: theme.colors.partnerAccentSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <AppText variant="section">{moodShort[partnerMood.mood]}</AppText>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <ParticipantIdentityBadge userId={partnerProfile?.id} compact />
                    <AppText variant="cardTitle">{partnerProfile?.display_name ?? 'Your partner'} could use {needText[partnerMood.need]}.</AppText>
                    <AppText variant="bodySmall" tone="secondary">Open their check-in and respond in a way that helps.</AppText>
                  </View>
                  <AppIcon name="chevron" size={17} color={theme.colors.textMuted} />
                </View>
              </Card>
            )}
          </Pressable>
        </FadeSlideIn>
      ) : null}

      {priority === 'reveal' ? (
        <FadeSlideIn>
          <Pressable accessibilityRole="button" onPress={() => router.push('/features/daily-question' as never)}>
            {({ pressed }) => (
              <Card participantColor="both" style={{ gap: theme.spacing.md, opacity: pressed ? 0.78 : 1, padding: theme.spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: theme.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <AppIcon name="spark" size={22} color={theme.colors.textPrimary} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <AppText variant="caption" tone="secondary">YOU’RE BOTH READY</AppText>
                    <AppText variant="cardTitle">Reveal today’s answers</AppText>
                    <AppText variant="bodySmall" tone="secondary">You’ve both answered. Open the question when you want the reveal.</AppText>
                  </View>
                  <AppIcon name="chevron" size={17} color={theme.colors.textMuted} />
                </View>
              </Card>
            )}
          </Pressable>
        </FadeSlideIn>
      ) : null}

      {priority === 'question' ? (
        <FadeSlideIn>
          <Pressable accessibilityRole="button" onPress={() => router.push('/features/daily-question' as never)}>
            {({ pressed }) => (
              <Card participantColor="both" style={{ gap: theme.spacing.md, opacity: pressed ? 0.78 : 1, padding: theme.spacing.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: theme.colors.elevatedBackground, alignItems: 'center', justifyContent: 'center' }}>
                    <AppIcon name="question" size={22} color={theme.colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <AppText variant="caption" tone="secondary">TODAY’S QUESTION</AppText>
                    <AppText variant="cardTitle" numberOfLines={2}>{question?.question?.question ?? 'A question is waiting for you'}</AppText>
                    <AppText variant="bodySmall" tone="secondary">Answer privately. You won’t see each other’s answer until both of you are ready.</AppText>
                  </View>
                  <AppIcon name="chevron" size={17} color={theme.colors.textMuted} />
                </View>
              </Card>
            )}
          </Pressable>
        </FadeSlideIn>
      ) : null}

      <View style={{ paddingHorizontal: theme.spacing.sm }}>
        {regularRows.map((row, index) => <Row key={row.title} icon={row.icon} title={row.title} value={row.value} href={row.href} valueTone={row.tone} topBorder={index > 0} />)}
      </View>
    </View>
  );
}
