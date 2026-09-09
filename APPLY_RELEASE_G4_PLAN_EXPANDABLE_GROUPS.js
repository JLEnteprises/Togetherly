const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RELEASE = 'G4 — Plan Expandable Groups';
const MARKER = 'G4_PLAN_EXPANDABLE_GROUPS';
const root = process.cwd();

const planHubSource = "import { useCallback, useEffect, useMemo, useState } from 'react';\nimport { ExpandableFeatureGroup, type ExpandableFeatureGroupItem } from '@/components/navigation/ExpandableFeatureGroup';\nimport { useExclusiveExpandedGroup } from '@/hooks/useExclusiveExpandedGroup';\nimport { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';\nimport { getAvailabilityOverlaps } from '@/services/backend/availability';\nimport { getCountdowns, getLists, getNotes, getTasks } from '@/services/backend/coreFeatures';\nimport { getEvents, getGoals, getTrips } from '@/services/backend/mvpFeatures';\nimport { expandEvents } from '@/utils/calendar';\nimport { countdownRemaining } from '@/utils/countdown';\nimport type {\n  AvailabilityOverlap,\n  CoupleCountdown,\n  CoupleEvent,\n  CoupleGoal,\n  CoupleList,\n  CoupleNote,\n  CoupleTask,\n  CoupleTrip,\n} from '@/types/database';\n\ntype PlanGroupKey = 'dayToDay' | 'datesAndTime' | 'lookingAhead';\n\nfunction plural(count: number, singular: string, pluralValue = `${singular}s`) {\n  return `${count} ${count === 1 ? singular : pluralValue}`;\n}\n\nfunction shortWhen(date: Date) {\n  return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(date);\n}\n\nfunction overlapWhen(overlap: AvailabilityOverlap | null) {\n  if (!overlap) return null;\n  const start = new Date(overlap.startAt);\n  return `free ${new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(start)}`;\n}\n\nfunction nextFutureCountdown(countdowns: CoupleCountdown[], now = Date.now()) {\n  return countdowns\n    .filter((item) => new Date(item.target_at).getTime() >= now)\n    .sort((a, b) => new Date(a.target_at).getTime() - new Date(b.target_at).getTime())[0] ?? null;\n}\n\nfunction nextTrip(trips: CoupleTrip[]) {\n  const today = new Date().toISOString().slice(0, 10);\n  const dated = trips\n    .filter((trip) => trip.start_date && trip.start_date >= today)\n    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''));\n  return dated[0] ?? trips[0] ?? null;\n}\n\n// G4_PLAN_EXPANDABLE_GROUPS: Plan keeps its existing feature ownership while revealing one practical group at a time.\nexport function PlanHubGroups() {\n  const { isExpanded, setExpanded } = useExclusiveExpandedGroup<PlanGroupKey>();\n  const [tasks, setTasks] = useState<CoupleTask[]>([]);\n  const [lists, setLists] = useState<CoupleList[]>([]);\n  const [notes, setNotes] = useState<CoupleNote[]>([]);\n  const [events, setEvents] = useState<CoupleEvent[]>([]);\n  const [countdowns, setCountdowns] = useState<CoupleCountdown[]>([]);\n  const [overlap, setOverlap] = useState<AvailabilityOverlap | null>(null);\n  const [trips, setTrips] = useState<CoupleTrip[]>([]);\n  const [goals, setGoals] = useState<CoupleGoal[]>([]);\n\n  const refresh = useCallback(async () => {\n    const results = await Promise.allSettled([\n      getTasks(),\n      getLists(),\n      getNotes(),\n      getEvents(),\n      getCountdowns(),\n      getAvailabilityOverlaps(14, 30),\n      getTrips(),\n      getGoals(),\n    ]);\n\n    const [taskResult, listResult, noteResult, eventResult, countdownResult, overlapResult, tripResult, goalResult] = results;\n\n    if (taskResult.status === 'fulfilled') setTasks(taskResult.value);\n    if (listResult.status === 'fulfilled') setLists(listResult.value);\n    if (noteResult.status === 'fulfilled') setNotes(noteResult.value);\n    if (eventResult.status === 'fulfilled') setEvents(eventResult.value);\n    if (countdownResult.status === 'fulfilled') setCountdowns(countdownResult.value);\n    if (overlapResult.status === 'fulfilled') setOverlap(overlapResult.value.overlaps[0] ?? null);\n    if (tripResult.status === 'fulfilled') setTrips(tripResult.value);\n    if (goalResult.status === 'fulfilled') setGoals(goalResult.value);\n  }, []);\n\n  useEffect(() => {\n    refresh().catch(() => undefined);\n  }, [refresh]);\n\n  useRealtimeRefresh('tasks', refresh);\n  useRealtimeRefresh('lists', refresh);\n  useRealtimeRefresh('notes', refresh);\n  useRealtimeRefresh('events', refresh);\n  useRealtimeRefresh('countdowns', refresh);\n  useRealtimeRefresh('schedules', refresh);\n  useRealtimeRefresh('trips', refresh);\n  useRealtimeRefresh('goals', refresh);\n\n  const openTasks = useMemo(\n    () => tasks.filter((task) => task.status !== 'completed' && task.status !== 'skipped'),\n    [tasks],\n  );\n\n  const futureCountdowns = useMemo(\n    () => countdowns.filter((item) => new Date(item.target_at).getTime() >= Date.now()),\n    [countdowns],\n  );\n\n  const nextCountdown = useMemo(() => nextFutureCountdown(countdowns), [countdowns]);\n\n  const nextEvent = useMemo(() => {\n    const now = new Date();\n    return expandEvents(events, now, new Date(now.getTime() + 366 * 86_400_000))[0] ?? null;\n  }, [events]);\n\n  const activeGoals = useMemo(() => goals.filter((goal) => goal.status === 'active'), [goals]);\n  const upcomingTrip = useMemo(() => nextTrip(trips), [trips]);\n\n  const daySummary = `${plural(openTasks.length, 'task')} need attention · ${plural(lists.length, 'list')} · ${plural(notes.length, 'note')}`;\n\n  const eventSummary = nextEvent ? `${nextEvent.event.title} ${shortWhen(nextEvent.start)}` : null;\n  const countdownSummary = nextCountdown\n    ? (() => {\n        const remaining = countdownRemaining(nextCountdown.target_at, Date.now());\n        return `${remaining.days}d to ${nextCountdown.title}`;\n      })()\n    : null;\n  const availabilitySummary = overlapWhen(overlap);\n  const datesSummary = [eventSummary, countdownSummary, availabilitySummary].filter(Boolean).slice(0, 2).join(' · ')\n    || 'No upcoming dates or shared free time yet';\n\n  const aheadSummary = upcomingTrip\n    ? `${upcomingTrip.title}${upcomingTrip.start_date ? ` · ${shortWhen(new Date(`${upcomingTrip.start_date}T12:00:00`))}` : ''} · ${plural(activeGoals.length, 'active goal')}`\n    : `${plural(activeGoals.length, 'active goal')} · no trip planned`;\n\n  const organiseItems = useMemo<ExpandableFeatureGroupItem[]>(() => [\n    {\n      key: 'tasks',\n      icon: 'task',\n      title: 'Tasks',\n      subtitle: 'What needs doing, without the mental load',\n      status: openTasks.length ? `${openTasks.length} open` : 'Clear',\n      href: '/features/tasks',\n    },\n    {\n      key: 'lists',\n      icon: 'list',\n      title: 'Lists',\n      subtitle: 'Shopping, packing and shared lists',\n      status: lists.length ? String(lists.length) : undefined,\n      href: '/features/lists',\n    },\n    {\n      key: 'notes',\n      icon: 'note',\n      title: 'Notes',\n      subtitle: 'Writing worth keeping, shared or private',\n      status: notes.length ? String(notes.length) : undefined,\n      href: '/features/notes',\n    },\n  ], [lists.length, notes.length, openTasks.length]);\n\n  const dateItems = useMemo<ExpandableFeatureGroupItem[]>(() => [\n    {\n      key: 'calendar',\n      icon: 'calendar',\n      title: 'Calendar',\n      subtitle: 'Month, week and agenda',\n      status: nextEvent ? shortWhen(nextEvent.start) : undefined,\n      href: '/features/calendar',\n    },\n    {\n      key: 'countdowns',\n      icon: 'countdown',\n      title: 'Countdowns',\n      subtitle: 'Visits, anniversaries and milestones',\n      status: futureCountdowns.length ? String(futureCountdowns.length) : undefined,\n      href: '/features/countdowns',\n    },\n    {\n      key: 'availability',\n      icon: 'availability',\n      title: 'When are we both free?',\n      subtitle: 'Find the overlap without comparing calendars by hand',\n      status: overlap ? 'Overlap found' : undefined,\n      href: '/features/availability',\n    },\n  ], [futureCountdowns.length, nextEvent, overlap]);\n\n  const aheadItems = useMemo<ExpandableFeatureGroupItem[]>(() => [\n    {\n      key: 'trips',\n      icon: 'trip',\n      title: 'Trips',\n      subtitle: 'Everything for the next time you’re going somewhere together',\n      status: trips.length ? String(trips.length) : undefined,\n      href: '/features/trips',\n    },\n    {\n      key: 'goals',\n      icon: 'goal',\n      title: 'Goals',\n      subtitle: 'Goals you can build together',\n      status: activeGoals.length ? `${activeGoals.length} active` : undefined,\n      href: '/features/goals',\n    },\n  ], [activeGoals.length, trips.length]);\n\n  return (\n    <>\n      <ExpandableFeatureGroup\n        eyebrow=\"EVERYDAY\"\n        icon=\"task\"\n        title=\"Day to day\"\n        summary={daySummary}\n        status={openTasks.length ? `${openTasks.length} open` : undefined}\n        items={organiseItems}\n        expanded={isExpanded('dayToDay')}\n        onExpandedChange={(expanded) => setExpanded('dayToDay', expanded)}\n        accent\n      />\n\n      <ExpandableFeatureGroup\n        eyebrow=\"WHEN\"\n        icon=\"calendar\"\n        title=\"Dates & time\"\n        summary={datesSummary}\n        items={dateItems}\n        expanded={isExpanded('datesAndTime')}\n        onExpandedChange={(expanded) => setExpanded('datesAndTime', expanded)}\n      />\n\n      <ExpandableFeatureGroup\n        eyebrow=\"LOOKING AHEAD\"\n        icon=\"trip\"\n        title=\"Looking ahead\"\n        summary={aheadSummary}\n        status={activeGoals.length ? `${activeGoals.length} active` : undefined}\n        items={aheadItems}\n        expanded={isExpanded('lookingAhead')}\n        onExpandedChange={(expanded) => setExpanded('lookingAhead', expanded)}\n      />\n    </>\n  );\n}\n";
const planScreenSource = "import { View } from 'react-native';\nimport { AppScreen } from '@/components/common/AppScreen';\nimport { PageHeader } from '@/components/common/PageHeader';\nimport { PlanHubGroups } from '@/components/plan/PlanHubGroups';\nimport { useAppTheme } from '@/theme/useAppTheme';\n\n// G4_PLAN_EXPANDABLE_GROUPS: Plan uses compact live summaries and reveals one practical feature group at a time.\nexport default function PlanScreen() {\n  const theme = useAppTheme();\n\n  return (\n    <AppScreen>\n      <PageHeader eyebrow=\"Shared life\" title=\"Plan\" subtitle=\"The practical bits of life you’re building together.\" />\n      <View style={{ gap: theme.spacing.lg }}>\n        <PlanHubGroups />\n      </View>\n    </AppScreen>\n  );\n}\n";

function fail(message) {
  console.error(`\n[G4] ${message}`);
  process.exit(1);
}

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) fail(`Missing expected file: ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function sourceWithEol(relativePath) {
  const source = read(relativePath);
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  return { source: source.replace(/\r\n/g, '\n'), eol };
}

function restoreEol(source, eol) {
  return eol === '\r\n' ? source.replace(/\n/g, '\r\n') : source;
}

function guardCompletedPhases() {
  const guards = [
    ['src/components/common/Card.tsx', 'E1_SHARED_OURS_VISUAL_IDENTITY'],
    ['src/components/common/Card.tsx', 'E2_PERSONAL_COLOUR_IDENTITY'],
    ['src/components/common/CoupleIdentitySignature.tsx', 'E3_PAIRED_COUPLE_IDENTITY'],
    ['src/components/common/EyebrowText.tsx', 'E4_FINAL_VISUAL_CONSISTENCY'],
    ['src/components/dashboard/FirstTimeGuideCard.tsx', 'F1_FIRST_TIME_USER_GUIDANCE'],
    ['src/components/common/EmptyState.tsx', 'F2_EMPTY_STATE_COACHING'],
    ['src/components/common/IconButton.tsx', 'F3_ICON_POLISH_ACCESSIBILITY_FINISH'],
    ['src/components/navigation/ExpandableFeatureGroup.tsx', 'G1_UI_HIERARCHY_EXPANDABLE_HUB_FOUNDATION'],
    ['src/hooks/useExclusiveExpandedGroup.ts', 'G1_UI_HIERARCHY_EXPANDABLE_HUB_FOUNDATION'],
    ['src/components/dashboard/HomeConnectionActions.tsx', 'G2_HOME_DECLUTTER'],
    ['src/components/dashboard/HomeQuickActions.tsx', 'G2_HOME_DECLUTTER'],
    ['src/components/dashboard/HomeTodayCard.tsx', 'G2_HOME_DECLUTTER'],
    ['src/components/dashboard/LongDistanceOverviewCard.tsx', 'G2_HOME_DECLUTTER'],
    ['src/app/features/home-layout.tsx', 'G2_HOME_DECLUTTER'],
    ['src/app/(tabs)/together.tsx', 'G3_TOGETHER_CONSOLIDATION'],
    ['src/components/dashboard/HomeConnectionActions.tsx', 'G3_TOGETHER_CONSOLIDATION'],
    ['src/components/together/TogetherHubGroups.tsx', 'G3_TOGETHER_CONSOLIDATION'],
  ];

  const failures = [];
  for (const [relativePath, expectedMarker] of guards) {
    const source = read(relativePath).replace(/\r\n/g, '\n');
    if (!source.includes(expectedMarker)) failures.push(`${relativePath} missing ${expectedMarker}`);
  }

  if (failures.length) fail(`Completed-phase guard failed before any G4 write:\n- ${failures.join('\n- ')}`);
}

function preparePlanScreen() {
  const { source, eol } = sourceWithEol('src/app/(tabs)/plan.tsx');
  if (source.includes(MARKER)) return { relativePath: 'src/app/(tabs)/plan.tsx', output: source, eol, write: false };

  const required = [
    'FeatureGroupCard',
    'title="Day to day"',
    'title="Dates worth keeping"',
    'title="Things you’re building toward"',
    "href: '/features/tasks'",
    "href: '/features/calendar'",
    "href: '/features/trips'",
  ];

  for (const token of required) {
    if (!source.includes(token)) throw new Error(`Plan screen baseline changed; missing ${token}. Refusing broad overwrite.`);
  }

  return { relativePath: 'src/app/(tabs)/plan.tsx', output: planScreenSource, eol, write: true };
}

function preparePlanHub(preferredEol) {
  const relativePath = 'src/components/plan/PlanHubGroups.tsx';
  const fullPath = path.join(root, relativePath);

  if (!fs.existsSync(fullPath)) {
    return { relativePath, output: planHubSource, eol: preferredEol, write: true };
  }

  const raw = fs.readFileSync(fullPath, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const source = raw.replace(/\r\n/g, '\n');

  if (!source.includes(MARKER)) {
    throw new Error(`${relativePath} already exists without the G4 marker; refusing to overwrite unrelated work.`);
  }

  return { relativePath, output: source, eol, write: false };
}

function audit() {
  const plan = read('src/app/(tabs)/plan.tsx').replace(/\r\n/g, '\n');
  const groups = read('src/components/plan/PlanHubGroups.tsx').replace(/\r\n/g, '\n');
  const failures = [];

  if (!plan.includes(MARKER)) failures.push('Plan screen G4 marker missing');
  if (!plan.includes('<PlanHubGroups />')) failures.push('PlanHubGroups not mounted');
  if (plan.includes('FeatureGroupCard')) failures.push('Legacy always-expanded Plan cards still present');

  if (!groups.includes(MARKER)) failures.push('PlanHubGroups G4 marker missing');
  if (!groups.includes('useExclusiveExpandedGroup<PlanGroupKey>()')) failures.push('One-open-at-a-time Plan behavior missing');
  if (!groups.includes('title="Day to day"')) failures.push('Day to day group missing');
  if (!groups.includes('title="Dates & time"')) failures.push('Dates & time group missing');
  if (!groups.includes('title="Looking ahead"')) failures.push('Looking ahead group missing');

  for (const href of [
    '/features/tasks',
    '/features/lists',
    '/features/notes',
    '/features/calendar',
    '/features/countdowns',
    '/features/availability',
    '/features/trips',
    '/features/goals',
  ]) {
    if (!groups.includes(`href: '${href}'`)) failures.push(`Canonical Plan feature missing: ${href}`);
  }

  if (!groups.includes('getTasks()') || !groups.includes('getEvents()') || !groups.includes('getTrips()') || !groups.includes('getGoals()')) {
    failures.push('Live Plan summary data is incomplete');
  }

  if (!read('src/components/navigation/ExpandableFeatureGroup.tsx').includes('G1_UI_HIERARCHY_EXPANDABLE_HUB_FOUNDATION')) failures.push('G1 expandable primitive marker missing');
  if (!read('src/components/together/TogetherHubGroups.tsx').includes('G3_TOGETHER_CONSOLIDATION')) failures.push('G3 Together marker missing');

  if (failures.length) fail(`Source audit failed:\n- ${failures.join('\n- ')}`);
}

function runNpm(args, label) {
  console.log(`\n[G4] ${label}`);
  let result;

  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || 'cmd.exe';
    const command = ['npm.cmd', ...args].join(' ');
    result = spawnSync(comspec, ['/d', '/s', '/c', command], { cwd: root, stdio: 'inherit' });
  } else {
    result = spawnSync('npm', args, { cwd: root, stdio: 'inherit' });
  }

  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} failed with exit code ${result.status}. Source changes have been left in place for a targeted repair if needed.`);
}

console.log(`\n=== Togetherly ${RELEASE} ===`);
console.log(`[G4] Project root: ${root}`);

if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'server', 'package.json'))) {
  fail('Run this installer from the Togetherly project root.');
}

guardCompletedPhases();

let pending;
try {
  const plan = preparePlanScreen();
  const hub = preparePlanHub(plan.eol);
  pending = [plan, hub];
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

// All outputs are prepared before any source write.
for (const item of pending) {
  if (!item.write) {
    console.log(`[G4] ${item.relativePath}: already ready`);
    continue;
  }

  const fullPath = path.join(root, item.relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, restoreEol(item.output, item.eol), 'utf8');
  console.log(`[G4] ${item.relativePath}: ready`);
}

console.log('\n[G4] Source audit');
audit();
console.log('[G4] Source audit passed.');

if (process.env.TOGETHERLY_INSTALLER_SELF_TEST !== '1') {
  runNpm(['run', 'typecheck'], 'Client typecheck');
  runNpm(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
  runNpm(['--prefix', 'server', 'run', 'logic'], 'Server logic');
}

console.log('\n[G4] ALL VALIDATIONS PASSED');
console.log('[G4] No migration or dependency changes. Do not run expo lint for this release.');
