const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();

function fail(message) {
  console.error(`\nD17 Relationship Rhythm FAILED: ${message}`);
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
// Home relationship actions: make this the shared ritual component for Home + Together.
// -----------------------------------------------------------------------------
{
  const rel = 'src/components/dashboard/HomeConnectionActions.tsx';
  let source = read(rel);

  const baseline = [
    '<AppText variant="section">Connect</AppText>',
    'Small things that reach {partnerName} straight away.',
    'A quick check-in. You can use the full Mood screen whenever you want more context.',
  ];
  for (const marker of baseline) {
    if (!source.includes(marker)) fail(`Unexpected HomeConnectionActions baseline; missing "${marker}".`);
  }

  source = replaceOnce(
    source,
    '<AppText variant="section">Connect</AppText>',
    '<AppText variant="section">Between you</AppText>',
    'connection section title',
  );

  source = replaceOnce(
    source,
    '<AppText variant="bodySmall" tone="muted">Small things that reach {partnerName} straight away.</AppText>',
    '<AppText variant="bodySmall" tone="muted">Tiny ways to reach {partnerName} right now.</AppText>',
    'connection section subtitle',
  );

  source = replaceOnce(
    source,
    '<AppText variant="bodySmall" tone="secondary">A quick check-in. You can use the full Mood screen whenever you want more context.</AppText>',
    '<AppText variant="bodySmall" tone="secondary">Share just enough to help {partnerName} know where you’re at. You can always add more on the full check-in screen.</AppText>',
    'quick mood ritual copy',
  );

  source = replaceOnce(
    source,
    "label={recentSignal === 'mood' ? 'Check-in shared ✓' : 'Check in'}",
    "label={recentSignal === 'mood' ? 'Shared ✓' : 'How I’m feeling'}",
    'quick mood action label',
  );

  source = replaceOnce(
    source,
    'detail="How are you?"',
    'detail={`Share with ${partnerName}`}',
    'quick mood action detail',
  );

  write(rel, source);
}

// -----------------------------------------------------------------------------
// Home: make the lower rows clearly "life today", separate from relationship priority.
// -----------------------------------------------------------------------------
{
  const rel = 'src/components/dashboard/HomeTodayCard.tsx';
  let source = read(rel);

  const baseline = [
    '<AppText variant="section">Right now</AppText>',
    '<AppText variant="section">Today</AppText>',
    'A short view of what needs your attention.',
  ];
  for (const marker of baseline) {
    if (!source.includes(marker)) fail(`Unexpected HomeTodayCard baseline; missing "${marker}".`);
  }

  source = replaceOnce(
    source,
    '<AppText variant="bodySmall" tone="muted">The thing that matters most between you two.</AppText>',
    '<AppText variant="bodySmall" tone="muted">The relationship moment that matters most right now.</AppText>',
    'Home right-now subtitle',
  );

  source = replaceOnce(
    source,
    '<AppText variant="section">Today</AppText>',
    '<AppText variant="section">Life today</AppText>',
    'Home practical section title',
  );

  source = replaceOnce(
    source,
    '<AppText variant="bodySmall" tone="muted">A short view of what needs your attention.</AppText>',
    '<AppText variant="bodySmall" tone="muted">The practical bits around your day.</AppText>',
    'Home practical section subtitle',
  );

  write(rel, source);
}

// -----------------------------------------------------------------------------
// Together: turn the tab into a shared lounge instead of duplicating the ping card.
// -----------------------------------------------------------------------------
{
  const rel = 'src/app/(tabs)/together.tsx';
  let source = read(rel);

  const baseline = [
    "import { ConnectionPingsCard } from '@/components/together/ConnectionPingsCard';",
    '<ConnectionPingsCard />',
    '<PageHeader eyebrow="Right now" title="Together" subtitle="Talk, play and be a little closer." />',
    '<FeatureGroupCard eyebrow="CONNECT" title="How are we?"',
  ];
  for (const marker of baseline) {
    if (!source.includes(marker)) fail(`Unexpected Together baseline; missing "${marker}".`);
  }

  source = replaceOnce(
    source,
    "import { ConnectionPingsCard } from '@/components/together/ConnectionPingsCard';",
    "import { HomeConnectionActions } from '@/components/dashboard/HomeConnectionActions';\nimport { PartnerPresencePill } from '@/components/common/PartnerPresencePill';",
    'Together ritual imports',
  );

  source = replaceOnce(
    source,
    '<PageHeader eyebrow="Right now" title="Together" subtitle="Talk, play and be a little closer." />',
    '<PageHeader eyebrow="Right now" title="Together" subtitle="The part of your space for actually being together." />',
    'Together header copy',
  );

  const oldBody = `      <View style={{ gap: theme.spacing.lg }}>
        <Card participantColor="both" tone="accent" style={{ gap: theme.spacing.md, padding: theme.spacing.xl, overflow: 'hidden' }}>
          <View style={{ alignItems: 'center', marginTop: -6, marginBottom: -8 }}>
            <GentleFloat distance={3}><ConnectionOrbitArt /></GentleFloat>
          </View>
          <View style={{ gap: 5 }}>
            <AppText variant="caption" tone="accent">PLAY TOGETHER</AppText>
            <AppText variant="hero">Do something together.</AppText>
            <AppText tone="secondary">Quick games, shared drawing and tiny ways to feel present with each other.</AppText>
          </View>
          <AppButton label="Play together" onPress={() => router.push('/features/play-together' as never)} />
        </Card>
        <ConnectionPingsCard />
        <FeatureGroupCard eyebrow="CONNECT" title="How are we?" subtitle="Small ways to understand each other today." items={connect} />
        <FeatureGroupCard eyebrow="WHEN YOU WANT SOMETHING TO DO" title="Pick a little moment together" items={dateIdeas} />
      </View>`;

  const newBody = `      <View style={{ gap: theme.spacing.lg }}>
        <PartnerPresencePill scope="together" />

        <HomeConnectionActions />

        <FeatureGroupCard
          eyebrow="A LITTLE DEEPER"
          title="Check in together"
          subtitle="The question, moods and little context that help you understand each other."
          items={connect}
        />

        <Card participantColor="both" tone="accent" style={{ gap: theme.spacing.md, padding: theme.spacing.xl, overflow: 'hidden' }}>
          <View style={{ alignItems: 'center', marginTop: -6, marginBottom: -8 }}>
            <GentleFloat distance={3}><ConnectionOrbitArt /></GentleFloat>
          </View>
          <View style={{ gap: 5 }}>
            <AppText variant="caption" tone="accent">DO SOMETHING TOGETHER</AppText>
            <AppText variant="hero">Play for a bit.</AppText>
            <AppText tone="secondary">Games, shared drawing and little spaces that feel better when you’re both there.</AppText>
          </View>
          <AppButton label="Play together" onPress={() => router.push('/features/play-together' as never)} />
        </Card>

        <FeatureGroupCard eyebrow="WHEN YOU WANT SOMETHING TO DO" title="Pick a little moment together" items={dateIdeas} />
      </View>`;

  source = replaceOnce(
    source,
    oldBody,
    newBody,
    'Together relationship-first ordering',
  );

  write(rel, source);
}

// -----------------------------------------------------------------------------
// Audit
// -----------------------------------------------------------------------------
const audits = [
  ['src/components/dashboard/HomeConnectionActions.tsx', [
    '<AppText variant="section">Between you</AppText>',
    'Tiny ways to reach {partnerName} right now.',
    "label={recentSignal === 'mood' ? 'Shared ✓' : 'How I’m feeling'}",
    'Share just enough to help {partnerName} know where you’re at.',
  ]],
  ['src/components/dashboard/HomeTodayCard.tsx', [
    'The relationship moment that matters most right now.',
    '<AppText variant="section">Life today</AppText>',
    'The practical bits around your day.',
  ]],
  ['src/app/(tabs)/together.tsx', [
    "import { HomeConnectionActions } from '@/components/dashboard/HomeConnectionActions';",
    "import { PartnerPresencePill } from '@/components/common/PartnerPresencePill';",
    '<PartnerPresencePill scope="together" />',
    '<HomeConnectionActions />',
    'title="Check in together"',
    'DO SOMETHING TOGETHER',
    'Play for a bit.',
  ]],
];

for (const [rel, markers] of audits) {
  const source = read(rel);
  for (const marker of markers) {
    if (!source.includes(marker)) fail(`Post-apply audit missing "${marker}" in ${rel}`);
  }
}

const togetherFinal = read('src/app/(tabs)/together.tsx');
if (togetherFinal.includes('<ConnectionPingsCard />')) {
  fail('Old duplicate ConnectionPingsCard is still rendered on Together.');
}
if (togetherFinal.includes("import { ConnectionPingsCard }")) {
  fail('Old duplicate ConnectionPingsCard import is still present.');
}

console.log('D17 Relationship Rhythm audit clean.');

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

console.log('\nD17 Relationship Rhythm applied successfully.');
console.log('All requested validation checks passed.');
console.log('No migration is required.');
