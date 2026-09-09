const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RELEASE = 'G3 — Together Consolidation';
const MARKER = 'G3_TOGETHER_CONSOLIDATION';
const root = process.cwd();

const homeConnectionSource = "import { useState } from 'react';\nimport { Alert, Pressable, View } from 'react-native';\nimport { router } from 'expo-router';\nimport { AppIcon, type AppIconName } from '@/components/art/AppIcon';\nimport { AppText } from '@/components/common/AppText';\nimport { ParticipantIdentityBadge } from '@/components/common/ParticipantIdentityBadge';\nimport { useInteractionFeedback } from '@/hooks/useInteractionFeedback';\nimport { useWorkspace } from '@/providers/WorkspaceProvider';\nimport { createRelationshipPing } from '@/services/backend/mvpFeatures';\nimport { useAppTheme } from '@/theme/useAppTheme';\nimport { participantPalette } from '@/theme/tokens';\n\nfunction messageFrom(error: unknown) {\n  return error instanceof Error ? error.message : 'Something went wrong.';\n}\n\nfunction QuickAction({\n  icon,\n  label,\n  detail,\n  onPress,\n  disabled,\n  participantColor,\n}: {\n  icon: AppIconName;\n  label: string;\n  detail: string;\n  onPress: () => void;\n  disabled?: boolean;\n  participantColor?: string;\n}) {\n  const theme = useAppTheme();\n  const identity = participantColor ? participantPalette(participantColor) : null;\n\n  return (\n    <Pressable\n      accessibilityRole=\"button\"\n      accessibilityLabel={`${label}. ${detail}`}\n      disabled={disabled}\n      onPress={onPress}\n      style={({ pressed }) => ({\n        flex: 1,\n        minWidth: '30%',\n        minHeight: 66,\n        borderRadius: theme.radii.md,\n        borderWidth: 1,\n        borderColor: identity?.border ?? theme.colors.border,\n        backgroundColor: pressed ? theme.colors.cardElevated : theme.colors.elevatedBackground,\n        paddingHorizontal: theme.spacing.md,\n        paddingVertical: 10,\n        gap: 7,\n        opacity: disabled ? 0.5 : pressed ? 0.74 : 1,\n      })}\n    >\n      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>\n        <AppIcon name={icon} size={18} color={identity?.accent ?? theme.colors.textSecondary} />\n        {identity ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: identity.accent }} /> : null}\n      </View>\n      <View style={{ gap: 1 }}>\n        <AppText variant=\"bodySmall\" style={{ fontWeight: '700' }} numberOfLines={1}>{label}</AppText>\n        <AppText variant=\"caption\" tone=\"muted\" numberOfLines={1}>{detail}</AppText>\n      </View>\n    </Pressable>\n  );\n}\n\ntype HomeConnectionActionsProps = {\n  context?: 'home' | 'together';\n};\n\n// G2_HOME_DECLUTTER: Home keeps only tiny immediate relationship signals; mood check-in is owned by Together.\n// G3_TOGETHER_CONSOLIDATION: Together adds the single canonical mood entry without duplicating the Mood CTA in adjacent groups.\nexport function HomeConnectionActions({ context = 'home' }: HomeConnectionActionsProps) {\n  const theme = useAppTheme();\n  const feedback = useInteractionFeedback();\n  const { profile, partnerProfile, partnerColor } = useWorkspace();\n  const [pingBusy, setPingBusy] = useState<'love' | 'thinking_of_you' | null>(null);\n  const [recentSignal, setRecentSignal] = useState<'love' | 'thinking_of_you' | null>(null);\n\n  if (!profile || !partnerProfile) return null;\n\n  async function sendPing(kind: 'love' | 'thinking_of_you') {\n    if (pingBusy) return;\n    feedback();\n    setPingBusy(kind);\n    try {\n      await createRelationshipPing(kind);\n      setRecentSignal(kind);\n      setTimeout(() => setRecentSignal((current) => current === kind ? null : current), 2400);\n    } catch (error) {\n      Alert.alert('Couldn’t send it', messageFrom(error));\n    } finally {\n      setPingBusy(null);\n    }\n  }\n\n  const partnerName = partnerProfile.display_name;\n  const together = context === 'together';\n\n  return (\n    <View style={{ gap: theme.spacing.sm }}>\n      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md }}>\n        <View style={{ gap: 2 }}>\n          <AppText variant=\"section\">Between you</AppText>\n          <AppText variant=\"bodySmall\" tone=\"muted\">\n            {together ? `Tiny ways to reach ${partnerName} or check in right now.` : 'A quick little signal, without turning Home into another menu.'}\n          </AppText>\n        </View>\n        <ParticipantIdentityBadge userId={partnerProfile.id} compact />\n      </View>\n\n      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>\n        <QuickAction\n          icon=\"heart\"\n          label={recentSignal === 'love' ? 'Love sent ♥' : pingBusy === 'love' ? 'Sending…' : 'Love Tap'}\n          detail={`To ${partnerName}`}\n          participantColor={partnerColor}\n          disabled={Boolean(pingBusy)}\n          onPress={() => void sendPing('love')}\n        />\n        <QuickAction\n          icon=\"spark\"\n          label={recentSignal === 'thinking_of_you' ? 'Sent ✦' : pingBusy === 'thinking_of_you' ? 'Sending…' : 'Thinking of you'}\n          detail={`To ${partnerName}`}\n          participantColor={partnerColor}\n          disabled={Boolean(pingBusy)}\n          onPress={() => void sendPing('thinking_of_you')}\n        />\n        {together ? (\n          <QuickAction\n            icon=\"mood\"\n            label=\"How I’m feeling\"\n            detail=\"Open your check-in\"\n            participantColor={profile.preferred_participant_color ?? undefined}\n            onPress={() => {\n              feedback();\n              router.push('/features/mood' as never);\n            }}\n          />\n        ) : null}\n      </View>\n    </View>\n  );\n}\n";
const togetherHubGroupsSource = "import { useCallback, useEffect, useMemo, useState } from 'react';\nimport { ExpandableFeatureGroup, type ExpandableFeatureGroupItem } from '@/components/navigation/ExpandableFeatureGroup';\nimport { useExclusiveExpandedGroup } from '@/hooks/useExclusiveExpandedGroup';\nimport { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';\nimport { useWorkspace } from '@/providers/WorkspaceProvider';\nimport { getGames } from '@/services/backend/games';\nimport { getActivities, getDailyQuestion, getLatestMoods } from '@/services/backend/mvpFeatures';\nimport type { CoupleActivity, DailyQuestionState, GameSession, MoodEntry } from '@/types/database';\n\ntype TogetherGroupKey = 'checkIn' | 'play' | 'thingsToDo';\n\nfunction relative(entry: MoodEntry | null) {\n  if (!entry) return null;\n  const mins = Math.max(0, Math.round((Date.now() - new Date(entry.created_at).getTime()) / 60_000));\n  if (mins < 1) return 'just now';\n  if (mins < 60) return `${mins}m ago`;\n  const hours = Math.round(mins / 60);\n  if (hours < 24) return `${hours}h ago`;\n  const days = Math.round(hours / 24);\n  return `${days}d ago`;\n}\n\nfunction questionStatus(question: DailyQuestionState | null, partnerName: string) {\n  if (!question?.question) return 'No question today';\n  if (question.bothAnswered) return question.revealed ? 'Today’s question revealed' : 'Today’s question ready to reveal';\n  if (question.myAnswer) return `Waiting for ${partnerName}`;\n  return 'Today’s question waiting';\n}\n\n// G3_TOGETHER_CONSOLIDATION: Together exposes one compact hierarchy for check-in, play, and things to do.\nexport function TogetherHubGroups() {\n  const { partnerProfile } = useWorkspace();\n  const { isExpanded, setExpanded } = useExclusiveExpandedGroup<TogetherGroupKey>();\n  const [question, setQuestion] = useState<DailyQuestionState | null>(null);\n  const [partnerMood, setPartnerMood] = useState<MoodEntry | null>(null);\n  const [games, setGames] = useState<GameSession[]>([]);\n  const [activities, setActivities] = useState<CoupleActivity[]>([]);\n\n  const refresh = useCallback(async () => {\n    const [questionResult, moodsResult, gamesResult, activitiesResult] = await Promise.allSettled([\n      getDailyQuestion(),\n      getLatestMoods(),\n      getGames(),\n      getActivities(),\n    ]);\n\n    if (questionResult.status === 'fulfilled') setQuestion(questionResult.value);\n    if (moodsResult.status === 'fulfilled') setPartnerMood(moodsResult.value.partner);\n    if (gamesResult.status === 'fulfilled') setGames(gamesResult.value);\n    if (activitiesResult.status === 'fulfilled') setActivities(activitiesResult.value);\n  }, []);\n\n  useEffect(() => {\n    refresh().catch(() => undefined);\n  }, [refresh]);\n\n  useRealtimeRefresh('questions', refresh);\n  useRealtimeRefresh('moods', refresh);\n  useRealtimeRefresh('games', refresh);\n  useRealtimeRefresh('activities', refresh);\n\n  const partnerName = partnerProfile?.display_name ?? 'Your partner';\n  const activeGames = useMemo(() => games.filter((game) => game.status === 'active'), [games]);\n  const savedIdeas = useMemo(\n    () => activities.filter((activity) => activity.status !== 'completed' && activity.status !== 'skip'),\n    [activities],\n  );\n\n  const checkInSummary = useMemo(() => {\n    const moodTime = relative(partnerMood);\n    const moodText = moodTime ? `${partnerName} checked in ${moodTime}` : `${partnerName} hasn’t checked in yet`;\n    return `${questionStatus(question, partnerName)} · ${moodText}`;\n  }, [partnerMood, partnerName, question]);\n\n  const playSummary = activeGames.length\n    ? `${activeGames.length} ${activeGames.length === 1 ? 'game' : 'games'} active · ${activeGames[0]?.title ?? 'ready to continue'}`\n    : 'No active game · choose something to play';\n\n  const thingsSummary = savedIdeas.length\n    ? `${savedIdeas.length} ${savedIdeas.length === 1 ? 'date idea' : 'date ideas'} saved`\n    : 'No date ideas saved yet';\n\n  const playItems = useMemo<ExpandableFeatureGroupItem[]>(() => {\n    const items: ExpandableFeatureGroupItem[] = [];\n    if (activeGames[0]) {\n      items.push({\n        key: activeGames[0].id,\n        icon: 'game',\n        title: `Continue ${activeGames[0].title}`,\n        subtitle: 'Jump back into your active shared game',\n        status: 'Active',\n        href: `/features/games/${activeGames[0].id}`,\n      });\n    }\n    items.push({\n      key: 'play-together',\n      icon: 'game',\n      title: 'Play together',\n      subtitle: 'Games and shared things to do while you’re both here',\n      href: '/features/play-together',\n    });\n    return items;\n  }, [activeGames]);\n\n  const checkInItems = useMemo<ExpandableFeatureGroupItem[]>(() => [\n    {\n      key: 'daily-question',\n      icon: 'question',\n      title: 'Daily question',\n      subtitle: 'Answer separately, then open it together',\n      href: '/features/daily-question',\n    },\n    {\n      key: 'live-location',\n      icon: 'location',\n      title: 'Live location',\n      subtitle: 'See each other on the map when you choose',\n      href: '/features/location',\n    },\n  ], []);\n\n  const thingsItems = useMemo<ExpandableFeatureGroupItem[]>(() => [\n    {\n      key: 'date-ideas',\n      icon: 'date',\n      title: 'Date ideas',\n      subtitle: 'Save ideas, find matches or pick one at random',\n      status: savedIdeas.length ? String(savedIdeas.length) : undefined,\n      href: '/features/activities',\n    },\n  ], [savedIdeas.length]);\n\n  return (\n    <>\n      <ExpandableFeatureGroup\n        eyebrow=\"CHECK IN\"\n        icon=\"mood\"\n        title=\"Check in\"\n        summary={checkInSummary}\n        items={checkInItems}\n        expanded={isExpanded('checkIn')}\n        onExpandedChange={(expanded) => setExpanded('checkIn', expanded)}\n        participantColor=\"both\"\n        accessibilityHint=\"Expand to open the daily question or live location. Mood check-in is available above.\"\n      />\n\n      <ExpandableFeatureGroup\n        eyebrow=\"PLAY\"\n        icon=\"game\"\n        title=\"Play\"\n        summary={playSummary}\n        status={activeGames.length ? `${activeGames.length} active` : undefined}\n        items={playItems}\n        expanded={isExpanded('play')}\n        onExpandedChange={(expanded) => setExpanded('play', expanded)}\n        participantColor=\"both\"\n      />\n\n      <ExpandableFeatureGroup\n        eyebrow=\"THINGS TO DO\"\n        icon=\"date\"\n        title=\"Things to do\"\n        summary={thingsSummary}\n        status={savedIdeas.length ? String(savedIdeas.length) : undefined}\n        items={thingsItems}\n        expanded={isExpanded('thingsToDo')}\n        onExpandedChange={(expanded) => setExpanded('thingsToDo', expanded)}\n        participantColor=\"both\"\n      />\n    </>\n  );\n}\n";
const togetherScreenSource = "import { View } from 'react-native';\nimport { AppScreen } from '@/components/common/AppScreen';\nimport { PageHeader } from '@/components/common/PageHeader';\nimport { PartnerPresencePill } from '@/components/common/PartnerPresencePill';\nimport { CoupleIdentitySignature } from '@/components/common/CoupleIdentitySignature';\nimport { HomeConnectionActions } from '@/components/dashboard/HomeConnectionActions';\nimport { TogetherHubGroups } from '@/components/together/TogetherHubGroups';\nimport { useAppTheme } from '@/theme/useAppTheme';\n\n// G3_TOGETHER_CONSOLIDATION: Together is the canonical home for connection, check-in, play and date ideas.\nexport default function TogetherScreen() {\n  const theme = useAppTheme();\n\n  return (\n    <AppScreen>\n      <PageHeader eyebrow=\"Right now\" title=\"Together\" subtitle=\"The part of your space for actually being together.\" />\n\n      <View style={{ gap: theme.spacing.lg }}>\n        {/* E3_PAIRED_COUPLE_IDENTITY */}\n        <CoupleIdentitySignature detail=\"A space for the two of you to be present together.\" />\n        <PartnerPresencePill scope=\"together\" />\n\n        <HomeConnectionActions context=\"together\" />\n        <TogetherHubGroups />\n      </View>\n    </AppScreen>\n  );\n}\n";

function fail(message) {
  console.error(`\n[G3] ${message}`);
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
  ];

  const failures = [];
  for (const [relativePath, expectedMarker] of guards) {
    const source = read(relativePath).replace(/\r\n/g, '\n');
    if (!source.includes(expectedMarker)) failures.push(`${relativePath} missing ${expectedMarker}`);
  }

  if (failures.length) fail(`Completed-phase guard failed before any G3 write:\n- ${failures.join('\n- ')}`);
}

function prepareHomeConnection() {
  const { source, eol } = sourceWithEol('src/components/dashboard/HomeConnectionActions.tsx');
  if (source.includes(MARKER)) return { relativePath: 'src/components/dashboard/HomeConnectionActions.tsx', output: source, eol, write: false };

  const required = [
    'G2_HOME_DECLUTTER',
    "export function HomeConnectionActions()",
    'Love Tap',
    'Thinking of you',
  ];
  for (const token of required) {
    if (!source.includes(token)) throw new Error(`HomeConnectionActions baseline changed; missing ${token}. Refusing broad overwrite.`);
  }

  return { relativePath: 'src/components/dashboard/HomeConnectionActions.tsx', output: homeConnectionSource, eol, write: true };
}

function prepareTogetherScreen() {
  const { source, eol } = sourceWithEol('src/app/(tabs)/together.tsx');
  if (source.includes(MARKER)) return { relativePath: 'src/app/(tabs)/together.tsx', output: source, eol, write: false };

  const required = [
    '<HomeConnectionActions />',
    'FeatureGroupCard',
    'Play together',
    'Date ideas',
    'CoupleIdentitySignature',
  ];
  for (const token of required) {
    if (!source.includes(token)) throw new Error(`Together screen baseline changed; missing ${token}. Refusing broad overwrite.`);
  }

  return { relativePath: 'src/app/(tabs)/together.tsx', output: togetherScreenSource, eol, write: true };
}

function prepareTogetherHub(preferredEol) {
  const relativePath = 'src/components/together/TogetherHubGroups.tsx';
  const fullPath = path.join(root, relativePath);

  if (!fs.existsSync(fullPath)) {
    return { relativePath, output: togetherHubGroupsSource, eol: preferredEol, write: true };
  }

  const raw = fs.readFileSync(fullPath, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const source = raw.replace(/\r\n/g, '\n');

  if (!source.includes(MARKER)) {
    throw new Error(`${relativePath} already exists without the G3 marker; refusing to overwrite unrelated work.`);
  }

  return { relativePath, output: source, eol, write: false };
}

function audit() {
  const homeConnection = read('src/components/dashboard/HomeConnectionActions.tsx').replace(/\r\n/g, '\n');
  const together = read('src/app/(tabs)/together.tsx').replace(/\r\n/g, '\n');
  const groups = read('src/components/together/TogetherHubGroups.tsx').replace(/\r\n/g, '\n');
  const failures = [];

  if (!homeConnection.includes(MARKER)) failures.push('HomeConnectionActions G3 marker missing');
  if (!homeConnection.includes("context?: 'home' | 'together'")) failures.push('Together-only quick action context missing');
  if (!homeConnection.includes('label="How I’m feeling"')) failures.push('Canonical Together mood entry missing');
  if (!homeConnection.includes("router.push('/features/mood' as never)")) failures.push('Together mood entry does not open the canonical Mood screen');

  if (!together.includes(MARKER)) failures.push('Together screen G3 marker missing');
  if (!together.includes('<HomeConnectionActions context="together" />')) failures.push('Together is not enabling its canonical quick check-in');
  if (!together.includes('<TogetherHubGroups />')) failures.push('Together hub groups missing');
  if (together.includes('FeatureGroupCard') || together.includes('ConnectionOrbitArt') || together.includes('label="Play together"')) failures.push('Legacy always-expanded Together navigation still present');

  if (!groups.includes(MARKER)) failures.push('TogetherHubGroups G3 marker missing');
  if (!groups.includes("useExclusiveExpandedGroup<TogetherGroupKey>()")) failures.push('One-open-at-a-time behavior missing');
  if (!groups.includes('title="Check in"') || !groups.includes('title="Play"') || !groups.includes('title="Things to do"')) failures.push('Required Together groups missing');
  if (groups.includes("title: 'Mood") || groups.includes("href: '/features/mood'")) failures.push('Mood is duplicated inside the Check in group');
  if (!groups.includes("href: '/features/daily-question'")) failures.push('Daily Question navigation missing');
  if (!groups.includes("href: '/features/play-together'")) failures.push('Play Together navigation missing');
  if (!groups.includes("href: '/features/activities'")) failures.push('Date Ideas navigation missing');
  if (!groups.includes("href: '/features/location'")) failures.push('Live Location navigation missing');

  // Re-check G1/G2 preservation.
  if (!read('src/components/navigation/ExpandableFeatureGroup.tsx').includes('G1_UI_HIERARCHY_EXPANDABLE_HUB_FOUNDATION')) failures.push('G1 expandable group marker missing');
  if (!read('src/components/dashboard/HomeQuickActions.tsx').includes('G2_HOME_DECLUTTER')) failures.push('G2 Home Quick Actions marker missing');

  if (failures.length) fail(`Source audit failed:\n- ${failures.join('\n- ')}`);
}

function runNpm(args, label) {
  console.log(`\n[G3] ${label}`);
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
console.log(`[G3] Project root: ${root}`);

if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'server', 'package.json'))) {
  fail('Run this installer from the Togetherly project root.');
}

guardCompletedPhases();

let pending;
try {
  const home = prepareHomeConnection();
  const together = prepareTogetherScreen();
  const hub = prepareTogetherHub(together.eol);
  pending = [home, together, hub];
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

// All outputs are prepared before source writes begin.
for (const item of pending) {
  if (!item.write) {
    console.log(`[G3] ${item.relativePath}: already ready`);
    continue;
  }

  const fullPath = path.join(root, item.relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, restoreEol(item.output, item.eol), 'utf8');
  console.log(`[G3] ${item.relativePath}: ready`);
}

console.log('\n[G3] Source audit');
audit();
console.log('[G3] Source audit passed.');

if (process.env.TOGETHERLY_INSTALLER_SELF_TEST !== '1') {
  runNpm(['run', 'typecheck'], 'Client typecheck');
  runNpm(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
  runNpm(['--prefix', 'server', 'run', 'logic'], 'Server logic');
}

console.log('\n[G3] ALL VALIDATIONS PASSED');
console.log('[G3] No migration or dependency changes. Do not run expo lint for this release.');
