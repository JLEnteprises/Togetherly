const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();

function fail(message) {
  console.error(`\nD15 Lighter Navigation FAILED: ${message}`);
  process.exit(1);
}

function full(rel) {
  return path.join(root, ...rel.split('/'));
}

function read(rel) {
  const file = full(rel);
  if (!fs.existsSync(file)) fail(`Missing ${rel}. Run this from the Togetherly project root.`);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

function write(rel, source) {
  fs.writeFileSync(full(rel), source.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`Wrote ${rel}`);
}

function replaceOnce(source, oldText, newText, label) {
  if (source.includes(newText)) {
    console.log(`Already good: ${label}`);
    return source;
  }
  const first = source.indexOf(oldText);
  if (first < 0) fail(`Could not find expected source for: ${label}`);
  if (source.indexOf(oldText, first + oldText.length) >= 0) fail(`Multiple matches found for: ${label}`);
  return source.slice(0, first) + newText + source.slice(first + oldText.length);
}

// -----------------------------------------------------------------------------
// Shared navigation group: accent groups remain cards; secondary groups flatten.
// -----------------------------------------------------------------------------

{
  const rel = 'src/components/navigation/FeatureGroupCard.tsx';
  let source = read(rel);

  const baseline = [
    "export function FeatureGroupCard({ eyebrow, title, subtitle, items, accent = false }: Props)",
    "<Card tone={accent ? 'accent' : 'default'}",
    "borderTopWidth: index === 0 ? 0 : 1",
  ];
  for (const marker of baseline) {
    if (!source.includes(marker)) fail(`Unexpected FeatureGroupCard baseline; missing "${marker}".`);
  }

  const replacement = `import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { useAppTheme } from '@/theme/useAppTheme';
import { AppIcon, isAppIconName } from '@/components/art/AppIcon';

type FeatureGroupItem = {
  icon: string;
  title: string;
  subtitle: string;
  href: string;
};

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  items: readonly FeatureGroupItem[];
  accent?: boolean;
};

export function FeatureGroupCard({ eyebrow, title, subtitle, items, accent = false }: Props) {
  const theme = useAppTheme();

  const content = (
    <>
      <View style={{ gap: 4, paddingHorizontal: accent ? 0 : 2 }}>
        {eyebrow ? (
          <AppText variant="caption" tone={accent ? 'accent' : 'secondary'}>{eyebrow}</AppText>
        ) : null}
        <AppText variant="section">{title}</AppText>
        {subtitle ? <AppText variant="bodySmall" tone="secondary">{subtitle}</AppText> : null}
      </View>

      <View
        style={{
          marginTop: accent ? 0 : theme.spacing.xs,
          borderTopWidth: accent ? 0 : 1,
          borderBottomWidth: accent ? 0 : 1,
          borderColor: theme.colors.border,
        }}
      >
        {items.map((item, index) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            accessibilityLabel={\`\${item.title}. \${item.subtitle}\`}
            onPress={() => router.push(item.href as never)}
            style={({ pressed }) => ({
              minHeight: accent ? 58 : 56,
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.md,
              paddingHorizontal: accent ? 0 : 2,
              paddingVertical: accent ? 10 : 11,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: theme.colors.border,
              backgroundColor: pressed && !accent ? theme.colors.elevatedBackground : 'transparent',
              borderRadius: pressed && !accent ? theme.radii.sm : 0,
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <View
              style={{
                width: accent ? 36 : 32,
                height: accent ? 36 : 32,
                borderRadius: accent ? 12 : 11,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: accent ? theme.colors.elevatedBackground : theme.colors.accentSoft,
              }}
            >
              {isAppIconName(item.icon)
                ? <AppIcon name={item.icon} size={accent ? 19 : 17} color={accent ? theme.colors.accent : theme.colors.textSecondary} />
                : <AppText variant="cardTitle" tone={accent ? 'accent' : 'secondary'}>{item.icon}</AppText>}
            </View>

            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant={accent ? 'cardTitle' : 'body'} style={{ fontWeight: '700' }}>{item.title}</AppText>
              <AppText variant="caption" tone="muted">{item.subtitle}</AppText>
            </View>

            <AppIcon name="chevron" size={16} color={theme.colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </>
  );

  if (accent) {
    return (
      <Card tone="accent" style={{ gap: theme.spacing.md }}>
        {content}
      </Card>
    );
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {content}
    </View>
  );
}
`;

  source = replacement;
  write(rel, source);
}

// -----------------------------------------------------------------------------
// Plan: warmer, less administrative labels to match the lighter hierarchy.
// -----------------------------------------------------------------------------

{
  const rel = 'src/app/(tabs)/plan.tsx';
  let source = read(rel);

  const baseline = [
    'title="Plan"',
    'title="Organise"',
    'title="Dates & time"',
    'title="Bigger plans"',
  ];
  for (const marker of baseline) {
    if (!source.includes(marker)) fail(`Unexpected Plan baseline; missing "${marker}".`);
  }

  source = replaceOnce(
    source,
    '<PageHeader eyebrow="Shared life" title="Plan" />',
    '<PageHeader eyebrow="Shared life" title="Plan" subtitle="The practical bits of life you’re building together." />',
    'Plan header copy',
  );

  source = replaceOnce(
    source,
    '<FeatureGroupCard eyebrow="EVERYDAY" title="Organise" items={organise} accent />',
    '<FeatureGroupCard eyebrow="EVERYDAY" title="Day to day" subtitle="Keep the little things from living in your heads." items={organise} accent />',
    'Plan day-to-day group copy',
  );

  source = replaceOnce(
    source,
    '<FeatureGroupCard eyebrow="WHEN" title="Dates & time" items={dates} />',
    '<FeatureGroupCard eyebrow="WHEN" title="Dates worth keeping" subtitle="What’s happening, what’s coming, and when you’re both free." items={dates} />',
    'Plan dates group copy',
  );

  source = replaceOnce(
    source,
    '<FeatureGroupCard eyebrow="LOOKING AHEAD" title="Bigger plans" items={biggerPlans} />',
    '<FeatureGroupCard eyebrow="LOOKING AHEAD" title="Things you’re building toward" subtitle="Trips, goals and the bigger stuff ahead." items={biggerPlans} />',
    'Plan bigger plans copy',
  );

  source = replaceOnce(
    source,
    "{ icon: 'task', title: 'Tasks', subtitle: 'Assignments, deadlines and checklists', href: '/features/tasks' },",
    "{ icon: 'task', title: 'Tasks', subtitle: 'What needs doing, without the mental load', href: '/features/tasks' },",
    'Tasks conversational subtitle',
  );

  source = replaceOnce(
    source,
    "{ icon: 'availability', title: 'Availability', subtitle: 'Schedules and shared free time', href: '/features/availability' },",
    "{ icon: 'availability', title: 'When are we both free?', subtitle: 'Find the overlap without comparing calendars by hand', href: '/features/availability' },",
    'Availability conversational label',
  );

  source = replaceOnce(
    source,
    "{ icon: 'trip', title: 'Trips', subtitle: 'Travel plans and linked details', href: '/features/trips' },",
    "{ icon: 'trip', title: 'Trips', subtitle: 'Everything for the next time you’re going somewhere together', href: '/features/trips' },",
    'Trips conversational subtitle',
  );

  write(rel, source);
}

// -----------------------------------------------------------------------------
// Together: secondary destinations become lighter rows with warmer language.
// -----------------------------------------------------------------------------

{
  const rel = 'src/app/(tabs)/together.tsx';
  let source = read(rel);

  const baseline = [
    'title="Together"',
    'title="Check in"',
    'title="Date ideas"',
  ];
  for (const marker of baseline) {
    if (!source.includes(marker)) fail(`Unexpected Together baseline; missing "${marker}".`);
  }

  source = replaceOnce(
    source,
    '<FeatureGroupCard eyebrow="CONNECT" title="Check in" subtitle="The things that help you understand each other today." items={connect} />',
    '<FeatureGroupCard eyebrow="CONNECT" title="How are we?" subtitle="Small ways to understand each other today." items={connect} />',
    'Together check-in group copy',
  );

  source = replaceOnce(
    source,
    '<FeatureGroupCard eyebrow="MAKE A PLAN" title="Date ideas" items={dateIdeas} />',
    '<FeatureGroupCard eyebrow="WHEN YOU WANT SOMETHING TO DO" title="Pick a little moment together" items={dateIdeas} />',
    'Together date ideas group copy',
  );

  source = replaceOnce(
    source,
    "{ icon: 'question', title: 'Daily question', subtitle: 'Answer separately, reveal together', href: '/features/daily-question' },",
    "{ icon: 'question', title: 'Today’s question', subtitle: 'Answer separately, then open it together', href: '/features/daily-question' },",
    'Daily question conversational label',
  );

  source = replaceOnce(
    source,
    "{ icon: 'mood', title: 'Mood check-in', subtitle: 'Share how you feel and what you need', href: '/features/mood' },",
    "{ icon: 'mood', title: 'How are you feeling?', subtitle: 'Share your mood and what you need', href: '/features/mood' },",
    'Mood conversational label',
  );

  write(rel, source);
}

// -----------------------------------------------------------------------------
// More: management stays useful but visually subordinate.
// -----------------------------------------------------------------------------

{
  const rel = 'src/app/(tabs)/more.tsx';
  let source = read(rel);

  const baseline = [
    '<FeatureGroupCard title="Manage" items={manage} />',
    'title="More"',
  ];
  for (const marker of baseline) {
    if (!source.includes(marker)) fail(`Unexpected More baseline; missing "${marker}".`);
  }

  source = replaceOnce(
    source,
    '<PageHeader eyebrow="Your space" title="More" />',
    '<PageHeader eyebrow="Your space" title="More" subtitle="The quieter settings and tools behind your shared space." />',
    'More header copy',
  );

  source = replaceOnce(
    source,
    '<FeatureGroupCard title="Manage" items={manage} />',
    '<FeatureGroupCard eyebrow="YOUR SPACE" title="Behind the scenes" subtitle="Things you probably won’t need every day." items={manage} />',
    'More management group copy',
  );

  source = replaceOnce(
    source,
    "{ icon: 'heart', title: 'Couple profile', subtitle: 'Relationship details and linked accounts', href: '/features/couple-profile' },",
    "{ icon: 'heart', title: 'Your relationship', subtitle: 'The details that shape your shared space', href: '/features/couple-profile' },",
    'Couple profile conversational label',
  );

  source = replaceOnce(
    source,
    "{ icon: 'tag', title: 'Tags', subtitle: 'Manage labels used across your space', href: '/features/tags' },",
    "{ icon: 'tag', title: 'Tags', subtitle: 'The labels you use to keep things findable', href: '/features/tags' },",
    'Tags conversational subtitle',
  );

  write(rel, source);
}

// -----------------------------------------------------------------------------
// Audit
// -----------------------------------------------------------------------------

const audits = [
  ['src/components/navigation/FeatureGroupCard.tsx', [
    "if (accent) {",
    '<Card tone="accent"',
    'borderBottomWidth: accent ? 0 : 1',
    "backgroundColor: pressed && !accent ? theme.colors.elevatedBackground : 'transparent'",
    '<View style={{ gap: theme.spacing.sm }}>',
  ]],
  ['src/app/(tabs)/plan.tsx', [
    'The practical bits of life you’re building together.',
    'title="Day to day"',
    'title="Dates worth keeping"',
    'title="Things you’re building toward"',
    'When are we both free?',
  ]],
  ['src/app/(tabs)/together.tsx', [
    'title="How are we?"',
    'Pick a little moment together',
    'Today’s question',
    'How are you feeling?',
  ]],
  ['src/app/(tabs)/more.tsx', [
    'The quieter settings and tools behind your shared space.',
    'title="Behind the scenes"',
    'title: \'Your relationship\'',
  ]],
];

for (const [rel, markers] of audits) {
  const finalSource = read(rel);
  for (const marker of markers) {
    if (!finalSource.includes(marker)) fail(`Post-apply audit missing "${marker}" in ${rel}`);
  }
}

console.log('D15 Lighter Navigation audit clean.');

function run(args, label) {
  console.log(`\n> ${label}`);
  let result;
  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || 'cmd.exe';
    const command = ['npm.cmd', ...args].join(' ');
    result = spawnSync(comspec, ['/d', '/s', '/c', command], {
      cwd: root,
      stdio: 'inherit',
      windowsHide: false,
    });
  } else {
    result = spawnSync('npm', args, { cwd: root, stdio: 'inherit' });
  }

  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} exited with code ${result.status}.`);
}

run(['run', 'typecheck'], 'Frontend typecheck');
run(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
run(['--prefix', 'server', 'run', 'logic'], 'Server logic smoke checks');

console.log('\nD15 Lighter Navigation applied successfully.');
console.log('All requested validation checks passed.');
console.log('No migration is required.');
