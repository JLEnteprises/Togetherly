import { DataStatus } from '@/components/common/DataStatus';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExpandableFeatureGroup, type ExpandableFeatureGroupItem } from '@/components/navigation/ExpandableFeatureGroup';
import { useExclusiveExpandedGroup } from '@/hooks/useExclusiveExpandedGroup';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { getAvailabilityOverlaps } from '@/services/backend/availability';
import { getCountdowns, getLists, getNotes, getTasks } from '@/services/backend/coreFeatures';
import { getEvents, getGoals, getTrips } from '@/services/backend/mvpFeatures';
import { expandEvents } from '@/utils/calendar';
import { countdownRemaining } from '@/utils/countdown';
import type {
  AvailabilityOverlap,
  CoupleCountdown,
  CoupleEvent,
  CoupleGoal,
  CoupleList,
  CoupleNote,
  CoupleTask,
  CoupleTrip,
} from '@/types/database';

type PlanGroupKey = 'dayToDay' | 'datesAndTime' | 'lookingAhead';

function plural(count: number, singular: string, pluralValue = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

function shortWhen(date: Date) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
}

function overlapWhen(overlap: AvailabilityOverlap | null) {
  if (!overlap) return null;
  const start = new Date(overlap.startAt);
  return `free ${new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(start)}`;
}

function nextFutureCountdown(countdowns: CoupleCountdown[], now = Date.now()) {
  return countdowns
    .filter((item) => new Date(item.target_at).getTime() >= now)
    .sort((a, b) => new Date(a.target_at).getTime() - new Date(b.target_at).getTime())[0] ?? null;
}

function nextTrip(trips: CoupleTrip[]) {
  const today = new Date().toISOString().slice(0, 10);
  const dated = trips
    .filter((trip) => trip.start_date && trip.start_date >= today)
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''));
  return dated[0] ?? trips[0] ?? null;
}

// G4_PLAN_EXPANDABLE_GROUPS: Plan keeps its existing feature ownership while revealing one practical group at a time.
export function PlanHubGroups() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const { isExpanded, setExpanded } = useExclusiveExpandedGroup<PlanGroupKey>();
  const [tasks, setTasks] = useState<CoupleTask[]>([]);
  const [lists, setLists] = useState<CoupleList[]>([]);
  const [notes, setNotes] = useState<CoupleNote[]>([]);
  const [events, setEvents] = useState<CoupleEvent[]>([]);
  const [countdowns, setCountdowns] = useState<CoupleCountdown[]>([]);
  const [overlap, setOverlap] = useState<AvailabilityOverlap | null>(null);
  const [trips, setTrips] = useState<CoupleTrip[]>([]);
  const [goals, setGoals] = useState<CoupleGoal[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const results = await Promise.allSettled([
      getTasks(),
      getLists(),
      getNotes(),
      getEvents(),
      getCountdowns(),
      getAvailabilityOverlaps(14, 30),
      getTrips(),
      getGoals(),
    ]);

    setLoading(false); setLoadError(results.some((result) => result.status === 'rejected'));
    const [taskResult, listResult, noteResult, eventResult, countdownResult, overlapResult, tripResult, goalResult] = results;

    if (taskResult.status === 'fulfilled') setTasks(taskResult.value);
    if (listResult.status === 'fulfilled') setLists(listResult.value);
    if (noteResult.status === 'fulfilled') setNotes(noteResult.value);
    if (eventResult.status === 'fulfilled') setEvents(eventResult.value);
    if (countdownResult.status === 'fulfilled') setCountdowns(countdownResult.value);
    if (overlapResult.status === 'fulfilled') setOverlap(overlapResult.value.overlaps[0] ?? null);
    if (tripResult.status === 'fulfilled') setTrips(tripResult.value);
    if (goalResult.status === 'fulfilled') setGoals(goalResult.value);
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  useRealtimeRefresh('tasks', refresh);
  useRealtimeRefresh('lists', refresh);
  useRealtimeRefresh('notes', refresh);
  useRealtimeRefresh('events', refresh);
  useRealtimeRefresh('countdowns', refresh);
  useRealtimeRefresh('schedules', refresh);
  useRealtimeRefresh('trips', refresh);
  useRealtimeRefresh('goals', refresh);

  const openTasks = useMemo(
    () => tasks.filter((task) => task.status !== 'completed' && task.status !== 'skipped'),
    [tasks],
  );

  const futureCountdowns = useMemo(
    () => countdowns.filter((item) => new Date(item.target_at).getTime() >= Date.now()),
    [countdowns],
  );

  const nextCountdown = useMemo(() => nextFutureCountdown(countdowns), [countdowns]);

  const nextEvent = useMemo(() => {
    const now = new Date();
    return expandEvents(events, now, new Date(now.getTime() + 366 * 86_400_000))[0] ?? null;
  }, [events]);

  const activeGoals = useMemo(() => goals.filter((goal) => goal.status === 'active'), [goals]);
  const upcomingTrip = useMemo(() => nextTrip(trips), [trips]);

  const daySummary = `${plural(openTasks.length, 'task')} need attention · ${plural(lists.length, 'list')} · ${plural(notes.length, 'note')}`;

  const eventSummary = nextEvent ? `${nextEvent.event.title} ${shortWhen(nextEvent.start)}` : null;
  const countdownSummary = nextCountdown
    ? (() => {
        const remaining = countdownRemaining(nextCountdown.target_at, Date.now());
        return `${remaining.days}d to ${nextCountdown.title}`;
      })()
    : null;
  const availabilitySummary = overlapWhen(overlap);
  const datesSummary = [eventSummary, countdownSummary, availabilitySummary].filter(Boolean).slice(0, 2).join(' · ')
    || 'No upcoming dates or shared free time yet';

  const aheadSummary = upcomingTrip
    ? `${upcomingTrip.title}${upcomingTrip.start_date ? ` · ${shortWhen(new Date(`${upcomingTrip.start_date}T12:00:00`))}` : ''} · ${plural(activeGoals.length, 'active goal')}`
    : `${plural(activeGoals.length, 'active goal')} · no trip planned`;

  const organiseItems = useMemo<ExpandableFeatureGroupItem[]>(() => [
    {
      key: 'tasks',
      icon: 'task',
      title: 'Tasks',
      subtitle: 'What needs doing, without the mental load',
      status: openTasks.length ? `${openTasks.length} open` : 'Clear',
      href: '/features/tasks',
    },
    {
      key: 'lists',
      icon: 'list',
      title: 'Lists',
      subtitle: 'Shopping, packing and shared lists',
      status: lists.length ? String(lists.length) : undefined,
      href: '/features/lists',
    },
    {
      key: 'notes',
      icon: 'note',
      title: 'Notes',
      subtitle: 'Writing worth keeping, shared or private',
      status: notes.length ? String(notes.length) : undefined,
      href: '/features/notes',
    },
  ], [lists.length, notes.length, openTasks.length]);

  const dateItems = useMemo<ExpandableFeatureGroupItem[]>(() => [
    {
      key: 'calendar',
      icon: 'calendar',
      title: 'Calendar',
      subtitle: 'Month, week and agenda',
      status: nextEvent ? shortWhen(nextEvent.start) : undefined,
      href: '/features/calendar',
    },
    {
      key: 'countdowns',
      icon: 'countdown',
      title: 'Countdowns',
      subtitle: 'Visits, anniversaries and milestones',
      status: futureCountdowns.length ? String(futureCountdowns.length) : undefined,
      href: '/features/countdowns',
    },
    {
      key: 'availability',
      icon: 'availability',
      title: 'When are we both free?',
      subtitle: 'Find the overlap without comparing calendars by hand',
      status: overlap ? 'Overlap found' : undefined,
      href: '/features/availability',
    },
  ], [futureCountdowns.length, nextEvent, overlap]);

  const aheadItems = useMemo<ExpandableFeatureGroupItem[]>(() => [
    {
      key: 'trips',
      icon: 'trip',
      title: 'Trips',
      subtitle: 'Everything for the next time you’re going somewhere together',
      status: trips.length ? String(trips.length) : undefined,
      href: '/features/trips',
    },
    {
      key: 'goals',
      icon: 'goal',
      title: 'Goals',
      subtitle: 'Goals you can build together',
      status: activeGoals.length ? `${activeGoals.length} active` : undefined,
      href: '/features/goals',
    },
  ], [activeGoals.length, trips.length]);

  return (
    <>
      <DataStatus loading={loading} error={loadError} retry={() => { void refresh(); }} />
      <ExpandableFeatureGroup
        eyebrow="EVERYDAY"
        icon="task"
        title="Day to day"
        summary={loading ? 'Loading…' : loadError ? 'Some information unavailable' : daySummary}
        status={openTasks.length ? `${openTasks.length} open` : undefined}
        items={organiseItems}
        expanded={isExpanded('dayToDay')}
        onExpandedChange={(expanded) => setExpanded('dayToDay', expanded)}
        accent
      />

      <ExpandableFeatureGroup
        eyebrow="WHEN"
        icon="calendar"
        title="Dates & time"
        summary={loading ? 'Loading…' : loadError ? 'Some information unavailable' : datesSummary}
        items={dateItems}
        expanded={isExpanded('datesAndTime')}
        onExpandedChange={(expanded) => setExpanded('datesAndTime', expanded)}
      />

      <ExpandableFeatureGroup
        eyebrow="LOOKING AHEAD"
        icon="trip"
        title="Looking ahead"
        summary={loading ? 'Loading…' : loadError ? 'Some information unavailable' : aheadSummary}
        status={activeGoals.length ? `${activeGoals.length} active` : undefined}
        items={aheadItems}
        expanded={isExpanded('lookingAhead')}
        onExpandedChange={(expanded) => setExpanded('lookingAhead', expanded)}
      />
    </>
  );
}
