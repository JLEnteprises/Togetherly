import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExpandableFeatureGroup, type ExpandableFeatureGroupItem } from '@/components/navigation/ExpandableFeatureGroup';
import { useExclusiveExpandedGroup } from '@/hooks/useExclusiveExpandedGroup';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
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
  return trips
    .filter((trip) => trip.start_date && trip.start_date >= today)
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))[0] ?? null;
}

// G4_PLAN_EXPANDABLE_GROUPS: Plan keeps its existing feature ownership while revealing one practical group at a time.
// CONTEXT_COMPOUNDING: realtime changes now refresh only the domain that changed instead of reloading every Plan summary.
export function PlanHubGroups() {
  const { isExpanded, setExpanded } = useExclusiveExpandedGroup<PlanGroupKey>();
  const { profile, partnerProfile } = useWorkspace();
  const [tasks, setTasks] = useState<CoupleTask[]>([]);
  const [lists, setLists] = useState<CoupleList[]>([]);
  const [notes, setNotes] = useState<CoupleNote[]>([]);
  const [events, setEvents] = useState<CoupleEvent[]>([]);
  const [countdowns, setCountdowns] = useState<CoupleCountdown[]>([]);
  const [overlap, setOverlap] = useState<AvailabilityOverlap | null>(null);
  const [trips, setTrips] = useState<CoupleTrip[]>([]);
  const [goals, setGoals] = useState<CoupleGoal[]>([]);

  const refreshTasks = useCallback(async () => { setTasks(await getTasks()); }, []);
  const refreshLists = useCallback(async () => { setLists(await getLists()); }, []);
  const refreshNotes = useCallback(async () => { setNotes(await getNotes()); }, []);
  const refreshEvents = useCallback(async () => { setEvents(await getEvents()); }, []);
  const refreshCountdowns = useCallback(async () => { setCountdowns(await getCountdowns()); }, []);
  const refreshAvailability = useCallback(async () => {
    const result = await getAvailabilityOverlaps(14, 30);
    setOverlap(result.overlaps[0] ?? null);
  }, []);
  const refreshTrips = useCallback(async () => { setTrips(await getTrips()); }, []);
  const refreshGoals = useCallback(async () => { setGoals(await getGoals()); }, []);

  const refreshAll = useCallback(async () => {
    await Promise.allSettled([
      refreshTasks(),
      refreshLists(),
      refreshNotes(),
      refreshEvents(),
      refreshCountdowns(),
      refreshAvailability(),
      refreshTrips(),
      refreshGoals(),
    ]);
  }, [refreshAvailability, refreshCountdowns, refreshEvents, refreshGoals, refreshLists, refreshNotes, refreshTasks, refreshTrips]);

  useEffect(() => {
    refreshAll().catch(() => undefined);
  }, [refreshAll]);

  useRealtimeRefresh('tasks', refreshTasks);
  useRealtimeRefresh('lists', refreshLists);
  useRealtimeRefresh('notes', refreshNotes);
  useRealtimeRefresh('events', refreshEvents);
  useRealtimeRefresh('countdowns', refreshCountdowns);
  useRealtimeRefresh('schedules', refreshAvailability);
  useRealtimeRefresh('trips', refreshTrips);
  useRealtimeRefresh('goals', refreshGoals);

  const openTasks = useMemo(
    () => tasks.filter((task) => task.status !== 'completed' && task.status !== 'skipped'),
    [tasks],
  );

  const taskOwnership = useMemo(() => {
    const mine = openTasks.filter((task) => !task.assign_to_both && task.assignee_id === profile?.id).length;
    const partner = openTasks.filter((task) => !task.assign_to_both && task.assignee_id === partnerProfile?.id).length;
    const shared = openTasks.filter((task) => task.assign_to_both).length;
    const mineName = profile?.display_name ?? 'You';
    const partnerName = partnerProfile?.display_name ?? 'Partner';
    if (!partnerProfile) return `${shared} shared · ${mine} yours`;
    if (mine >= partner + 3 && mine >= 4) return `Most assigned tasks currently sit with ${mineName} · worth a quick handoff check`;
    if (partner >= mine + 3 && partner >= 4) return `Most assigned tasks currently sit with ${partnerName} · worth a quick handoff check`;
    return `${mine} ${mineName} · ${partner} ${partnerName} · ${shared} together`;
  }, [openTasks, partnerProfile, profile]);

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
    : `${plural(activeGoals.length, 'active goal')} · no upcoming trip planned`;

  const organiseItems = useMemo<ExpandableFeatureGroupItem[]>(() => [
    {
      key: 'tasks',
      icon: 'task',
      title: 'Tasks',
      subtitle: taskOwnership,
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
  ], [lists.length, notes.length, openTasks.length, taskOwnership]);

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
      <ExpandableFeatureGroup
        eyebrow="EVERYDAY"
        icon="task"
        title="Day to day"
        summary={daySummary}
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
        summary={datesSummary}
        items={dateItems}
        expanded={isExpanded('datesAndTime')}
        onExpandedChange={(expanded) => setExpanded('datesAndTime', expanded)}
      />

      <ExpandableFeatureGroup
        eyebrow="LOOKING AHEAD"
        icon="trip"
        title="Looking ahead"
        summary={aheadSummary}
        status={activeGoals.length ? `${activeGoals.length} active` : undefined}
        items={aheadItems}
        expanded={isExpanded('lookingAhead')}
        onExpandedChange={(expanded) => setExpanded('lookingAhead', expanded)}
      />
    </>
  );
}
