const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RELEASE = 'G2 — Home Declutter';
const MARKER = 'G2_HOME_DECLUTTER';
const root = process.cwd();

const homeConnectionSource = "import { useState } from 'react';\nimport { Alert, Pressable, View } from 'react-native';\nimport { AppIcon, type AppIconName } from '@/components/art/AppIcon';\nimport { AppText } from '@/components/common/AppText';\nimport { ParticipantIdentityBadge } from '@/components/common/ParticipantIdentityBadge';\nimport { useInteractionFeedback } from '@/hooks/useInteractionFeedback';\nimport { useWorkspace } from '@/providers/WorkspaceProvider';\nimport { createRelationshipPing } from '@/services/backend/mvpFeatures';\nimport { useAppTheme } from '@/theme/useAppTheme';\nimport { participantPalette } from '@/theme/tokens';\n\nfunction messageFrom(error: unknown) {\n  return error instanceof Error ? error.message : 'Something went wrong.';\n}\n\nfunction QuickAction({\n  icon,\n  label,\n  detail,\n  onPress,\n  disabled,\n  participantColor,\n}: {\n  icon: AppIconName;\n  label: string;\n  detail: string;\n  onPress: () => void;\n  disabled?: boolean;\n  participantColor?: string;\n}) {\n  const theme = useAppTheme();\n  const identity = participantColor ? participantPalette(participantColor) : null;\n\n  return (\n    <Pressable\n      accessibilityRole=\"button\"\n      accessibilityLabel={`${label}. ${detail}`}\n      disabled={disabled}\n      onPress={onPress}\n      style={({ pressed }) => ({\n        flex: 1,\n        minWidth: '46%',\n        minHeight: 66,\n        borderRadius: theme.radii.md,\n        borderWidth: 1,\n        borderColor: identity?.border ?? theme.colors.border,\n        backgroundColor: pressed ? theme.colors.cardElevated : theme.colors.elevatedBackground,\n        paddingHorizontal: theme.spacing.md,\n        paddingVertical: 10,\n        gap: 7,\n        opacity: disabled ? 0.5 : pressed ? 0.74 : 1,\n      })}\n    >\n      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>\n        <AppIcon name={icon} size={18} color={identity?.accent ?? theme.colors.textSecondary} />\n        {identity ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: identity.accent }} /> : null}\n      </View>\n      <View style={{ gap: 1 }}>\n        <AppText variant=\"bodySmall\" style={{ fontWeight: '700' }} numberOfLines={1}>{label}</AppText>\n        <AppText variant=\"caption\" tone=\"muted\" numberOfLines={1}>{detail}</AppText>\n      </View>\n    </Pressable>\n  );\n}\n\n// G2_HOME_DECLUTTER: Home keeps only tiny immediate relationship signals; mood check-in is owned by Together.\nexport function HomeConnectionActions() {\n  const theme = useAppTheme();\n  const feedback = useInteractionFeedback();\n  const { profile, partnerProfile, partnerColor } = useWorkspace();\n  const [pingBusy, setPingBusy] = useState<'love' | 'thinking_of_you' | null>(null);\n  const [recentSignal, setRecentSignal] = useState<'love' | 'thinking_of_you' | null>(null);\n\n  if (!profile || !partnerProfile) return null;\n\n  async function sendPing(kind: 'love' | 'thinking_of_you') {\n    if (pingBusy) return;\n    feedback();\n    setPingBusy(kind);\n    try {\n      await createRelationshipPing(kind);\n      setRecentSignal(kind);\n      setTimeout(() => setRecentSignal((current) => current === kind ? null : current), 2400);\n    } catch (error) {\n      Alert.alert('Couldn’t send it', messageFrom(error));\n    } finally {\n      setPingBusy(null);\n    }\n  }\n\n  const partnerName = partnerProfile.display_name;\n\n  return (\n    <View style={{ gap: theme.spacing.sm }}>\n      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md }}>\n        <View style={{ gap: 2 }}>\n          <AppText variant=\"section\">Between you</AppText>\n          <AppText variant=\"bodySmall\" tone=\"muted\">A quick little signal, without turning Home into another menu.</AppText>\n        </View>\n        <ParticipantIdentityBadge userId={partnerProfile.id} compact />\n      </View>\n\n      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>\n        <QuickAction\n          icon=\"heart\"\n          label={recentSignal === 'love' ? 'Love sent ♥' : pingBusy === 'love' ? 'Sending…' : 'Love Tap'}\n          detail={`To ${partnerName}`}\n          participantColor={partnerColor}\n          disabled={Boolean(pingBusy)}\n          onPress={() => void sendPing('love')}\n        />\n        <QuickAction\n          icon=\"spark\"\n          label={recentSignal === 'thinking_of_you' ? 'Sent ✦' : pingBusy === 'thinking_of_you' ? 'Sending…' : 'Thinking of you'}\n          detail={`To ${partnerName}`}\n          participantColor={partnerColor}\n          disabled={Boolean(pingBusy)}\n          onPress={() => void sendPing('thinking_of_you')}\n        />\n      </View>\n    </View>\n  );\n}\n";
const homeQuickActionsSource = "import { useCallback, useEffect, useState } from 'react';\nimport { Pressable, View } from 'react-native';\nimport { router } from 'expo-router';\nimport { AppText } from '@/components/common/AppText';\nimport { AppIcon } from '@/components/art/AppIcon';\nimport { Card } from '@/components/common/Card';\nimport { getGames } from '@/services/backend/games';\nimport { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';\nimport { useAppTheme } from '@/theme/useAppTheme';\nimport type { GameSession } from '@/types/database';\n\n// G2_HOME_DECLUTTER: this legacy Home-layout slot is contextual now; it renders only when a shared game is already active.\nexport function HomeQuickActions() {\n  const theme = useAppTheme();\n  const [activeGame, setActiveGame] = useState<GameSession | null>(null);\n\n  const refresh = useCallback(async () => {\n    try {\n      setActiveGame((await getGames()).find((game) => game.status === 'active') ?? null);\n    } catch {\n      setActiveGame(null);\n    }\n  }, []);\n\n  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);\n  useRealtimeRefresh('games', refresh);\n\n  if (!activeGame) return null;\n\n  return (\n    <View style={{ gap: theme.spacing.sm }}>\n      <View style={{ gap: 2 }}>\n        <AppText variant=\"section\">In progress</AppText>\n        <AppText variant=\"bodySmall\" tone=\"muted\">Something you’re already doing together.</AppText>\n      </View>\n\n      <Pressable\n        accessibilityRole=\"button\"\n        accessibilityLabel={`Continue ${activeGame.title}. Your shared game is waiting.`}\n        onPress={() => router.push(`/features/games/${activeGame.id}` as never)}\n      >\n        {({ pressed }) => (\n          <Card participantColor=\"both\" style={{ padding: theme.spacing.md, opacity: pressed ? 0.78 : 1 }}>\n            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>\n              <View\n                style={{\n                  width: 40,\n                  height: 40,\n                  borderRadius: 13,\n                  alignItems: 'center',\n                  justifyContent: 'center',\n                  backgroundColor: theme.colors.elevatedBackground,\n                }}\n              >\n                <AppIcon name=\"game\" size={19} color={theme.colors.textSecondary} />\n              </View>\n              <View style={{ flex: 1, gap: 2 }}>\n                <AppText variant=\"cardTitle\" numberOfLines={1}>Continue {activeGame.title}</AppText>\n                <AppText variant=\"caption\" tone=\"muted\">Your shared game is waiting.</AppText>\n              </View>\n              <AppIcon name=\"chevron\" size={16} color={theme.colors.textMuted} />\n            </View>\n          </Card>\n        )}\n      </Pressable>\n    </View>\n  );\n}\n";
const todayRowBefore = "function Row({ icon, title, value, href, valueTone = 'primary', topBorder = false }: { icon: AppIconName; title: string; value: string; href: string; valueTone?: 'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'warning' | 'error'; topBorder?: boolean }) {\n  const theme = useAppTheme();\n  return (\n    <Pressable accessibilityRole=\"button\" accessibilityLabel={`${title}. ${value}`} onPress={() => router.push(href as never)} style={({ pressed }) => ({ minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: 10, borderTopWidth: topBorder ? 1 : 0, borderTopColor: theme.colors.border, opacity: pressed ? 0.7 : 1 })}>\n      <View style={{ width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.elevatedBackground }}><AppIcon name={icon} size={19} color={theme.colors.textSecondary} /></View>\n      <View style={{ flex: 1, gap: 2 }}><AppText variant=\"bodySmall\" tone=\"secondary\" style={{ fontWeight: '700' }}>{title}</AppText><AppText variant=\"bodySmall\" tone={valueTone} numberOfLines={2}>{value}</AppText></View>\n      <AppIcon name=\"chevron\" size={16} color={theme.colors.textMuted} />\n    </Pressable>\n  );\n}";
const todayRowAfter = "function StatusRow({ icon, title, value, valueTone = 'primary', topBorder = false }: { icon: AppIconName; title: string; value: string; valueTone?: 'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'warning' | 'error'; topBorder?: boolean }) {\n  const theme = useAppTheme();\n  return (\n    <View\n      accessible\n      accessibilityLabel={`${title}. ${value}`}\n      style={{ minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: 9, borderTopWidth: topBorder ? 1 : 0, borderTopColor: theme.colors.border }}\n    >\n      <View style={{ width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.elevatedBackground }}><AppIcon name={icon} size={18} color={theme.colors.textSecondary} /></View>\n      <View style={{ flex: 1, gap: 2 }}><AppText variant=\"bodySmall\" tone=\"secondary\" style={{ fontWeight: '700' }}>{title}</AppText><AppText variant=\"bodySmall\" tone={valueTone} numberOfLines={2}>{value}</AppText></View>\n    </View>\n  );\n}";
const longDistanceActionBefore = "function ActionRow({ icon, title, detail, onPress }: { icon: 'availability' | 'location'; title: string; detail: string; onPress: () => void }) {\n  const theme = useAppTheme();\n  return (\n    <Pressable accessibilityRole=\"button\" accessibilityLabel={`${title}. ${detail}`} onPress={onPress} style={({ pressed }) => ({ minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: 8, opacity: pressed ? 0.68 : 1 })}>\n      <View style={{ width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.elevatedBackground }}><AppIcon name={icon} size={18} color={theme.colors.accent} /></View>\n      <View style={{ flex: 1, gap: 2 }}><AppText variant=\"bodySmall\" style={{ fontWeight: '700' }}>{title}</AppText><AppText variant=\"caption\" tone=\"muted\" numberOfLines={2}>{detail}</AppText></View>\n      <AppIcon name=\"chevron\" size={15} color={theme.colors.textMuted} />\n    </Pressable>\n  );\n}";
const longDistanceActionAfter = "function StatusRow({ icon, title, detail }: { icon: 'availability' | 'location'; title: string; detail: string }) {\n  const theme = useAppTheme();\n  return (\n    <View accessible accessibilityLabel={`${title}. ${detail}`} style={{ minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: 8 }}>\n      <View style={{ width: 36, height: 36, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.elevatedBackground }}><AppIcon name={icon} size={17} color={theme.colors.accent} /></View>\n      <View style={{ flex: 1, gap: 2 }}><AppText variant=\"bodySmall\" style={{ fontWeight: '700' }}>{title}</AppText><AppText variant=\"caption\" tone=\"muted\" numberOfLines={2}>{detail}</AppText></View>\n    </View>\n  );\n}";
const longDistanceCountdownBefore = "      <Pressable accessibilityRole=\"button\" onPress={() => router.push('/features/countdowns' as never)}>\n        {({ pressed }) => (\n          <View style={{ borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.accentSoft, padding: theme.spacing.lg, gap: 4, opacity: pressed ? 0.78 : 1 }}>\n            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm }}>\n              <AppText variant=\"caption\" tone=\"secondary\">{countdown ? 'UNTIL YOU’RE TOGETHER' : 'NEXT TIME TOGETHER'}</AppText>\n              <AppIcon name=\"chevron\" size={15} color={theme.colors.textMuted} />\n            </View>\n            <AppText variant=\"pageTitle\">{remaining ? `${remaining.days} ${remaining.days === 1 ? 'day' : 'days'}` : 'Add a countdown'}</AppText>\n            <AppText variant=\"bodySmall\" tone=\"secondary\">{countdown?.title ?? 'Give your next visit something to count down to.'}</AppText>\n          </View>\n        )}\n      </Pressable>";
const longDistanceCountdownAfter = "      <View\n        accessible\n        accessibilityLabel={remaining ? `${remaining.days} ${remaining.days === 1 ? 'day' : 'days'} until ${countdown?.title ?? 'you are together'}` : 'No upcoming countdown'}\n        style={{ borderRadius: theme.radii.lg, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.accentSoft, padding: theme.spacing.md, gap: 3 }}\n      >\n        <AppText variant=\"caption\" tone=\"secondary\">{countdown ? 'UNTIL YOU’RE TOGETHER' : 'NEXT TIME TOGETHER'}</AppText>\n        <AppText variant=\"section\">{remaining ? `${remaining.days} ${remaining.days === 1 ? 'day' : 'days'}` : 'Nothing planned yet'}</AppText>\n        <AppText variant=\"bodySmall\" tone=\"secondary\">{countdown?.title ?? 'Your next shared countdown will appear here.'}</AppText>\n      </View>";
const longDistanceLocationBefore = "            <ActionRow\n              icon=\"location\"\n              title={separationKm != null && bothSharing ? `${separationKm.toLocaleString()} km apart` : 'Live location'}\n              detail={bothSharing ? 'Both of you are sharing your current location.' : 'One of you is sharing a live location.'}\n              onPress={() => router.push('/features/location' as never)}\n            />";
const longDistanceLocationAfter = "            <StatusRow\n              icon=\"location\"\n              title={separationKm != null && bothSharing ? `${separationKm.toLocaleString()} km apart` : 'Live location'}\n              detail={bothSharing ? 'Both of you are sharing your current location.' : 'One of you is sharing a live location.'}\n            />";

function fail(message) {
  console.error(`\n[G2] ${message}`);
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

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Could not find patch anchor: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Patch anchor is ambiguous: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
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
  ];
  const failures = [];
  for (const [relativePath, expectedMarker] of guards) {
    const source = read(relativePath).replace(/\r\n/g, '\n');
    if (!source.includes(expectedMarker)) failures.push(`${relativePath} missing ${expectedMarker}`);
  }
  if (failures.length) fail(`Completed-phase guard failed before any G2 write:\n- ${failures.join('\n- ')}`);
}

function patchHomeConnection(source) {
  if (source.includes(MARKER)) return source;
  if (!source.includes('const moodOptions:') || !source.includes('How I’m feeling') || !source.includes('createMood')) {
    throw new Error('HomeConnectionActions no longer matches the G1 baseline; refusing to overwrite unrelated work.');
  }
  return homeConnectionSource;
}

function patchHomeQuickActions(source) {
  if (source.includes(MARKER)) return source;
  if (!source.includes('const actions = useMemo(() => [') || !source.includes('Save a memory') || !source.includes('Pick a date')) {
    throw new Error('HomeQuickActions no longer matches the G1 baseline; refusing to overwrite unrelated work.');
  }
  return homeQuickActionsSource;
}

function patchHomeToday(source) {
  if (source.includes(MARKER)) return source;
  let next = replaceOnce(source, todayRowBefore, todayRowAfter, 'Home Today navigation row -> status row');
  next = replaceOnce(
    next,
    "export function HomeTodayCard() {\n",
    `// ${MARKER}: routine Home rows are glanceable status; only genuinely important moments remain actionable.\nexport function HomeTodayCard() {\n`,
    'Home Today G2 marker',
  );
  next = replaceOnce(
    next,
    "  const regularRows: Array<{ icon: AppIconName; title: string; value: string; href: string; tone?: 'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'warning' | 'error' }> = [\n    { icon: 'calendar', title: 'Calendar', value: formatEvent(event), href: '/features/calendar' },\n    { icon: 'task', title: 'Tasks', value: taskSummary.text, href: '/features/tasks', tone: taskSummary.tone },\n",
    "  const regularRows: Array<{ icon: AppIconName; title: string; value: string; tone?: 'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'warning' | 'error' }> = [\n    { icon: 'calendar', title: 'Calendar', value: formatEvent(event) },\n    { icon: 'task', title: 'Tasks', value: taskSummary.text, tone: taskSummary.tone },\n",
    'Home Today status row type and core summaries',
  );
  next = replaceOnce(
    next,
    "    regularRows.push({ icon: 'question', title: 'Daily question', value: questionSummary, href: '/features/daily-question' });\n    regularRows.push({ icon: 'mood', title: 'How we are', value: moodSummary, href: '/features/mood' });\n",
    "    regularRows.push({ icon: 'question', title: 'Daily question', value: questionSummary });\n    regularRows.push({ icon: 'mood', title: 'How we are', value: moodSummary });\n",
    'Home Today question and mood status summaries',
  );
  next = replaceOnce(
    next,
    "    regularRows.push({ icon: 'mood', title: 'How we are', value: moodSummary, href: '/features/mood' });\n",
    "    regularRows.push({ icon: 'mood', title: 'How we are', value: moodSummary });\n",
    'Home Today priority mood status summary',
  );
  next = replaceOnce(
    next,
    "{regularRows.map((row, index) => <Row key={row.title} icon={row.icon} title={row.title} value={row.value} href={row.href} valueTone={row.tone} topBorder={index > 0} />)}",
    "{regularRows.map((row, index) => <StatusRow key={row.title} icon={row.icon} title={row.title} value={row.value} valueTone={row.tone} topBorder={index > 0} />)}",
    'Home Today status row render',
  );
  return next;
}

function patchLongDistance(source) {
  if (source.includes(MARKER)) return source;
  let next = replaceOnce(source, "import { Pressable, View } from 'react-native';\nimport { router } from 'expo-router';\n", "import { View } from 'react-native';\n", 'Long-distance navigation imports');
  next = replaceOnce(next, longDistanceActionBefore, longDistanceActionAfter, 'Long-distance action rows -> status rows');
  next = replaceOnce(
    next,
    "export function LongDistanceOverviewCard() {\n",
    `// ${MARKER}: long-distance Home content reports useful shared context instead of acting as a second feature directory.\nexport function LongDistanceOverviewCard() {\n`,
    'Long-distance G2 marker',
  );
  next = replaceOnce(next, longDistanceCountdownBefore, longDistanceCountdownAfter, 'Long-distance countdown status');
  next = replaceOnce(
    next,
    '        <ActionRow icon="availability" title="Next free together" detail={overlapDetail} onPress={() => router.push(\'/features/availability\' as never)} />',
    '        <StatusRow icon="availability" title="Next free together" detail={overlapDetail} />',
    'Long-distance availability status',
  );
  next = replaceOnce(next, longDistanceLocationBefore, longDistanceLocationAfter, 'Long-distance location status');
  return next;
}

function patchHomeLayout(source) {
  if (source.includes(MARKER)) return source;
  let next = replaceOnce(
    source,
    "const labels: Record<HomeCardKey, { title: string; body: string }> = {\n",
    `// ${MARKER}: Home layout labels describe status widgets, not duplicate feature launchers.\nconst labels: Record<HomeCardKey, { title: string; body: string }> = {\n`,
    'Home layout G2 marker',
  );
  next = replaceOnce(
    next,
    "  today: { title: 'Today', body: 'Events, tasks, question and check-in.' },\n",
    "  today: { title: 'Today', body: 'Events, tasks, question and mood status.' },\n",
    'Home layout Today description',
  );
  next = replaceOnce(
    next,
    "  quickActions: { title: 'Quick actions', body: 'Play, Date ideas, Tasks and Memories.' },\n",
    "  quickActions: { title: 'Active game', body: 'Appears only when a shared game is already in progress.' },\n",
    'Home layout active game description',
  );
  return next;
}

function audit() {
  const connection = read('src/components/dashboard/HomeConnectionActions.tsx').replace(/\r\n/g, '\n');
  const quick = read('src/components/dashboard/HomeQuickActions.tsx').replace(/\r\n/g, '\n');
  const today = read('src/components/dashboard/HomeTodayCard.tsx').replace(/\r\n/g, '\n');
  const distance = read('src/components/dashboard/LongDistanceOverviewCard.tsx').replace(/\r\n/g, '\n');
  const layout = read('src/app/features/home-layout.tsx').replace(/\r\n/g, '\n');
  const failures = [];

  for (const [label, source] of [['HomeConnectionActions', connection], ['HomeQuickActions', quick], ['HomeTodayCard', today], ['LongDistanceOverviewCard', distance], ['HomeLayout', layout]]) {
    if (!source.includes(MARKER)) failures.push(`${label} G2 marker missing`);
  }
  if (connection.includes('How I’m feeling') || connection.includes('createMood') || connection.includes('moodOpen')) failures.push('Generic Home mood composer still present');
  if (!connection.includes('Love Tap') || !connection.includes('Thinking of you')) failures.push('Immediate relationship actions missing');
  if (quick.includes('Pick a date') || quick.includes('Save a memory') || quick.includes("'/features/play-together'")) failures.push('Generic Home quick-action launchers still present');
  if (!quick.includes('if (!activeGame) return null;')) failures.push('Active-game contextual gating missing');
  if (today.includes('href={row.href}') || today.includes('<Row key={row.title}')) failures.push('Routine Today rows remain navigational');
  if (!today.includes('function StatusRow(')) failures.push('Home Today status-row primitive missing');
  if (distance.includes("router.push('/features/countdowns'") || distance.includes("router.push('/features/availability'") || distance.includes("router.push('/features/location'")) failures.push('Long-distance Home card remains a feature launcher');
  if (!layout.includes("quickActions: { title: 'Active game'")) failures.push('Home layout still describes generic quick actions');
  if (failures.length) fail(`Source audit failed:\n- ${failures.join('\n- ')}`);
}

function runNpm(args, label) {
  console.log(`\n[G2] ${label}`);
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
console.log(`[G2] Project root: ${root}`);

if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'server', 'package.json'))) {
  fail('Run this installer from the Togetherly project root.');
}

guardCompletedPhases();

const files = [
  ['src/components/dashboard/HomeConnectionActions.tsx', patchHomeConnection],
  ['src/components/dashboard/HomeQuickActions.tsx', patchHomeQuickActions],
  ['src/components/dashboard/HomeTodayCard.tsx', patchHomeToday],
  ['src/components/dashboard/LongDistanceOverviewCard.tsx', patchLongDistance],
  ['src/app/features/home-layout.tsx', patchHomeLayout],
];

const pending = [];
try {
  for (const [relativePath, patch] of files) {
    const { source, eol } = sourceWithEol(relativePath);
    pending.push({ relativePath, eol, output: patch(source) });
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

for (const item of pending) {
  fs.writeFileSync(path.join(root, item.relativePath), restoreEol(item.output, item.eol), 'utf8');
  console.log(`[G2] ${item.relativePath}: ready`);
}

console.log('\n[G2] Source audit');
audit();
console.log('[G2] Source audit passed.');

if (process.env.TOGETHERLY_INSTALLER_SELF_TEST !== '1') {
  runNpm(['run', 'typecheck'], 'Client typecheck');
  runNpm(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
  runNpm(['--prefix', 'server', 'run', 'logic'], 'Server logic');
}

console.log('\n[G2] ALL VALIDATIONS PASSED');
console.log('[G2] No migration or dependency changes. Do not run expo lint for this release.');
