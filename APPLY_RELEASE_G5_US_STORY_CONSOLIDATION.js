const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RELEASE = 'G5 — Us / Story Consolidation';
const MARKER = 'G5_US_STORY_CONSOLIDATION';
const root = process.cwd();

const storyDashboardSource = "import { useCallback, useEffect, useMemo, useState } from 'react';\nimport { Pressable, View } from 'react-native';\nimport { router } from 'expo-router';\nimport { AppIcon, type AppIconName } from '@/components/art/AppIcon';\nimport { AppText } from '@/components/common/AppText';\nimport { Card } from '@/components/common/Card';\nimport { ExpandableFeatureGroup, type ExpandableFeatureGroupItem } from '@/components/navigation/ExpandableFeatureGroup';\nimport { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';\nimport { getMemories, getMemoryAlbums, getTimeline } from '@/services/backend/mvpFeatures';\nimport { useAppTheme } from '@/theme/useAppTheme';\nimport type { CoupleMemory, MemoryAlbum } from '@/types/database';\n\ntype TimelineSummary = {\n  couple: {\n    relationship_start_date: string | null;\n    anniversary_date: string | null;\n  } | null;\n  milestones: CoupleMemory[];\n};\n\nfunction relationshipAge(startDate: string | null | undefined) {\n  if (!startDate) return null;\n  const start = new Date(`${startDate}T12:00:00`).getTime();\n  if (!Number.isFinite(start)) return null;\n\n  const days = Math.max(1, Math.floor((Date.now() - start) / 86_400_000) + 1);\n  if (days < 60) return `${days} days`;\n\n  const months = Math.floor(days / 30.4375);\n  if (months < 24) return `${months} months`;\n\n  const years = Math.floor(months / 12);\n  const remainder = months % 12;\n  return remainder ? `${years}y ${remainder}m` : `${years} years`;\n}\n\nfunction relativeMemoryDate(dateKey: string | undefined) {\n  if (!dateKey) return null;\n  const target = new Date(`${dateKey}T12:00:00`).getTime();\n  if (!Number.isFinite(target)) return null;\n\n  const now = new Date();\n  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12).getTime();\n  const days = Math.round((today - target) / 86_400_000);\n\n  if (days <= 0) return 'today';\n  if (days === 1) return 'yesterday';\n  if (days < 7) return `${days}d ago`;\n  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(target));\n}\n\nfunction sameMonthAndDay(date: string, now = new Date()) {\n  const parts = date.split('-');\n  return parts.length === 3\n    && Number(parts[1]) === now.getMonth() + 1\n    && Number(parts[2]) === now.getDate()\n    && Number(parts[0]) < now.getFullYear();\n}\n\nfunction StorySummaryCard({\n  icon,\n  title,\n  summary,\n  status,\n  href,\n}: {\n  icon: AppIconName;\n  title: string;\n  summary: string;\n  status?: string;\n  href: string;\n}) {\n  const theme = useAppTheme();\n\n  return (\n    <Pressable\n      accessibilityRole=\"button\"\n      accessibilityLabel={`${title}. ${summary}${status ? `. ${status}` : ''}`}\n      onPress={() => router.push(href as never)}\n    >\n      {({ pressed }) => (\n        <Card participantColor=\"both\" style={{ padding: theme.spacing.lg, opacity: pressed ? 0.78 : 1 }}>\n          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>\n            <View\n              style={{\n                width: 42,\n                height: 42,\n                borderRadius: 14,\n                alignItems: 'center',\n                justifyContent: 'center',\n                backgroundColor: theme.colors.elevatedBackground,\n              }}\n            >\n              <AppIcon name={icon} size={20} color={theme.colors.accent} />\n            </View>\n\n            <View style={{ flex: 1, gap: 3 }}>\n              <AppText variant=\"section\">{title}</AppText>\n              <AppText variant=\"bodySmall\" tone=\"secondary\" numberOfLines={2}>{summary}</AppText>\n            </View>\n\n            {status ? <AppText variant=\"caption\" tone=\"muted\" numberOfLines={1}>{status}</AppText> : null}\n            <AppIcon name=\"chevron\" size={16} color={theme.colors.textMuted} />\n          </View>\n        </Card>\n      )}\n    </Pressable>\n  );\n}\n\n// G5_US_STORY_CONSOLIDATION: Us owns the relationship-story navigation layer; Memories itself stays focused on memory entries.\nexport function UsStoryDashboard() {\n  const [memories, setMemories] = useState<CoupleMemory[]>([]);\n  const [albums, setAlbums] = useState<MemoryAlbum[]>([]);\n  const [timeline, setTimeline] = useState<TimelineSummary | null>(null);\n\n  const refresh = useCallback(async () => {\n    const [memoryResult, albumResult, timelineResult] = await Promise.allSettled([\n      getMemories(),\n      getMemoryAlbums(),\n      getTimeline(),\n    ]);\n\n    if (memoryResult.status === 'fulfilled') setMemories(memoryResult.value);\n    if (albumResult.status === 'fulfilled') setAlbums(albumResult.value);\n    if (timelineResult.status === 'fulfilled') setTimeline(timelineResult.value);\n  }, []);\n\n  useEffect(() => {\n    refresh().catch(() => undefined);\n  }, [refresh]);\n\n  useRealtimeRefresh('memories', refresh);\n\n  const sortedMemories = useMemo(\n    () => [...memories].sort((a, b) => b.memory_date.localeCompare(a.memory_date)),\n    [memories],\n  );\n  const latest = sortedMemories[0] ?? null;\n  const onThisDay = useMemo(\n    () => sortedMemories.find((memory) => sameMonthAndDay(memory.memory_date)) ?? null,\n    [sortedMemories],\n  );\n  const photoCount = useMemo(\n    () => memories.reduce(\n      (total, memory) => total + ((memory.photos?.length ?? 0) || (memory.photo_url ? 1 : 0)),\n      0,\n    ),\n    [memories],\n  );\n  const milestoneCount = timeline?.milestones.length ?? memories.filter((memory) => memory.is_milestone).length;\n  const age = relationshipAge(timeline?.couple?.relationship_start_date);\n\n  const rediscoverItems = useMemo<ExpandableFeatureGroupItem[]>(() => {\n    const items: ExpandableFeatureGroupItem[] = [];\n\n    if (onThisDay) {\n      items.push({\n        key: 'on-this-day',\n        icon: 'timeline',\n        title: 'On this day',\n        subtitle: `${onThisDay.emoji} ${onThisDay.title} · ${onThisDay.memory_date.slice(0, 4)}`,\n        href: `/features/memories?focus=${encodeURIComponent(onThisDay.id)}`,\n      });\n    }\n\n    items.push({\n      key: 'memory-jar',\n      icon: 'jar',\n      title: 'Memory Jar',\n      subtitle: 'Bring back a random saved moment',\n      href: '/features/memory-jar',\n    });\n\n    return items;\n  }, [onThisDay]);\n\n  const memorySummary = memories.length\n    ? `${memories.length} ${memories.length === 1 ? 'memory' : 'memories'} · latest ${relativeMemoryDate(latest?.memory_date) ?? 'saved'}`\n    : 'No memories yet · start with one moment';\n\n  const photoSummary = `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'} · ${albums.length} ${albums.length === 1 ? 'album' : 'albums'}`;\n  const timelineSummary = `${milestoneCount} ${milestoneCount === 1 ? 'milestone' : 'milestones'}${age ? ` · ${age} together` : ''}`;\n  const rediscoverSummary = onThisDay\n    ? `On this day: ${onThisDay.title} · Memory Jar`\n    : memories.length\n      ? 'Memory Jar · On This Day when a date comes around'\n      : 'Rediscovery tools will grow with your story';\n\n  return (\n    <View style={{ gap: 12 }}>\n      <StorySummaryCard\n        icon=\"memory\"\n        title=\"Memories\"\n        summary={memorySummary}\n        status={memories.length ? String(memories.length) : undefined}\n        href=\"/features/memories\"\n      />\n\n      <StorySummaryCard\n        icon=\"photo\"\n        title=\"Photos\"\n        summary={photoSummary}\n        status={photoCount ? String(photoCount) : undefined}\n        href=\"/features/photos\"\n      />\n\n      <StorySummaryCard\n        icon=\"timeline\"\n        title=\"Timeline\"\n        summary={timelineSummary}\n        status={milestoneCount ? String(milestoneCount) : undefined}\n        href=\"/features/timeline\"\n      />\n\n      <ExpandableFeatureGroup\n        eyebrow=\"REDISCOVER\"\n        icon=\"jar\"\n        title=\"Rediscover\"\n        summary={rediscoverSummary}\n        items={rediscoverItems}\n        participantColor=\"both\"\n      />\n    </View>\n  );\n}\n";
const usScreenSource = "import { View } from 'react-native';\nimport { AppScreen } from '@/components/common/AppScreen';\nimport { PageHeader } from '@/components/common/PageHeader';\nimport { CoupleIdentitySignature } from '@/components/common/CoupleIdentitySignature';\nimport { UsStoryDashboard } from '@/components/us/UsStoryDashboard';\nimport { useAppTheme } from '@/theme/useAppTheme';\n\n// G5_US_STORY_CONSOLIDATION: Us is the single relationship-story dashboard for Memories, Photos, Timeline and rediscovery.\nexport default function UsScreen() {\n  const theme = useAppTheme();\n\n  return (\n    <AppScreen>\n      <PageHeader eyebrow=\"Our story\" title=\"Us\" subtitle=\"The part of Togetherly that becomes more yours over time.\" />\n\n      <View style={{ gap: theme.spacing.xl }}>\n        {/* E3_PAIRED_COUPLE_IDENTITY */}\n        <CoupleIdentitySignature detail=\"Your shared story belongs to both of you.\" />\n        <UsStoryDashboard />\n      </View>\n    </AppScreen>\n  );\n}\n";

function fail(message) {
  console.error(`\n[G5] ${message}`);
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
    ['src/components/dashboard/HomeConnectionActions.tsx', 'G2_HOME_DECLUTTER'],
    ['src/components/dashboard/HomeQuickActions.tsx', 'G2_HOME_DECLUTTER'],
    ['src/components/dashboard/HomeTodayCard.tsx', 'G2_HOME_DECLUTTER'],
    ['src/components/dashboard/LongDistanceOverviewCard.tsx', 'G2_HOME_DECLUTTER'],
    ['src/app/features/home-layout.tsx', 'G2_HOME_DECLUTTER'],
    ['src/app/(tabs)/together.tsx', 'G3_TOGETHER_CONSOLIDATION'],
    ['src/components/dashboard/HomeConnectionActions.tsx', 'G3_TOGETHER_CONSOLIDATION'],
    ['src/components/together/TogetherHubGroups.tsx', 'G3_TOGETHER_CONSOLIDATION'],
    ['src/app/(tabs)/plan.tsx', 'G4_PLAN_EXPANDABLE_GROUPS'],
    ['src/components/plan/PlanHubGroups.tsx', 'G4_PLAN_EXPANDABLE_GROUPS'],
  ];

  const failures = [];
  for (const [relativePath, expectedMarker] of guards) {
    const source = read(relativePath).replace(/\r\n/g, '\n');
    if (!source.includes(expectedMarker)) failures.push(`${relativePath} missing ${expectedMarker}`);
  }

  if (failures.length) fail(`Completed-phase guard failed before any G5 write:\n- ${failures.join('\n- ')}`);
}

function prepareUsScreen() {
  const { source, eol } = sourceWithEol('src/app/(tabs)/us.tsx');
  if (source.includes(MARKER)) return { relativePath: 'src/app/(tabs)/us.tsx', output: source, eol, write: false };

  const required = [
    'MemoryConstellationArt',
    '<RecentMemoryCard />',
    'Explore your story',
    'title="Timeline"',
    'title="Memory jar"',
    'title="Photos & albums"',
    'CoupleIdentitySignature',
  ];

  for (const token of required) {
    if (!source.includes(token)) throw new Error(`Us screen baseline changed; missing ${token}. Refusing broad overwrite.`);
  }

  return { relativePath: 'src/app/(tabs)/us.tsx', output: usScreenSource, eol, write: true };
}

function prepareStoryDashboard(preferredEol) {
  const relativePath = 'src/components/us/UsStoryDashboard.tsx';
  const fullPath = path.join(root, relativePath);

  if (!fs.existsSync(fullPath)) {
    return { relativePath, output: storyDashboardSource, eol: preferredEol, write: true };
  }

  const raw = fs.readFileSync(fullPath, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const source = raw.replace(/\r\n/g, '\n');

  if (!source.includes(MARKER)) {
    throw new Error(`${relativePath} already exists without the G5 marker; refusing to overwrite unrelated work.`);
  }

  return { relativePath, output: source, eol, write: false };
}

function prepareMemoriesScreen() {
  const { source, eol } = sourceWithEol('src/app/features/memories.tsx');
  if (source.includes(MARKER)) return { relativePath: 'src/app/features/memories.tsx', output: source, eol, write: false };

  let next = source;

  next = replaceOnce(
    next,
    "import { FeatureGroupCard } from '@/components/navigation/FeatureGroupCard';\n",
    '',
    'Memories FeatureGroupCard import',
  );

  next = replaceOnce(
    next,
    "const storyViews = [\n  { icon: 'photo', title: 'Photos', subtitle: 'All photos and albums', href: '/features/photos' },\n  { icon: 'timeline', title: 'Timeline', subtitle: 'See relationship milestones in order', href: '/features/timeline' },\n  { icon: 'jar', title: 'Memory Jar', subtitle: 'Bring back a random saved moment', href: '/features/memory-jar' },\n] as const;\n\n",
    '',
    'Memories duplicate story navigation data',
  );

  next = replaceOnce(
    next,
    'export default function MemoriesScreen() {\n',
    `// ${MARKER}: Memories focuses on memory entries; Us owns Photos, Timeline and rediscovery navigation.\nexport default function MemoriesScreen() {\n`,
    'Memories G5 marker',
  );

  next = replaceOnce(
    next,
    '    <BackHeader eyebrow="Us" title="Memories" subtitle="A photo-led record of the moments you want to keep." />\n    <View style={{ marginBottom: theme.spacing.lg }}><FeatureGroupCard eyebrow="BROWSE" title="Our story" items={storyViews} /></View>\n',
    '    <BackHeader eyebrow="Us" title="Memories" subtitle="The moments you chose to keep, all in one place." />\n',
    'Memories duplicate story-navigation block',
  );

  return { relativePath: 'src/app/features/memories.tsx', output: next, eol, write: true };
}

function audit() {
  const us = read('src/app/(tabs)/us.tsx').replace(/\r\n/g, '\n');
  const dashboard = read('src/components/us/UsStoryDashboard.tsx').replace(/\r\n/g, '\n');
  const memories = read('src/app/features/memories.tsx').replace(/\r\n/g, '\n');
  const failures = [];

  if (!us.includes(MARKER)) failures.push('Us screen G5 marker missing');
  if (!us.includes('<UsStoryDashboard />')) failures.push('UsStoryDashboard not mounted');
  if (us.includes('MemoryConstellationArt') || us.includes('<RecentMemoryCard />') || us.includes('Explore your story')) {
    failures.push('Legacy oversized Us story sections still present');
  }

  if (!dashboard.includes(MARKER)) failures.push('UsStoryDashboard G5 marker missing');
  if (!dashboard.includes('title="Memories"')) failures.push('Memories summary missing');
  if (!dashboard.includes('title="Photos"')) failures.push('Photos summary missing');
  if (!dashboard.includes('title="Timeline"')) failures.push('Timeline summary missing');
  if (!dashboard.includes('title="Rediscover"')) failures.push('Rediscover summary missing');
  if (!dashboard.includes('href="/features/memories"')) failures.push('Memories canonical route missing');
  if (!dashboard.includes('href="/features/photos"')) failures.push('Photos canonical route missing');
  if (!dashboard.includes('href="/features/timeline"')) failures.push('Timeline canonical route missing');
  if (!dashboard.includes("href: '/features/memory-jar'")) failures.push('Memory Jar rediscovery route missing');

  if (!memories.includes(MARKER)) failures.push('Memories screen G5 marker missing');
  if (memories.includes('storyViews') || memories.includes('FeatureGroupCard') || memories.includes('title="Our story"')) {
    failures.push('Memories still repeats story navigation owned by Us');
  }
  if (!memories.includes('<CollapsibleComposer')) failures.push('Memories creation flow was unexpectedly removed');
  if (!memories.includes('<MemoryDetailModal')) failures.push('Memories detail flow was unexpectedly removed');

  if (!read('src/components/navigation/ExpandableFeatureGroup.tsx').includes('G1_UI_HIERARCHY_EXPANDABLE_HUB_FOUNDATION')) failures.push('G1 expandable primitive marker missing');
  if (!read('src/components/plan/PlanHubGroups.tsx').includes('G4_PLAN_EXPANDABLE_GROUPS')) failures.push('G4 Plan marker missing');

  if (failures.length) fail(`Source audit failed:\n- ${failures.join('\n- ')}`);
}

function runNpm(args, label) {
  console.log(`\n[G5] ${label}`);
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
console.log(`[G5] Project root: ${root}`);

if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'server', 'package.json'))) {
  fail('Run this installer from the Togetherly project root.');
}

guardCompletedPhases();

let pending;
try {
  const us = prepareUsScreen();
  const dashboard = prepareStoryDashboard(us.eol);
  const memories = prepareMemoriesScreen();
  pending = [us, dashboard, memories];
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

// All modified outputs are prepared before any source write.
for (const item of pending) {
  if (!item.write) {
    console.log(`[G5] ${item.relativePath}: already ready`);
    continue;
  }

  const fullPath = path.join(root, item.relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, restoreEol(item.output, item.eol), 'utf8');
  console.log(`[G5] ${item.relativePath}: ready`);
}

console.log('\n[G5] Source audit');
audit();
console.log('[G5] Source audit passed.');

if (process.env.TOGETHERLY_INSTALLER_SELF_TEST !== '1') {
  runNpm(['run', 'typecheck'], 'Client typecheck');
  runNpm(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
  runNpm(['--prefix', 'server', 'run', 'logic'], 'Server logic');
}

console.log('\n[G5] ALL VALIDATIONS PASSED');
console.log('[G5] No migration or dependency changes. Do not run expo lint for this release.');
