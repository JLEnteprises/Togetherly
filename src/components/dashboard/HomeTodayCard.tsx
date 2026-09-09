import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/common/Card';
import { ParticipantIdentityBadge } from '@/components/common/ParticipantIdentityBadge';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { AppIcon, type AppIconName } from '@/components/art/AppIcon';
import { FadeSlideIn } from '@/components/motion/Motion';
import { getTasks } from '@/services/backend/coreFeatures';
import { acknowledgeMood, getDailyQuestion, getEvents, getLatestMoods } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import { expandEvents, type EventOccurrence } from '@/utils/calendar';
import type { CoupleTask, DailyQuestionState, MoodEntry, MoodValue } from '@/types/database';
import { durationShortLabel, taskAttentionDate } from '@/utils/taskTiming';
import { moodSupportForNeed } from '@/utils/moodSupport';

const moodShort: Record<MoodValue, string> = {
  amazing: '😄', good: '🙂', okay: '😐', low: '😔', frustrated: '😡', overwhelmed: '😫', tired: '😴', stressed: '😰',
};

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }
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

type StatusTone = 'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'warning' | 'error';
function StatusRow({ icon, title, value, valueTone = 'primary', topBorder = false, href }: { icon: AppIconName; title: string; value: string; valueTone?: StatusTone; topBorder?: boolean; href: string }) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${value}`}
      accessibilityHint={`Open ${title}`}
      onPress={() => router.push(href as never)}
    >
      {({ pressed }) => (
        <View style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: 9, borderTopWidth: topBorder ? 1 : 0, borderTopColor: theme.colors.border, opacity: pressed ? 0.72 : 1 }}>
          <View style={{ width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.elevatedBackground }}><AppIcon name={icon} size={18} color={theme.colors.textSecondary} /></View>
          <View style={{ flex: 1, gap: 2 }}><AppText variant="bodySmall" tone="secondary" style={{ fontWeight: '700' }}>{title}</AppText><AppText variant="bodySmall" tone={valueTone} numberOfLines={2}>{value}</AppText></View>
          <AppIcon name="chevron" size={15} color={theme.colors.textMuted} />
        </View>
      )}
    </Pressable>
  );
}

// G2_HOME_DECLUTTER: Home stays glanceable while each surfaced status now leads directly to the thing it describes.
// CONTEXT_COMPOUNDING: realtime changes refresh only their own domain and mood needs determine the support language/action.
export function HomeTodayCard() {
  const theme = useAppTheme();
  const { profile, partnerProfile, partnerColor } = useWorkspace();
  const [tasks, setTasks] = useState<CoupleTask[]>([]);
  const [event, setEvent] = useState<EventOccurrence | null>(null);
  const [question, setQuestion] = useState<DailyQuestionState | null>(null);
  const [moods, setMoods] = useState<{ mine: MoodEntry | null; partner: MoodEntry | null }>({ mine: null, partner: null });
  const [acknowledgingMood, setAcknowledgingMood] = useState(false);

  const refreshTasks = useCallback(async () => {
    const next = await getTasks();
    setTasks(next.filter((task) => task.status !== 'completed'));
  }, []);
  const refreshEvents = useCallback(async () => {
    const next = await getEvents();
    const now = new Date();
    setEvent(expandEvents(next, now, new Date(now.getTime() + 366 * 86_400_000))[0] ?? null);
  }, []);
  const refreshQuestion = useCallback(async () => { setQuestion(await getDailyQuestion()); }, []);
  const refreshMoods = useCallback(async () => { setMoods(await getLatestMoods()); }, []);
  const refreshAll = useCallback(async () => {
    await Promise.allSettled([refreshTasks(), refreshEvents(), refreshQuestion(), refreshMoods()]);
  }, [refreshEvents, refreshMoods, refreshQuestion, refreshTasks]);

  useEffect(() => { refreshAll().catch(() => undefined); }, [refreshAll]);
  useRealtimeRefresh('tasks', refreshTasks);
  useRealtimeRefresh('events', refreshEvents);
  useRealtimeRefresh('questions', refreshQuestion);
  useRealtimeRefresh('moods', refreshMoods);

  const taskSummary = useMemo(() => smartTaskSummary(tasks), [tasks]);
  const questionSummary = question?.bothAnswered ? (question.revealed ? 'Both answered · revealed' : 'Both answered · ready to reveal') : question?.myAnswer ? `Waiting for ${partnerProfile?.display_name ?? 'your partner'}` : question?.question ? 'A question is waiting for you' : 'No question today';
  const moodSummary = `${moods.mine ? moodShort[moods.mine.mood] : '—'} ${profile?.display_name ?? 'You'}  ·  ${moods.partner ? moodShort[moods.partner.mood] : '—'} ${partnerProfile?.display_name ?? 'Partner'}`;
  const partnerMood = moods.partner;
  const partnerSupport = partnerMood ? moodSupportForNeed(partnerMood.need) : null;
  const partnerNeedsAttention = isRecent(partnerMood) && partnerMood?.need !== 'nothing' && !partnerMood?.acknowledged_by_me;
  const revealReady = Boolean(question?.question && question.bothAnswered && !question.revealed);
  const answerWaiting = Boolean(question?.question && !question.myAnswer);

  const priority: 'partner_mood' | 'reveal' | 'question' | null =
    partnerNeedsAttention ? 'partner_mood' : revealReady ? 'reveal' : answerWaiting ? 'question' : null;

  async function acknowledgePartnerMood() {
    if (!partnerMood || acknowledgingMood) return;
    setAcknowledgingMood(true);
    try {
      await acknowledgeMood(partnerMood.id);
      setMoods((current) => current.partner?.id === partnerMood.id
        ? { ...current, partner: { ...current.partner, acknowledged_by_me: true, acknowledged_at: new Date().toISOString() } }
        : current);
    } catch (error) {
      Alert.alert('Couldn’t send support', messageFrom(error));
    } finally {
      setAcknowledgingMood(false);
    }
  }

  const regularRows: Array<{ icon: AppIconName; title: string; value: string; tone?: StatusTone; href: string }> = [
    { icon: 'calendar', title: 'Calendar', value: formatEvent(event), href: '/features/calendar' },
    { icon: 'task', title: 'Tasks', value: taskSummary.text, tone: taskSummary.tone, href: '/features/tasks' },
  ];
  if (!priority) {
    regularRows.push({ icon: 'question', title: 'Daily question', value: questionSummary, href: '/features/daily-question' });
    regularRows.push({ icon: 'mood', title: 'How we are', value: moodSummary, href: '/features/mood' });
  } else if (priority !== 'partner_mood') {
    regularRows.push({ icon: 'mood', title: 'How we are', value: moodSummary, href: '/features/mood' });
  }

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {priority ? (
        <View style={{ gap: theme.spacing.sm }}>
          <View style={{ gap: 2 }}>
            <AppText variant="section">Right now</AppText>
            <AppText variant="bodySmall" tone="muted">The relationship moment that matters most right now.</AppText>
          </View>

          {priority === 'partner_mood' && partnerMood && partnerSupport ? (
            <FadeSlideIn>
              <Card participantColor={partnerColor} style={{ gap: theme.spacing.md, padding: theme.spacing.lg }}>
                <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'center' }}>
                  <View style={{ width: 48, height: 48, borderRadius: 17, backgroundColor: theme.colors.partnerAccentSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <AppText variant="section">{moodShort[partnerMood.mood]}</AppText>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <ParticipantIdentityBadge userId={partnerProfile?.id} compact />
                    <AppText variant="cardTitle">{partnerProfile?.display_name ?? 'Your partner'} could use {partnerSupport.needLabel}.</AppText>
                    <AppText variant="bodySmall" tone="secondary">{partnerSupport.helper}</AppText>
                  </View>
                </View>
                <View style={{ gap: theme.spacing.sm }}>
                  <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                    <View style={{ flex: 1 }}><AppButton compact icon="heart" label={acknowledgingMood ? 'Sending…' : partnerSupport.actionLabel} disabled={acknowledgingMood} onPress={() => void acknowledgePartnerMood()} /></View>
                    <View style={{ flex: 1 }}><AppButton compact variant="secondary" label="Open check-in" onPress={() => router.push('/features/mood' as never)} /></View>
                  </View>
                  {partnerSupport.secondaryHref && partnerSupport.secondaryLabel ? <AppButton compact variant="secondary" label={partnerSupport.secondaryLabel} onPress={() => router.push(partnerSupport.secondaryHref as never)} /> : null}
                </View>
              </Card>
            </FadeSlideIn>
          ) : null}

          {priority === 'reveal' ? (
            <FadeSlideIn>
              <Pressable accessibilityRole="button" onPress={() => router.push('/features/daily-question' as never)}>
                {({ pressed }) => (
                  <Card participantColor="both" style={{ gap: theme.spacing.md, opacity: pressed ? 0.78 : 1, padding: theme.spacing.lg }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                      <View style={{ width: 48, height: 48, borderRadius: 17, backgroundColor: theme.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
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
                      <View style={{ width: 48, height: 48, borderRadius: 17, backgroundColor: theme.colors.elevatedBackground, alignItems: 'center', justifyContent: 'center' }}>
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
        </View>
      ) : null}

      <View style={{ gap: theme.spacing.sm }}>
        <View style={{ gap: 2 }}>
          <AppText variant="section">Life today</AppText>
          <AppText variant="bodySmall" tone="muted">The practical bits around your day. Tap any row to go straight there.</AppText>
        </View>
        <View style={{ paddingHorizontal: theme.spacing.sm }}>
          {regularRows.map((row, index) => <StatusRow key={row.title} icon={row.icon} title={row.title} value={row.value} valueTone={row.tone} href={row.href} topBorder={index > 0} />)}
        </View>
      </View>
    </View>
  );
}