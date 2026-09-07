import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FormField } from '@/components/common/FormField';
import { ChoiceChips } from '@/components/common/ChoiceChips';
import { TagChip } from '@/components/common/TagChip';
import { AppIcon, type AppIconName } from '@/components/art/AppIcon';
import { ConnectionOrbitArt } from '@/components/art/TogetherlyArt';
import { FadeSlideIn, GentleFloat } from '@/components/motion/Motion';
import { createGame, getGames } from '@/services/backend/games';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import type { BingoWinCondition, GameSession, GameType } from '@/types/database';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }

const games: Array<{ type: GameType; icon: AppIconName; title: string; subtitle: string; badge: string }> = [
  { type: 'bingo', icon: 'task', title: 'Relationship Bingo', subtitle: 'Complete your card before your partner.', badge: 'ONGOING' },
  { type: 'hangman', icon: 'note', title: 'Hangman', subtitle: 'Guess the word before you run out of tries.', badge: 'QUICK' },
  { type: 'this_or_that', icon: 'together', title: 'This or That', subtitle: 'Choose secretly, then reveal together.', badge: 'QUICK' },
  { type: 'know_me', icon: 'question', title: 'How Well Do You Know Me?', subtitle: 'See how well you can predict each other.', badge: 'ABOUT US' },
  { type: 'draw_together', icon: 'draw', title: 'Draw Together', subtitle: 'Draw together on one shared canvas.', badge: 'CREATIVE' },
];
const bingoWinOptions = [
  { value: 'line', label: 'One line' }, { value: 'two_lines', label: 'Two lines' }, { value: 'four_corners', label: 'Four corners' }, { value: 'full', label: 'Full card' },
] as const;

export default function PlayTogetherScreen() {
  const theme = useAppTheme();
  const { partnerProfile } = useWorkspace();
  const [sessions, setSessions] = useState<GameSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GameType | null>(null);
  const [reward, setReward] = useState('');
  const [secretWord, setSecretWord] = useState('');
  const [bingoWinCondition, setBingoWinCondition] = useState<BingoWinCondition>('line');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => { try { setSessions(await getGames()); } catch (error) { Alert.alert('Couldn’t load games', messageFrom(error)); } finally { setLoading(false); } }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]); useRealtimeRefresh('games', refresh);
  const active = useMemo(() => sessions.filter((game) => game.status === 'active'), [sessions]);
  const recent = useMemo(() => sessions.filter((game) => game.status !== 'active').slice(0, 4), [sessions]);

  async function startGame() {
    if (!selected) return;
    if (!partnerProfile) { Alert.alert('Link your partner first', 'Play Together games need both accounts linked to the same couple space.'); return; }
    if (selected === 'hangman' && !secretWord.trim()) { Alert.alert('Add a secret word', 'Enter the word or phrase your partner will try to guess.'); return; }
    setBusy(true);
    try {
      const game = await createGame({ gameType: selected, reward: reward.trim(), secretWord: selected === 'hangman' ? secretWord.trim() : undefined, winCondition: selected === 'bingo' ? bingoWinCondition : undefined, roundCount: selected === 'this_or_that' ? 10 : selected === 'know_me' ? 6 : undefined });
      setReward(''); setSecretWord(''); setSelected(null); router.push(`/features/games/${game.id}` as never);
    } catch (error) { Alert.alert('Couldn’t start game', messageFrom(error)); }
    finally { setBusy(false); }
  }

  return (
    <AppScreen>
      <BackHeader eyebrow="Together" title="Play Together" subtitle="A reason to do something at the same time." />

      <Card participantColor="both" tone="accent" style={{ gap: theme.spacing.md, marginBottom: theme.spacing.xxl, overflow: 'hidden' }}>
        <View style={{ alignItems: 'center', marginTop: -10, marginBottom: -14 }}><GentleFloat distance={3}><ConnectionOrbitArt width={235} height={110} /></GentleFloat></View>
        <View style={{ gap: 4 }}><AppText variant="caption" tone="accent">PLAY TOGETHER</AppText><AppText variant="hero">Pick something fun.</AppText><AppText tone="secondary">Quick rounds, longer challenges and shared doodles — just for the two of you.</AppText></View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/features/decision-tools' as never)} style={({ pressed }) => ({ alignSelf: 'flex-start', flexDirection: 'row', gap: 7, minHeight: 40, alignItems: 'center', opacity: pressed ? 0.7 : 1 })}><AppIcon name="spark" size={17} color={theme.colors.accent} /><AppText variant="bodySmall" tone="accent">Need a quick decision? Flip, spin or choose</AppText><AppIcon name="chevron" size={14} color={theme.colors.accent} /></Pressable>
      </Card>

      {active.length ? <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.xxl }}>
        <AppText variant="section">Continue playing</AppText>
        {active.map((game, index) => <FadeSlideIn key={game.id} delay={index * 50}><Pressable accessibilityRole="button" onPress={() => router.push(`/features/games/${game.id}` as never)}>{({ pressed }) => <Card participantColor="both" style={{ gap: theme.spacing.sm, opacity: pressed ? 0.75 : 1 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md, alignItems: 'center' }}><View style={{ flex: 1, gap: 4 }}><AppText variant="cardTitle">{game.title}</AppText><AppText variant="bodySmall" tone="secondary">{game.reward ? `Winner gets: ${game.reward}` : 'Jump back in where you left off.'}</AppText></View><TagChip label="LIVE" participantColor="both" /></View></Card>}</Pressable></FadeSlideIn>)}
      </View> : null}

      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="section">{active.length ? 'Start another' : 'Choose a game'}</AppText>
        {!active.length && !loading ? <AppText variant="bodySmall" tone="secondary">No setup screen first. Pick what sounds fun and start.</AppText> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          {games.map((game) => { const chosen = selected === game.type; return <Pressable key={game.type} accessibilityRole="button" accessibilityState={{ selected: chosen }} onPress={() => setSelected(chosen ? null : game.type)} style={{ flex: 1, minWidth: '46%' }}>{({ pressed }) => <Card tone={chosen ? 'accent' : 'default'} style={{ minHeight: 165, gap: theme.spacing.sm, opacity: pressed ? 0.76 : 1, borderColor: chosen ? theme.colors.accent : theme.colors.border }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><View style={{ width: 42, height: 42, borderRadius: 15, backgroundColor: chosen ? theme.colors.accentSoft : theme.colors.elevatedBackground, alignItems: 'center', justifyContent: 'center' }}><AppIcon name={game.icon} size={22} color={chosen ? theme.colors.accent : theme.colors.textSecondary} /></View><TagChip subtle label={game.badge} /></View><AppText variant="cardTitle">{game.title}</AppText><AppText variant="bodySmall" tone="secondary">{game.subtitle}</AppText></Card>}</Pressable>; })}
        </View>
      </View>

      {selected ? <FadeSlideIn><Card tone="secondary" style={{ gap: theme.spacing.lg, marginTop: theme.spacing.xxl }}>
        <AppText variant="section">Start {games.find((game) => game.type === selected)?.title}</AppText>
        {selected === 'bingo' ? <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">WIN CONDITION</AppText><ChoiceChips value={bingoWinCondition} options={bingoWinOptions} onChange={setBingoWinCondition} /></View> : null}
        {selected === 'hangman' ? <FormField label="SECRET WORD OR PHRASE" value={secretWord} onChangeText={setSecretWord} placeholder="An inside joke, place, movie…" autoCapitalize="characters" maxLength={80} /> : null}
        {selected === 'this_or_that' ? <AppText tone="secondary">10 quick rounds. Choices stay hidden until you both answer.</AppText> : null}
        {selected === 'know_me' ? <AppText tone="secondary">6 rounds. One answers about themselves while the other predicts.</AppText> : null}
        {selected === 'draw_together' ? <AppText tone="secondary">One canvas. Your two colours. Draw at the same time.</AppText> : null}
        <FormField label="REWARD · OPTIONAL" value={reward} onChangeText={setReward} placeholder="Winner chooses movie night, breakfast in bed…" maxLength={300} />
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}><View style={{ flex: 1 }}><AppButton variant="ghost" label="Cancel" onPress={() => setSelected(null)} /></View><View style={{ flex: 1 }}><AppButton label={busy ? 'Starting…' : 'Start game'} disabled={busy || (selected === 'hangman' && !secretWord.trim())} onPress={startGame} /></View></View>
      </Card></FadeSlideIn> : null}

      {recent.length ? <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xxl }}><AppText variant="caption" tone="secondary">RECENT</AppText>{recent.map((game) => <Pressable key={game.id} accessibilityRole="button" onPress={() => router.push(`/features/games/${game.id}` as never)}>{({ pressed }) => <View style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border, opacity: pressed ? 0.7 : 1 }}><View style={{ flex: 1 }}><AppText variant="bodySmall" style={{ fontWeight: '700' }}>{game.title}</AppText><AppText variant="caption" tone="muted">{game.status === 'completed' ? 'Finished' : 'Ended'}</AppText></View><AppIcon name="chevron" size={16} color={theme.colors.textMuted} /></View>}</Pressable>)}</View> : null}
    </AppScreen>
  );
}
