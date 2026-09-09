import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExpandableFeatureGroup, type ExpandableFeatureGroupItem } from '@/components/navigation/ExpandableFeatureGroup';
import { useExclusiveExpandedGroup } from '@/hooks/useExclusiveExpandedGroup';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { getGames } from '@/services/backend/games';
import { getActivities, getDailyQuestion, getLatestMoods } from '@/services/backend/mvpFeatures';
import type { CoupleActivity, DailyQuestionState, GameSession, MoodEntry } from '@/types/database';

type TogetherGroupKey = 'checkIn' | 'play' | 'thingsToDo';

function relative(entry: MoodEntry | null) {
  if (!entry) return null;
  const mins = Math.max(0, Math.round((Date.now() - new Date(entry.created_at).getTime()) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function questionStatus(question: DailyQuestionState | null, partnerName: string) {
  if (!question?.question) return 'No question today';
  if (question.bothAnswered) return question.revealed ? 'Today’s question revealed' : 'Today’s question ready to reveal';
  if (question.myAnswer) return `Waiting for ${partnerName}`;
  return 'Today’s question waiting';
}

// G3_TOGETHER_CONSOLIDATION: Together exposes one compact hierarchy for check-in, play, and things to do.
export function TogetherHubGroups() {
  const { partnerProfile } = useWorkspace();
  const { isExpanded, setExpanded } = useExclusiveExpandedGroup<TogetherGroupKey>();
  const [question, setQuestion] = useState<DailyQuestionState | null>(null);
  const [partnerMood, setPartnerMood] = useState<MoodEntry | null>(null);
  const [games, setGames] = useState<GameSession[]>([]);
  const [activities, setActivities] = useState<CoupleActivity[]>([]);

  const refresh = useCallback(async () => {
    const [questionResult, moodsResult, gamesResult, activitiesResult] = await Promise.allSettled([
      getDailyQuestion(),
      getLatestMoods(),
      getGames(),
      getActivities(),
    ]);

    if (questionResult.status === 'fulfilled') setQuestion(questionResult.value);
    if (moodsResult.status === 'fulfilled') setPartnerMood(moodsResult.value.partner);
    if (gamesResult.status === 'fulfilled') setGames(gamesResult.value);
    if (activitiesResult.status === 'fulfilled') setActivities(activitiesResult.value);
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  useRealtimeRefresh('questions', refresh);
  useRealtimeRefresh('moods', refresh);
  useRealtimeRefresh('games', refresh);
  useRealtimeRefresh('activities', refresh);

  const partnerName = partnerProfile?.display_name ?? 'Your partner';
  const activeGames = useMemo(() => games.filter((game) => game.status === 'active'), [games]);
  const savedIdeas = useMemo(
    () => activities.filter((activity) => activity.status !== 'completed' && activity.status !== 'skip'),
    [activities],
  );

  const checkInSummary = useMemo(() => {
    const moodTime = relative(partnerMood);
    const moodText = moodTime ? `${partnerName} checked in ${moodTime}` : `${partnerName} hasn’t checked in yet`;
    return `${questionStatus(question, partnerName)} · ${moodText}`;
  }, [partnerMood, partnerName, question]);

  const playSummary = activeGames.length
    ? `${activeGames.length} ${activeGames.length === 1 ? 'game' : 'games'} active · ${activeGames[0]?.title ?? 'ready to continue'}`
    : 'No active game · choose something to play';

  const thingsSummary = savedIdeas.length
    ? `${savedIdeas.length} ${savedIdeas.length === 1 ? 'date idea' : 'date ideas'} saved`
    : 'No date ideas saved yet';

  const playItems = useMemo<ExpandableFeatureGroupItem[]>(() => {
    const items: ExpandableFeatureGroupItem[] = [];
    if (activeGames[0]) {
      items.push({
        key: activeGames[0].id,
        icon: 'game',
        title: `Continue ${activeGames[0].title}`,
        subtitle: 'Jump back into your active shared game',
        status: 'Active',
        href: `/features/games/${activeGames[0].id}`,
      });
    }
    items.push({
      key: 'play-together',
      icon: 'game',
      title: 'Play together',
      subtitle: 'Games and shared things to do while you’re both here',
      href: '/features/play-together',
    });
    return items;
  }, [activeGames]);

  const checkInItems = useMemo<ExpandableFeatureGroupItem[]>(() => [
    {
      key: 'daily-question',
      icon: 'question',
      title: 'Daily question',
      subtitle: 'Answer separately, then open it together',
      href: '/features/daily-question',
    },
    {
      key: 'live-location',
      icon: 'location',
      title: 'Live location',
      subtitle: 'See each other on the map when you choose',
      href: '/features/location',
    },
  ], []);

  const thingsItems = useMemo<ExpandableFeatureGroupItem[]>(() => [
    {
      key: 'date-ideas',
      icon: 'date',
      title: 'Date ideas',
      subtitle: 'Save ideas, find matches or pick one at random',
      status: savedIdeas.length ? String(savedIdeas.length) : undefined,
      href: '/features/activities',
    },
  ], [savedIdeas.length]);

  return (
    <>
      <ExpandableFeatureGroup
        eyebrow="CHECK IN"
        icon="mood"
        title="Check in"
        summary={checkInSummary}
        items={checkInItems}
        expanded={isExpanded('checkIn')}
        onExpandedChange={(expanded) => setExpanded('checkIn', expanded)}
        participantColor="both"
        accessibilityHint="Expand to open the daily question or live location. Mood check-in is available above."
      />

      <ExpandableFeatureGroup
        eyebrow="PLAY"
        icon="game"
        title="Play"
        summary={playSummary}
        status={activeGames.length ? `${activeGames.length} active` : undefined}
        items={playItems}
        expanded={isExpanded('play')}
        onExpandedChange={(expanded) => setExpanded('play', expanded)}
        participantColor="both"
      />

      <ExpandableFeatureGroup
        eyebrow="THINGS TO DO"
        icon="date"
        title="Things to do"
        summary={thingsSummary}
        status={savedIdeas.length ? String(savedIdeas.length) : undefined}
        items={thingsItems}
        expanded={isExpanded('thingsToDo')}
        onExpandedChange={(expanded) => setExpanded('thingsToDo', expanded)}
        participantColor="both"
      />
    </>
  );
}
