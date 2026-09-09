const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();

function fail(message) {
  console.error(`\nD18 UX Regression & Hardening FAILED: ${message}`);
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
// 1) Quick add/edit sheets: fix the D8 "QUICK EDIT" regression and reduced motion.
// -----------------------------------------------------------------------------
{
  const rel = 'src/components/common/CollapsibleComposer.tsx';
  let source = read(rel);

  const baseline = [
    "{open ? 'QUICK EDIT' : 'QUICK CREATE'}",
    'animationType="slide"',
    'export function CollapsibleComposer({',
  ];
  for (const marker of baseline) {
    if (!source.includes(marker)) fail(`Unexpected CollapsibleComposer baseline; missing "${marker}".`);
  }

  source = replaceOnce(
    source,
    `  const theme = useAppTheme();
  const feedback = useInteractionFeedback();`,
    `  const theme = useAppTheme();
  const feedback = useInteractionFeedback();
  const isEditing = /^edit\\b/i.test(title.trim());`,
    'composer edit-mode inference',
  );

  source = replaceOnce(
    source,
    'animationType="slide"',
    "animationType={theme.reducedMotion ? 'none' : 'slide'}",
    'composer reduced-motion modal',
  );

  source = replaceOnce(
    source,
    "{open ? 'QUICK EDIT' : 'QUICK CREATE'}",
    "{isEditing ? 'QUICK EDIT' : 'QUICK ADD'}",
    'composer mode caption',
  );

  write(rel, source);
}

// -----------------------------------------------------------------------------
// 2) Record view sheets: reduced motion + consistent modal handling.
// -----------------------------------------------------------------------------
{
  const rel = 'src/components/common/RecordViewSheet.tsx';
  let source = read(rel);

  const baseline = [
    '<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>',
    'Use ••• on the item card to edit, manage or delete it.',
  ];
  for (const marker of baseline) {
    if (!source.includes(marker)) fail(`Unexpected RecordViewSheet baseline; missing "${marker}".`);
  }

  source = replaceOnce(
    source,
    '<Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>',
    "<Modal visible={visible} transparent animationType={theme.reducedMotion ? 'none' : 'slide'} statusBarTranslucent onRequestClose={onClose}>",
    'record view reduced-motion modal',
  );

  source = replaceOnce(
    source,
    'Use ••• on the item card to edit, manage or delete it.',
    'Close this view, then use ••• on the card for any edit or delete options.',
    'record view action hint',
  );

  write(rel, source);
}

// -----------------------------------------------------------------------------
// 3) Home/Together quick Mood sheet: respect reduced motion.
// -----------------------------------------------------------------------------
{
  const rel = 'src/components/dashboard/HomeConnectionActions.tsx';
  let source = read(rel);

  if (!source.includes('visible={moodOpen}')) {
    fail('Unexpected HomeConnectionActions baseline; mood modal not found.');
  }
  if (!source.includes('animationType="slide"') && !source.includes("animationType={theme.reducedMotion ? 'none' : 'slide'}")) {
    fail('Unexpected HomeConnectionActions baseline; modal animation not found.');
  }

  source = replaceOnce(
    source,
    'animationType="slide"',
    "animationType={theme.reducedMotion ? 'none' : 'slide'}",
    'quick mood reduced-motion modal',
  );

  write(rel, source);
}

// -----------------------------------------------------------------------------
// 4) Shared celebrations: D9 animation now honours reduced motion too.
// -----------------------------------------------------------------------------
{
  const rel = 'src/components/common/CelebrationMoment.tsx';
  let source = read(rel);

  const oldEffect = `  useEffect(() => {
    if (!moment) return;
    progress.stopAnimation();
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 460,
      easing: Easing.out(Easing.back(1.35)),
      useNativeDriver: true,
    }).start();

    const timeout = setTimeout(onDismiss, moment.actionLabel ? 3600 : 1900);
    return () => clearTimeout(timeout);
  }, [moment, onDismiss, progress]);`;

  const newEffect = `  useEffect(() => {
    if (!moment) return;
    progress.stopAnimation();
    progress.setValue(theme.reducedMotion ? 1 : 0);

    const animation = theme.reducedMotion
      ? null
      : Animated.timing(progress, {
          toValue: 1,
          duration: 460,
          easing: Easing.out(Easing.back(1.35)),
          useNativeDriver: true,
        });
    animation?.start();

    const timeout = setTimeout(onDismiss, moment.actionLabel ? 3600 : 1900);
    return () => {
      animation?.stop();
      clearTimeout(timeout);
    };
  }, [moment, onDismiss, progress, theme.reducedMotion]);`;

  source = replaceOnce(
    source,
    oldEffect,
    newEffect,
    'celebration reduced-motion animation',
  );

  source = replaceOnce(
    source,
    '<Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>',
    "<Modal visible transparent animationType={theme.reducedMotion ? 'none' : 'fade'} statusBarTranslucent onRequestClose={onDismiss}>",
    'celebration reduced-motion modal',
  );

  write(rel, source);
}

// -----------------------------------------------------------------------------
// 5) Final source-level UX regression audit.
// -----------------------------------------------------------------------------

function requireMarker(rel, marker, label = marker) {
  const source = read(rel);
  if (!source.includes(marker)) fail(`UX regression audit: ${rel} is missing ${label}.`);
}

function forbidMarker(rel, marker, label = marker) {
  const source = read(rel);
  if (source.includes(marker)) fail(`UX regression audit: ${rel} still contains ${label}.`);
}

// Five-tab information architecture.
const tabs = read('src/app/(tabs)/_layout.tsx');
for (const screen of ['index', 'plan', 'together', 'us', 'more']) {
  if (!tabs.includes(`<Tabs.Screen name="${screen}"`)) {
    fail(`UX regression audit: missing ${screen} tab.`);
  }
}

// Home remains relationship-first.
requireMarker('src/app/(tabs)/index.tsx', '<HomeTodayCard />', 'Home Today card');
requireMarker('src/app/(tabs)/index.tsx', '<HomeConnectionActions />', 'Home connection actions');
requireMarker('src/components/dashboard/HomeTodayCard.tsx', 'The relationship moment that matters most right now.');
requireMarker('src/components/dashboard/HomeTodayCard.tsx', '<AppText variant="section">Life today</AppText>');

// Together is the shared lounge and no longer renders the old duplicate ping card.
requireMarker('src/app/(tabs)/together.tsx', '<PartnerPresencePill scope="together" />');
requireMarker('src/app/(tabs)/together.tsx', '<HomeConnectionActions />');
requireMarker('src/app/(tabs)/together.tsx', 'title="Check in together"');
forbidMarker('src/app/(tabs)/together.tsx', '<ConnectionPingsCard />', 'duplicate ConnectionPingsCard');

// D8 sheet regression fixed.
requireMarker('src/components/common/CollapsibleComposer.tsx', "const isEditing = /^edit\\\\b/i.test(title.trim());");
requireMarker('src/components/common/CollapsibleComposer.tsx', "{isEditing ? 'QUICK EDIT' : 'QUICK ADD'}");
forbidMarker('src/components/common/CollapsibleComposer.tsx', "{open ? 'QUICK EDIT' : 'QUICK CREATE'}", 'always-edit caption');

// Reduced-motion coverage for the main shared overlays.
requireMarker('src/components/common/CollapsibleComposer.tsx', "animationType={theme.reducedMotion ? 'none' : 'slide'}");
requireMarker('src/components/common/RecordViewSheet.tsx', "animationType={theme.reducedMotion ? 'none' : 'slide'}");
requireMarker('src/components/dashboard/HomeConnectionActions.tsx', "animationType={theme.reducedMotion ? 'none' : 'slide'}");
requireMarker('src/components/common/CelebrationMoment.tsx', "animationType={theme.reducedMotion ? 'none' : 'fade'}");
requireMarker('src/components/common/CelebrationMoment.tsx', 'progress.setValue(theme.reducedMotion ? 1 : 0);');

// Presence infrastructure still covers the key collaborative rooms.
requireMarker('src/hooks/usePartnerPresence.ts', 'partnerScope,');
requireMarker('src/components/dashboard/SharedScratchpadCard.tsx', "partnerScope?.startsWith('scratchpad:')");
requireMarker('src/app/features/games/[id].tsx', "const gamePresenceScope = id ? `game:${id}` : 'game:loading';");
requireMarker('src/app/features/notes.tsx', "const notePresenceScope = presenceNote ? `note:${presenceNote.id}:${notePresenceMode}` : 'note:none';");

// Story / Plan / key roadmap anchors are still present.
requireMarker('src/app/(tabs)/us.tsx', 'Explore your story');
requireMarker('src/app/(tabs)/plan.tsx', 'title="Day to day"');
requireMarker('src/app/features/trip-detail.tsx', 'Everything for the trip');
requireMarker('src/app/features/countdowns.tsx', 'NEXT THING WE');
requireMarker('src/app/features/activities.tsx', 'Both want this');
requireMarker('src/app/features/decision-tools.tsx', 'PartnerPresencePill');

console.log('D18 source-level UX regression audit clean.');

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

// Final release validates more than previous D-series packages.
run(['run', 'typecheck'], 'Frontend typecheck');
run(['run', 'lint'], 'Frontend lint');
run(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
run(['--prefix', 'server', 'run', 'logic'], 'Server logic smoke checks');

console.log('\nD18 UX Regression & Hardening applied successfully.');
console.log('Source audit, frontend typecheck, lint, server typecheck and server logic all passed.');
console.log('No migration is required.');
