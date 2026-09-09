import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FormField } from '@/components/common/FormField';
import { TagChip } from '@/components/common/TagChip';
import { DrawingCanvas } from '@/components/common/DrawingCanvas';
import { abandonGame, gameAction, getGame } from '@/services/backend/games';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { participantPalettes, participantPalette } from '@/theme/tokens';
import { useAppTheme } from '@/theme/useAppTheme';
import type { BingoGameState, BingoSquare, DrawTogetherGameState, DrawingStroke, GameSession, HangmanGameState, KnowMeGameState, ThisOrThatGameState } from '@/types/database';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }

export default function GameDetailScreen() {
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile, partnerProfile, myColor, partnerColor, colorForUser } = useWorkspace();
  const [game, setGame] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    try { setGame(await getGame(id)); }
    catch (error) { Alert.alert('Couldn’t load game', messageFrom(error)); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('games', refresh);

  const nameFor = useCallback((userId: string | null | undefined) => {
    if (!userId) return 'Tie';
    if (userId === profile?.id) return profile.display_name;
    if (userId === partnerProfile?.id) return partnerProfile.display_name;
    return 'Partner';
  }, [partnerProfile?.display_name, partnerProfile?.id, profile?.display_name, profile?.id]);

  async function act(input: Record<string, unknown>) {
    if (!game || busy) return;
    setBusy(true);
    try { setGame(await gameAction(game.id, input)); }
    catch (error) { Alert.alert('Couldn’t update game', messageFrom(error)); }
    finally { setBusy(false); }
  }

  function endGame() {
    if (!game || game.status !== 'active') return;
    Alert.alert('End this game?', 'It will stay in your recent games, but neither of you can keep playing it.', [
      { text: 'Keep playing', style: 'cancel' },
      { text: 'End game', style: 'destructive', onPress: () => { setBusy(true); abandonGame(game.id).then(setGame).catch((error) => Alert.alert('Couldn’t end game', messageFrom(error))).finally(() => setBusy(false)); } },
    ]);
  }

  if (loading || !game) return <AppScreen><BackHeader eyebrow="Play Together" title="Loading game…" /><AppText tone="muted">Loading game…</AppText></AppScreen>;

  const statusCopy = game.status === 'active' ? 'LIVE' : game.status === 'completed' ? 'FINISHED' : 'ENDED';
  return (
    <AppScreen>
      <BackHeader eyebrow="Play Together" title={game.title} subtitle={game.reward ? `Reward: ${game.reward}` : 'Just for bragging rights.'} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.xl }}>
        <TagChip label={statusCopy} participantColor={game.status === 'active' ? 'both' : undefined} />
        {game.status === 'active' ? <AppButton compact variant="ghost" label="End game" onPress={endGame} disabled={busy} /> : null}
      </View>

      {game.status === 'completed' ? <Card participantColor="both" tone="accent" style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.xl }}><AppText variant="caption" tone="accent">GAME COMPLETE</AppText><AppText variant="hero">{game.winner_user_id ? `${nameFor(game.winner_user_id)} wins ✦` : 'It’s a tie ✦'}</AppText>{game.reward ? <AppText tone="secondary">Reward: {game.reward}</AppText> : null}</Card> : null}

      {game.game_type === 'bingo' ? <BingoGame game={game} me={profile?.id ?? ''} partner={partnerProfile?.id ?? ''} myName={profile?.display_name ?? 'You'} partnerName={partnerProfile?.display_name ?? 'Partner'} myColor={myColor} partnerColor={partnerColor} busy={busy} act={act} /> : null}
      {game.game_type === 'hangman' ? <HangmanGame game={game} me={profile?.id ?? ''} myName={profile?.display_name ?? 'You'} partnerName={partnerProfile?.display_name ?? 'Partner'} busy={busy} act={act} /> : null}
      {game.game_type === 'this_or_that' ? <ThisOrThatGame game={game} me={profile?.id ?? ''} partner={partnerProfile?.id ?? ''} myName={profile?.display_name ?? 'You'} partnerName={partnerProfile?.display_name ?? 'Partner'} busy={busy} act={act} /> : null}
      {game.game_type === 'know_me' ? <KnowMeGame game={game} me={profile?.id ?? ''} partner={partnerProfile?.id ?? ''} nameFor={nameFor} busy={busy} act={act} /> : null}
      {game.game_type === 'draw_together' ? <DrawTogetherGame game={game} me={profile?.id ?? ''} busy={busy} act={act} colorForUser={(userId) => { const color = colorForUser(userId); return color === 'both' ? theme.colors.textPrimary : participantPalette(color).accent; }} /> : null}
    </AppScreen>
  );
}

type SharedGameProps = { game: GameSession; me: string; busy: boolean; act: (input: Record<string, unknown>) => Promise<void> };

function BingoGame({ game, me, partner, myName, partnerName, myColor, partnerColor, busy, act }: SharedGameProps & { partner: string; myName: string; partnerName: string; myColor: string; partnerColor: string }) {
  const theme = useAppTheme();
  const state = game.state as BingoGameState;
  const myCard = state.cards[me] ?? [];
  const partnerCard = state.cards[partner] ?? [];
  const pendingForMe = partnerCard.filter((square) => square.pending && !square.completed);
  const condition = state.winCondition === 'two_lines' ? 'Two lines' : state.winCondition === 'four_corners' ? 'Four corners' : state.winCondition === 'full' ? 'Full card' : 'One line';

  function squareStatus(square: BingoSquare, mine: boolean) {
    if (square.completed) return '✓';
    if (square.pending) return '…';
    if (mine && square.kind === 'claim') return 'CLAIM';
    if (!mine && square.kind === 'partner') return 'GIVE';
    return square.kind === 'partner' ? 'PARTNER' : 'VERIFY';
  }

  function pressSquare(square: BingoSquare, ownerUserId: string, mine: boolean) {
    if (game.status !== 'active' || busy || square.completed || square.pending) return;
    if (mine && square.kind === 'claim') void act({ action: 'claim', ownerUserId, squareId: square.id });
    else if (!mine && square.kind === 'partner') void act({ action: 'give', ownerUserId, squareId: square.id });
  }

  const renderCard = (card: BingoSquare[], ownerUserId: string, ownerName: string, mine: boolean, color: string) => (
    <Card participantColor={color} style={{ gap: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><AppText variant="section">{ownerName}’s card</AppText><TagChip subtle label={mine ? 'YOUR CARD' : 'THEIR CARD'} participantColor={color} /></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {card.map((square) => {
          const actionable = game.status === 'active' && !square.completed && !square.pending && ((mine && square.kind === 'claim') || (!mine && square.kind === 'partner'));
          return <Pressable key={square.id} accessibilityRole="button" accessibilityLabel={`${square.text}. ${squareStatus(square, mine)}`} disabled={!actionable || busy} onPress={() => pressSquare(square, ownerUserId, mine)} style={({ pressed }) => ({ width: '18.4%', minHeight: 92, marginBottom: 7, borderRadius: theme.radii.sm, borderWidth: 1, borderColor: square.completed ? participantPalette(color).accent : square.pending ? theme.colors.secondaryAccent : theme.colors.border, backgroundColor: square.completed ? participantPalette(color).tint : square.pending ? theme.colors.secondarySoft : theme.colors.elevatedBackground, padding: 6, justifyContent: 'space-between', opacity: pressed ? 0.7 : actionable ? 1 : 0.8 })}><AppText variant="caption" align="center" style={{ fontSize: 10, lineHeight: 13 }}>{square.text}</AppText><AppText variant="caption" align="center" style={{ color: square.completed ? participantPalette(color).accent : theme.colors.textMuted }}>{squareStatus(square, mine)}</AppText></Pressable>;
        })}
      </View>
    </Card>
  );

  return <View style={{ gap: theme.spacing.xl }}>
    <Card tone="secondary" style={{ gap: 5 }}><AppText variant="caption" tone="secondary">WIN CONDITION</AppText><AppText variant="section">{condition}</AppText><AppText variant="bodySmall" tone="secondary">Claim squares you caused. Your partner verifies them. Partner-given squares can only be awarded by the other person.</AppText></Card>
    {pendingForMe.length ? <Card tone="accent" style={{ gap: theme.spacing.md }}><AppText variant="section">{partnerName} wants these verified</AppText>{pendingForMe.map((square) => <View key={square.id} style={{ gap: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: theme.spacing.sm }}><AppText>{square.text}</AppText><View style={{ flexDirection: 'row', gap: theme.spacing.sm }}><View style={{ flex: 1 }}><AppButton compact variant="ghost" label="Nice try" disabled={busy} onPress={() => void act({ action: 'reject', ownerUserId: partner, squareId: square.id })} /></View><View style={{ flex: 1 }}><AppButton compact label="Yep ✓" disabled={busy} onPress={() => void act({ action: 'confirm', ownerUserId: partner, squareId: square.id })} /></View></View></View>)}</Card> : null}
    {renderCard(myCard, me, myName, true, myColor)}
    {renderCard(partnerCard, partner, partnerName, false, partnerColor)}
  </View>;
}

function HangmanGame({ game, me, myName, partnerName, busy, act }: SharedGameProps & { myName: string; partnerName: string }) {
  const theme = useAppTheme();
  const state = game.state as HangmanGameState;
  const isGuesser = me === state.guesserUserId;
  const [wordGuess, setWordGuess] = useState('');
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const maskedWords = (state.maskedWord ?? '').split(' ');
  return <View style={{ gap: theme.spacing.xl }}>
    <Card participantColor="both" tone="accent" style={{ gap: theme.spacing.md, alignItems: 'center', paddingVertical: theme.spacing.xxl }}><AppText variant="caption" tone="accent">{isGuesser ? `${myName.toUpperCase()} IS GUESSING` : `${partnerName.toUpperCase()} IS GUESSING`}</AppText><View accessibilityLabel={`Hangman phrase with ${maskedWords.length} ${maskedWords.length === 1 ? 'word' : 'words'}`} style={{ width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-end', columnGap: 28, rowGap: 15, paddingHorizontal: theme.spacing.md }}>{maskedWords.map((word, wordIndex) => <View key={`${word}-${wordIndex}`} style={{ flexDirection: 'row', gap: 6 }}>{word.split('').map((char, charIndex) => <AppText key={`${char}-${charIndex}`} variant="hero" align="center" style={{ minWidth: char === "'" || char === '-' ? 10 : 18 }}>{char === '_' ? '_' : char}</AppText>)}</View>)}</View><AppText variant="bodySmall" tone="muted">{maskedWords.length > 1 ? `${maskedWords.length} words` : '1 word'}</AppText><AppText tone="secondary">Wrong guesses: {state.wrongGuesses}/{state.maxWrong}</AppText>{!isGuesser && state.secretWord ? <AppText variant="bodySmall" tone="muted">Your secret: {state.secretWord}</AppText> : null}</Card>
    {isGuesser && game.status === 'active' ? <><Card style={{ gap: theme.spacing.md }}><AppText variant="section">Pick a letter</AppText><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{letters.map((letter) => { const used = state.guesses.includes(letter); return <Pressable key={letter} accessibilityRole="button" disabled={used || busy} onPress={() => void act({ action: 'guess_letter', letter })} style={({ pressed }) => ({ width: 42, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: used ? theme.colors.border : theme.colors.accent, backgroundColor: used ? theme.colors.elevatedBackground : theme.colors.accentSoft, opacity: used ? 0.35 : pressed ? 0.7 : 1 })}><AppText variant="button">{letter}</AppText></Pressable>; })}</View></Card><Card style={{ gap: theme.spacing.md }}><FormField label="GUESS THE WHOLE WORD · OPTIONAL" value={wordGuess} onChangeText={setWordGuess} autoCapitalize="characters" placeholder="Take a shot…" /><AppButton label="Guess word" disabled={busy || !wordGuess.trim()} onPress={() => { const guess = wordGuess; setWordGuess(''); void act({ action: 'guess_word', guess }); }} /></Card></> : game.status === 'active' ? <Card tone="secondary"><AppText tone="secondary">You set the challenge. Watch {partnerName}’s guesses appear live.</AppText></Card> : null}
  </View>;
}

function ThisOrThatGame({ game, me, partner, myName, partnerName, busy, act }: SharedGameProps & { partner: string; myName: string; partnerName: string }) {
  const theme = useAppTheme();
  const state = game.state as ThisOrThatGameState;
  const round = state.rounds[state.index];
  if (!round) return null;
  const current = state.answers[String(state.index)] ?? {};
  const mine = current[me];
  const theirs = current[partner];
  const revealed = Boolean(state.currentRevealed);
  const choiceLabel = (choice: 'left' | 'right' | undefined) => choice === 'left' ? round.left : choice === 'right' ? round.right : 'Waiting…';
  return <View style={{ gap: theme.spacing.xl }}>
    <Card tone="secondary" style={{ flexDirection: 'row', justifyContent: 'space-between' }}><AppText tone="secondary">Round {state.index + 1} of {state.rounds.length}</AppText><AppText tone="accent">{state.matches} matches</AppText></Card>
    <Card participantColor="both" tone="accent" style={{ gap: theme.spacing.xl, padding: theme.spacing.xl }}><AppText variant="pageTitle" align="center">{round.question}</AppText><View style={{ gap: theme.spacing.md }}>{(['left', 'right'] as const).map((choice) => <Pressable key={choice} accessibilityRole="button" accessibilityState={{ selected: mine === choice, disabled: Boolean(mine) || game.status !== 'active' }} disabled={Boolean(mine) || busy || game.status !== 'active'} onPress={() => void act({ action: 'answer', choice })} style={({ pressed }) => ({ minHeight: 74, borderRadius: theme.radii.lg, borderWidth: 1, borderColor: mine === choice ? theme.colors.accent : theme.colors.border, backgroundColor: mine === choice ? theme.colors.accentSoft : theme.colors.card, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.md, opacity: pressed ? 0.7 : 1 })}><AppText variant="section" align="center">{choice === 'left' ? round.left : round.right}</AppText></Pressable>)}</View></Card>
    {mine && !revealed ? <Card tone="secondary"><AppText variant="section">Locked in ✦</AppText><AppText tone="secondary">Waiting for {partnerName}. Their choice is still hidden.</AppText></Card> : null}
    {revealed ? <Card style={{ gap: theme.spacing.md }}><AppText variant="section">{mine === theirs ? 'You matched ✦' : 'Different this time'}</AppText><View style={{ flexDirection: 'row', gap: theme.spacing.md }}><View style={{ flex: 1 }}><AppText variant="caption" tone="accent">{myName.toUpperCase()}</AppText><AppText>{choiceLabel(mine)}</AppText></View><View style={{ flex: 1 }}><AppText variant="caption" tone="secondary">{partnerName.toUpperCase()}</AppText><AppText>{choiceLabel(theirs)}</AppText></View></View>{game.status === 'active' ? <AppButton label={state.index === state.rounds.length - 1 ? 'Finish game' : 'Next question'} disabled={busy} onPress={() => void act({ action: 'next' })} /> : null}</Card> : null}
  </View>;
}

function KnowMeGame({ game, me, partner, nameFor, busy, act }: SharedGameProps & { partner: string; nameFor: (id: string | null | undefined) => string }) {
  const theme = useAppTheme();
  const state = game.state as KnowMeGameState;
  const round = state.rounds[state.index];
  if (!round) return null;
  const subject = round.subjectUserId;
  const guesser = subject === me ? partner : me;
  const isSubject = subject === me;
  const current = state.answers[String(state.index)] ?? {};
  const myChoice = isSubject ? current.subject : current.guess;
  const revealed = Boolean(state.currentRevealed);
  const canChoose = game.status === 'active' && myChoice === undefined && (isSubject || state.subjectLocked);
  return <View style={{ gap: theme.spacing.xl }}>
    <Card tone="secondary" style={{ gap: 5 }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><AppText tone="secondary">Round {state.index + 1} of {state.rounds.length}</AppText><AppText tone="accent">Score: {state.scores[me] ?? 0} · {state.scores[partner] ?? 0}</AppText></View><AppText variant="bodySmall" tone="secondary">This round is about {nameFor(subject)}. {isSubject ? 'Choose your real answer.' : `Predict ${nameFor(subject)}’s answer.`}</AppText></Card>
    <Card participantColor="both" tone="accent" style={{ gap: theme.spacing.lg }}><AppText variant="pageTitle">{round.question}</AppText><View style={{ gap: theme.spacing.sm }}>{round.choices.map((choice, index) => <Pressable key={choice} accessibilityRole="button" accessibilityState={{ selected: myChoice === index, disabled: !canChoose }} disabled={!canChoose || busy} onPress={() => void act({ action: 'answer', choiceIndex: index })} style={({ pressed }) => ({ minHeight: 58, borderRadius: theme.radii.md, borderWidth: 1, borderColor: myChoice === index ? theme.colors.accent : theme.colors.border, backgroundColor: myChoice === index ? theme.colors.accentSoft : theme.colors.card, justifyContent: 'center', paddingHorizontal: theme.spacing.lg, opacity: pressed ? 0.7 : 1 })}><AppText variant="cardTitle">{choice}</AppText></Pressable>)}</View></Card>
    {!isSubject && !state.subjectLocked ? <Card tone="secondary"><AppText variant="section">No peeking.</AppText><AppText tone="secondary">Waiting for {nameFor(subject)} to lock in their real answer before you can guess.</AppText></Card> : null}
    {myChoice !== undefined && !revealed ? <Card tone="secondary"><AppText variant="section">Locked in ✦</AppText><AppText tone="secondary">{isSubject ? `Waiting for ${nameFor(guesser)} to predict you.` : 'Your guess is hidden until the reveal.'}</AppText></Card> : null}
    {revealed ? <Card style={{ gap: theme.spacing.md }}><AppText variant="section">{current.subject === current.guess ? `${nameFor(guesser)} knew it ✦` : 'Not quite this time'}</AppText><AppText tone="secondary">{nameFor(subject)} chose <AppText style={{ color: theme.colors.accent }}>{round.choices[current.subject ?? 0]}</AppText>. {nameFor(guesser)} guessed <AppText style={{ color: theme.colors.secondaryAccent }}>{round.choices[current.guess ?? 0]}</AppText>.</AppText>{game.status === 'active' ? <AppButton label={state.index === state.rounds.length - 1 ? 'Finish game' : 'Next round'} disabled={busy} onPress={() => void act({ action: 'next' })} /> : null}</Card> : null}
  </View>;
}


function DrawTogetherGame({ game, me, busy, act, colorForUser }: SharedGameProps & { colorForUser: (userId: string | undefined) => string }) {
  const theme = useAppTheme();
  const state = game.state as DrawTogetherGameState;
  const strokes = state.strokes ?? [];
  function addStroke(stroke: DrawingStroke) { void act({ action: 'draw_stroke', stroke }); }
  function clearCanvas() {
    Alert.alert('Clear the shared canvas?', 'This removes every stroke from both screens.', [
      { text: 'Keep drawing', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => void act({ action: 'clear_drawing' }) },
    ]);
  }
  return <View style={{ gap: theme.spacing.lg }}>
    <Card tone="secondary" style={{ gap: 5 }}><AppText variant="caption" tone="secondary">SHARED CANVAS</AppText><AppText variant="section">Draw together</AppText></Card>
    <DrawingCanvas strokes={strokes} currentUserId={me} editable={game.status === 'active' && !busy} strokeColorForUser={colorForUser} onStroke={addStroke} height={360} showTools />
    {game.status === 'active' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}><AppButton compact variant="secondary" label="Undo my last stroke" disabled={busy || !strokes.some((stroke) => stroke.userId === me)} onPress={() => void act({ action: 'undo_stroke' })} /><AppButton compact variant="danger" label="Clear canvas" disabled={busy || strokes.length === 0} onPress={clearCanvas} /></View> : null}
    <AppText variant="bodySmall" tone="muted">{strokes.length ? `${strokes.length} shared stroke${strokes.length === 1 ? '' : 's'}` : 'Blank canvas — start with anything.'}</AppText>
  </View>;
}
