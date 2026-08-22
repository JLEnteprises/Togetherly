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
import { EmptyState } from '@/components/common/EmptyState';
import { TagChip } from '@/components/common/TagChip';
import { FeatureGroupCard } from '@/components/navigation/FeatureGroupCard';
import { createGame, getGames } from '@/services/backend/games';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import type { BingoWinCondition, GameSession, GameType } from '@/types/database';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }

const games: Array<{ type: GameType; icon: string; title: string; subtitle: string; badge: string }> = [
  { type: 'bingo', icon: '▦', title: 'Relationship Bingo', subtitle: 'See each other’s cards. Earn, verify and strategically withhold squares.', badge: 'ONGOING' },
  { type: 'hangman', icon: 'A_', title: 'Hangman', subtitle: 'Challenge your partner with a word or inside-joke phrase.', badge: 'QUICK' },
  { type: 'this_or_that', icon: '⇄', title: 'This or That', subtitle: 'Choose secretly, reveal together and see how often you match.', badge: 'QUICK' },
  { type: 'know_me', icon: '♡?', title: 'How Well Do You Know Me?', subtitle: 'Answer about yourself while your partner predicts your choice.', badge: 'ABOUT US' },
  { type: 'draw_together', icon: '✎', title: 'Draw Together', subtitle: 'Share one live canvas. Doodle, leave a sketch or make something chaotic together.', badge: 'CREATIVE' },
];

const quickTools = [
  { icon: '↻', title: 'Decision tools', subtitle: 'Flip, spin or break a tiny stalemate together', href: '/features/decision-tools' },
] as const;

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

  const refresh = useCallback(async () => {
    try { setSessions(await getGames()); }
    catch (error) { Alert.alert('Couldn’t load games', messageFrom(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('games', refresh);

  const active = useMemo(() => sessions.filter((game) => game.status === 'active'), [sessions]);
  const recent = useMemo(() => sessions.filter((game) => game.status !== 'active').slice(0, 5), [sessions]);

  async function startGame() {
    if (!selected) return;
    if (!partnerProfile) { Alert.alert('Link your partner first', 'Play Together games need both accounts linked to the same couple space.'); return; }
    if (selected === 'hangman' && !secretWord.trim()) { Alert.alert('Add a secret word', 'Enter the word or phrase your partner will try to guess.'); return; }
    setBusy(true);
    try {
      const game = await createGame({
        gameType: selected,
        reward: reward.trim(),
        secretWord: selected === 'hangman' ? secretWord.trim() : undefined,
        winCondition: selected === 'bingo' ? bingoWinCondition : undefined,
        roundCount: selected === 'this_or_that' ? 10 : selected === 'know_me' ? 6 : undefined,
      });
      setReward(''); setSecretWord(''); setSelected(null);
      router.push(`/features/games/${game.id}` as never);
    } catch (error) { Alert.alert('Couldn’t start game', messageFrom(error)); }
    finally { setBusy(false); }
  }

  return (
    <AppScreen>
      <BackHeader eyebrow="Together" title="Play Together" subtitle="Games for the two of you." />

      <Card participantColor="both" tone="accent" style={{ gap: theme.spacing.md, marginBottom: theme.spacing.xxl }}>
        <AppText variant="caption" tone="accent">PLAY TOGETHER</AppText>
        <AppText variant="hero">Pick a game.</AppText>
        <AppText tone="secondary">Quick rounds, longer challenges and shared doodles.</AppText>
      </Card>

      <View style={{ marginBottom: theme.spacing.xxl }}><FeatureGroupCard eyebrow="QUICK TOOL" title="Quick tools" items={quickTools} /></View>

      {active.length ? (
        <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.xxl }}>
          <AppText variant="section">In progress</AppText>
          {active.map((game) => (
            <Pressable key={game.id} accessibilityRole="button" onPress={() => router.push(`/features/games/${game.id}` as never)}>
              {({ pressed }) => <Card style={{ gap: theme.spacing.sm, opacity: pressed ? 0.75 : 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md, alignItems: 'center' }}>
                  <View style={{ flex: 1, gap: 4 }}><AppText variant="cardTitle">{game.title}</AppText><AppText variant="bodySmall" tone="secondary">{game.reward ? `Reward: ${game.reward}` : 'No reward set'}</AppText></View>
                  <TagChip label="LIVE" participantColor="both" />
                </View>
              </Card>}
            </Pressable>
          ))}
        </View>
      ) : !loading ? <View style={{ marginBottom: theme.spacing.xxl }}><EmptyState icon="✦" title="No games running" body="Pick a game below." /></View> : null}

      <View style={{ gap: theme.spacing.md }}>
        <AppText variant="section">Choose a game</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          {games.map((game) => {
            const chosen = selected === game.type;
            return (
              <Pressable key={game.type} accessibilityRole="button" accessibilityState={{ selected: chosen }} onPress={() => setSelected(chosen ? null : game.type)} style={{ flex: 1, minWidth: '46%' }}>
                {({ pressed }) => <Card tone={chosen ? 'accent' : 'default'} style={{ minHeight: 170, gap: theme.spacing.sm, opacity: pressed ? 0.76 : 1, borderColor: chosen ? theme.colors.accent : theme.colors.border }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><AppText variant="section" tone="accent">{game.icon}</AppText><TagChip subtle label={game.badge} /></View>
                  <AppText variant="cardTitle">{game.title}</AppText>
                  <AppText variant="bodySmall" tone="secondary">{game.subtitle}</AppText>
                </Card>}
              </Pressable>
            );
          })}
        </View>
      </View>

      {selected ? (
        <Card tone="secondary" style={{ gap: theme.spacing.lg, marginTop: theme.spacing.xxl }}>
          <AppText variant="section">Start {games.find((game) => game.type === selected)?.title}</AppText>
          {selected === 'bingo' ? <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">WIN CONDITION</AppText><ChoiceChips value={bingoWinCondition} options={bingoWinOptions} onChange={setBingoWinCondition} /></View> : null}
          {selected === 'hangman' ? <FormField label="SECRET WORD OR PHRASE" value={secretWord} onChangeText={setSecretWord} placeholder="An inside joke, place, movie…" autoCapitalize="characters" maxLength={80} /> : null}
          {selected === 'this_or_that' ? <AppText tone="secondary">10 quick rounds. Choices stay hidden until you both answer.</AppText> : null}
          {selected === 'know_me' ? <AppText tone="secondary">6 rounds. You alternate being the person answering about yourself while your partner predicts your choice.</AppText> : null}
          {selected === 'draw_together' ? <AppText tone="secondary">Draw together in your own colours.</AppText> : null}
          <FormField label="REWARD · OPTIONAL" value={reward} onChangeText={setReward} placeholder="Winner chooses movie night, massage, breakfast in bed…" maxLength={300} />
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}><View style={{ flex: 1 }}><AppButton variant="ghost" label="Cancel" onPress={() => setSelected(null)} /></View><View style={{ flex: 1 }}><AppButton label={busy ? 'Starting…' : 'Start game'} disabled={busy || (selected === 'hangman' && !secretWord.trim())} onPress={startGame} /></View></View>
        </Card>
      ) : null}

      {recent.length ? <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.xxl }}><AppText variant="section">Recent games</AppText>{recent.map((game) => <Pressable key={game.id} accessibilityRole="button" onPress={() => router.push(`/features/games/${game.id}` as never)}>{({ pressed }) => <Card tone="secondary" style={{ opacity: pressed ? 0.75 : 1, flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md }}><View style={{ flex: 1 }}><AppText variant="cardTitle">{game.title}</AppText><AppText variant="bodySmall" tone="muted">{game.status === 'completed' ? 'Finished' : 'Ended'}</AppText></View><AppText tone="accent">View ›</AppText></Card>}</Pressable>)}</View> : null}
    </AppScreen>
  );
}
