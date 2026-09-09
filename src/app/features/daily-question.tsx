import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FormField } from '@/components/common/FormField';
import { TagChip } from '@/components/common/TagChip';
import { EmptyState } from '@/components/common/EmptyState';
import { ToggleRow } from '@/components/common/ToggleRow';
import { ChoiceChips } from '@/components/common/ChoiceChips';
import { AppIcon } from '@/components/art/AppIcon';
import { ConnectionOrbitArt } from '@/components/art/TogetherlyArt';
import { FadeSlideIn, GentleFloat, RevealScale } from '@/components/motion/Motion';
import { answerDailyQuestion, getDailyQuestion, getDailyQuestionHistory, updateDailyQuestionSettings } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { participantPalettes, participantPalette } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import type { DailyQuestionHistoryEntry, DailyQuestionState } from '@/types/database';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }
function prettyDate(value: string) { return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${value}T12:00:00`)); }

const categories = [
  ['cute', 'Cute'], ['funny', 'Funny'], ['deep', 'Deep'], ['romantic', 'Romantic'], ['memories', 'Memories'], ['childhood', 'Childhood'],
  ['future', 'Future'], ['relationship', 'Relationship'], ['hypothetical', 'Hypothetical'], ['would_you_rather', 'Would you rather'], ['intimacy', 'Intimacy'],
] as const;
type QuestionView = 'today' | 'history';

export default function DailyQuestionScreen() {
  const theme = useAppTheme();
  const { profile, partnerProfile, myColor, partnerColor } = useWorkspace();
  const [state, setState] = useState<DailyQuestionState | null>(null);
  const [history, setHistory] = useState<DailyQuestionHistoryEntry[]>([]);
  const [view, setView] = useState<QuestionView>('today');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  const refresh = useCallback(async () => {
    try { const next = await getDailyQuestion(); setState(next); if (next.myAnswer?.answer) setAnswer(next.myAnswer.answer); }
    catch (error) { Alert.alert('Couldn’t load today’s question', messageFrom(error)); }
    finally { setLoading(false); }
  }, []);
  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try { setHistory(await getDailyQuestionHistory()); }
    catch (error) { Alert.alert('Couldn’t load question history', messageFrom(error)); }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useEffect(() => { if (view === 'history') refreshHistory().catch(() => undefined); }, [refreshHistory, view]);
  useEffect(() => { setRevealed(false); }, [state?.date, state?.question?.id]);
  useRealtimeRefresh('questions', () => Promise.all([refresh(), view === 'history' ? refreshHistory() : Promise.resolve()]).then(() => undefined));

  async function save() {
    if (!state?.question || !answer.trim()) return;
    setBusy(true);
    try { await answerDailyQuestion(state.question.id, answer.trim()); await refresh(); }
    catch (error) { Alert.alert('Couldn’t save answer', messageFrom(error)); }
    finally { setBusy(false); }
  }
  async function toggleCategory(category: string, enabled: boolean) {
    const current = state?.disabledCategories ?? [];
    const next = enabled ? current.filter((item) => item !== category) : [...new Set([...current, category])];
    try { await updateDailyQuestionSettings(next); setAnswer(''); await refresh(); }
    catch (error) { Alert.alert('Couldn’t update question categories', messageFrom(error)); }
  }

  return (
    <AppScreen>
      <BackHeader eyebrow="Together" title="Daily question" subtitle="One little ritual, answered separately." />
      <View style={{ marginBottom: theme.spacing.xl }}><ChoiceChips value={view} onChange={setView} options={[{ value: 'today', label: 'Today' }, { value: 'history', label: 'History' }]} /></View>

      {view === 'today' ? <>
        {loading ? <AppText tone="muted">Loading today’s question…</AppText> : null}
        {!loading && !state?.question ? <EmptyState icon="question" title="No question available" body="The question bank is empty." /> : null}
        {state?.question ? <View style={{ gap: theme.spacing.xxl }}>
          <Card tone="accent" participantColor="both" style={{ gap: theme.spacing.lg, padding: theme.spacing.xl, overflow: 'hidden' }}>
            <View style={{ position: 'absolute', right: -22, top: -30, opacity: 0.45 }}><GentleFloat distance={2}><ConnectionOrbitArt width={150} height={82} /></GentleFloat></View>
            <TagChip subtle label={state.question.category.toUpperCase().replaceAll('_', ' ')} />
            <AppText variant="pageTitle" style={{ maxWidth: '88%' }}>{state.question.question}</AppText>
            <AppText variant="caption" tone="secondary">{state.date ?? 'TODAY'}</AppText>
          </Card>

          {!state.bothAnswered ? <Card participantColor={myColor} style={{ gap: theme.spacing.lg }}>
            <AppText variant="caption" style={{ color: participantPalette(myColor).accent }}>{profile?.display_name?.toUpperCase() ?? 'ME'}</AppText>
            <FormField label={`${profile?.display_name?.toUpperCase() ?? 'MY'} ANSWER`} value={answer} onChangeText={setAnswer} placeholder="Say the thing you’d actually want them to know…" multiline />
            <AppButton label={busy ? 'Saving…' : state.myAnswer ? 'Update before reveal' : 'Lock in my answer'} disabled={busy || !answer.trim()} onPress={save} />
          </Card> : null}

          {state.bothAnswered && state.partnerAnswer ? (
            !revealed ? <FadeSlideIn><Card participantColor="both" tone="secondary" style={{ alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.xxxl }}>
              <View style={{ width: 58, height: 58, borderRadius: 22, backgroundColor: theme.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}><AppIcon name="heart" size={28} color={theme.colors.accent} /></View>
              <View style={{ gap: 4, alignItems: 'center' }}><AppText variant="section" align="center">You’re both ready.</AppText><AppText tone="secondary" align="center">Your answers stayed private until this moment.</AppText></View>
              <AppButton label="Reveal our answers" onPress={() => setRevealed(true)} />
            </Card></FadeSlideIn> : <RevealScale trigger={revealed} style={{ gap: theme.spacing.md }}>
              <Card participantColor={myColor} style={{ gap: theme.spacing.sm }}><AppText variant="caption" style={{ color: participantPalette(myColor).accent }}>{profile?.display_name?.toUpperCase() ?? 'YOU'}</AppText><AppText variant="section">“{state.myAnswer?.answer}”</AppText></Card>
              <Card participantColor={partnerColor} style={{ gap: theme.spacing.sm }}><AppText variant="caption" style={{ color: participantPalette(partnerColor).accent }}>{partnerProfile?.display_name?.toUpperCase() ?? 'PARTNER'}</AppText><AppText variant="section">“{state.partnerAnswer.answer}”</AppText></Card>
              <AppText variant="caption" tone="muted" align="center">Locked for today · come back tomorrow for a new question</AppText>
            </RevealScale>
          ) : state.myAnswer ? <Card tone="secondary" style={{ gap: theme.spacing.sm }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><AppIcon name="check" size={18} color={theme.colors.success} /><AppText variant="section">Answer locked</AppText></View><AppText tone="secondary">Waiting for {partnerProfile?.display_name ?? 'your partner'}. It reveals only after they answer.</AppText></Card> : <Card tone="secondary"><AppText tone="secondary">Answer first. Their answer stays hidden until you’ve both answered.</AppText></Card>}

          <View style={{ gap: theme.spacing.sm }}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: settingsOpen }} onPress={() => setSettingsOpen((value) => !value)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' }}><AppIcon name="settings" size={17} color={theme.colors.textMuted} /><AppText variant="bodySmall" tone="muted">Question preferences</AppText></Pressable>
            {settingsOpen ? <FadeSlideIn><Card tone="secondary" style={{ gap: theme.spacing.xs }}><AppText variant="bodySmall" tone="secondary" style={{ marginBottom: theme.spacing.sm }}>Choose which kinds of questions can appear.</AppText>{categories.map(([value, label]) => <ToggleRow key={value} label={label} value={!(state.disabledCategories ?? []).includes(value)} onChange={(enabled) => toggleCategory(value, enabled)} />)}</Card></FadeSlideIn> : null}
          </View>
        </View> : null}
      </> : <View style={{ gap: theme.spacing.md }}>
        {historyLoading ? <AppText tone="muted">Loading history…</AppText> : null}
        {!historyLoading && history.length === 0 ? <EmptyState icon="question" title="No past answers yet" body="Your past answers will appear here." /> : null}
        {history.map((entry) => <Card key={`${entry.date}-${entry.question.id}`} participantColor="both" style={{ gap: theme.spacing.md }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md, alignItems: 'center' }}><TagChip subtle label={entry.question.category.toUpperCase().replaceAll('_', ' ')} /><AppText variant="caption" tone="muted">{prettyDate(entry.date)}</AppText></View><AppText variant="cardTitle">{entry.question.question}</AppText><View style={{ gap: theme.spacing.sm }}><View style={{ paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: participantPalette(myColor).accent }}><AppText variant="caption" style={{ color: participantPalette(myColor).accent }}>{profile?.display_name?.toUpperCase() ?? 'YOU'}</AppText><AppText variant="bodySmall">“{entry.myAnswer.answer}”</AppText></View>{entry.partnerAnswer ? <View style={{ paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: participantPalette(partnerColor).accent }}><AppText variant="caption" style={{ color: participantPalette(partnerColor).accent }}>{partnerProfile?.display_name?.toUpperCase() ?? 'PARTNER'}</AppText><AppText variant="bodySmall">“{entry.partnerAnswer.answer}”</AppText></View> : <AppText variant="bodySmall" tone="muted">Only your answer is available for this day.</AppText>}</View></Card>)}
      </View>}
    </AppScreen>
  );
}
