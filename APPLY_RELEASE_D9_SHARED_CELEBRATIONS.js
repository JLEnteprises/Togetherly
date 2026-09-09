const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();

function fail(message) {
  console.error(`\nD9 Shared Celebrations FAILED: ${message}`);
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

function write(rel, text) {
  const file = full(rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`Wrote ${rel}`);
}

function replaceOnce(text, oldText, newText, label) {
  if (text.includes(newText)) {
    console.log(`Already good: ${label}`);
    return text;
  }
  const first = text.indexOf(oldText);
  if (first < 0) fail(`Could not find expected source for: ${label}`);
  if (text.indexOf(oldText, first + oldText.length) >= 0) fail(`Multiple matches found for: ${label}`);
  return text.slice(0, first) + newText + text.slice(first + oldText.length);
}

// D8/D7 baseline guards.
if (!read('src/components/common/CollapsibleComposer.tsx').includes('animationType="slide"')) {
  fail('D8 Quick Create Sheets baseline is missing.');
}
if (!read('src/services/backend/realtime.ts').includes("type: 'presence.snapshot'")) {
  fail('D7 Live Partner Presence baseline is missing.');
}

// -----------------------------------------------------------------------------
// Shared celebration hook
// -----------------------------------------------------------------------------

write('src/hooks/useCelebrationMoment.ts', `import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { usePreferences } from '@/providers/PreferencesProvider';
import type { AppIconName } from '@/components/art/AppIcon';

export type CelebrationMomentData = {
  title: string;
  body?: string;
  icon?: AppIconName;
  actionLabel?: string;
  onAction?: () => void;
};

export function useCelebrationMoment() {
  const { preferences } = usePreferences();
  const [celebration, setCelebration] = useState<CelebrationMomentData | null>(null);

  const celebrate = useCallback((moment: CelebrationMomentData) => {
    setCelebration(moment);
    if (preferences.haptics && Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
  }, [preferences.haptics]);

  const dismissCelebration = useCallback(() => setCelebration(null), []);

  return { celebration, celebrate, dismissCelebration };
}
`);

// -----------------------------------------------------------------------------
// Shared celebration UI
// -----------------------------------------------------------------------------

write('src/components/common/CelebrationMoment.tsx', `import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, View } from 'react-native';
import { AppIcon } from '@/components/art/AppIcon';
import type { CelebrationMomentData } from '@/hooks/useCelebrationMoment';
import { useAppTheme } from '@/theme/useAppTheme';
import { AppText } from './AppText';
import { AppButton } from './AppButton';

export function CelebrationMoment({
  moment,
  onDismiss,
}: {
  moment: CelebrationMomentData | null;
  onDismiss: () => void;
}) {
  const theme = useAppTheme();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
  }, [moment, onDismiss, progress]);

  if (!moment) return null;

  const cardScale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1],
  });
  const cardOpacity = progress.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 1, 1],
  });
  const sparkleLift = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [18, -10],
  });
  const sparkleOpacity = progress.interpolate({
    inputRange: [0, 0.18, 0.82, 1],
    outputRange: [0, 1, 1, 0.35],
  });

  function runAction() {
    const action = moment.onAction;
    onDismiss();
    action?.();
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onDismiss}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.overlay, padding: theme.spacing.xl }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss celebration" onPress={onDismiss} style={{ position: 'absolute', inset: 0 }} />

        <Animated.View
          style={{
            width: '100%',
            maxWidth: 430,
            opacity: cardOpacity,
            transform: [{ scale: cardScale }],
          }}
        >
          <View style={{ position: 'absolute', left: 26, top: -22 }}>
            <Animated.View style={{ opacity: sparkleOpacity, transform: [{ translateY: sparkleLift }, { rotate: '-14deg' }] }}>
              <AppIcon name="spark" size={28} color={theme.colors.accent} />
            </Animated.View>
          </View>
          <View style={{ position: 'absolute', right: 24, top: -12 }}>
            <Animated.View style={{ opacity: sparkleOpacity, transform: [{ translateY: sparkleLift }, { rotate: '16deg' }] }}>
              <AppIcon name="heart" size={25} color={theme.colors.accentStrong} />
            </Animated.View>
          </View>
          <View style={{ position: 'absolute', left: 54, bottom: -15 }}>
            <Animated.View style={{ opacity: sparkleOpacity, transform: [{ translateY: sparkleLift }] }}>
              <AppIcon name="spark" size={20} color={theme.colors.success} />
            </Animated.View>
          </View>

          <View
            style={{
              borderRadius: theme.radii.xl,
              borderWidth: 1,
              borderColor: theme.colors.accent,
              backgroundColor: theme.colors.background,
              padding: theme.spacing.xl,
              gap: theme.spacing.md,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.accentSoft,
              }}
            >
              <AppIcon name={moment.icon ?? 'spark'} size={34} color={theme.colors.accentStrong} />
            </View>

            <View style={{ gap: 6, alignItems: 'center' }}>
              <AppText variant="pageTitle" align="center">{moment.title}</AppText>
              {moment.body ? <AppText tone="secondary" align="center">{moment.body}</AppText> : null}
            </View>

            {moment.actionLabel ? (
              <View style={{ width: '100%' }}>
                <AppButton label={moment.actionLabel} onPress={runAction} />
              </View>
            ) : (
              <AppText variant="caption" tone="muted">A little win for the two of you.</AppText>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
`);

// -----------------------------------------------------------------------------
// Helpers for screen integrations
// -----------------------------------------------------------------------------

function addImports(source, label) {
  if (!source.includes("import { CelebrationMoment } from '@/components/common/CelebrationMoment';")) {
    source = replaceOnce(
      source,
      "import { BackHeader } from '@/components/common/BackHeader';",
      "import { BackHeader } from '@/components/common/BackHeader';\nimport { CelebrationMoment } from '@/components/common/CelebrationMoment';",
      `${label} celebration component import`,
    );
  }
  if (!source.includes("import { useCelebrationMoment } from '@/hooks/useCelebrationMoment';")) {
    source = replaceOnce(
      source,
      "import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';",
      "import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';\nimport { useCelebrationMoment } from '@/hooks/useCelebrationMoment';",
      `${label} celebration hook import`,
    );
  }
  return source;
}

function addHookAfterTheme(source, label) {
  if (source.includes('const { celebration, celebrate, dismissCelebration } = useCelebrationMoment();')) return source;
  return replaceOnce(
    source,
    '  const theme = useAppTheme();',
    '  const theme = useAppTheme();\n  const { celebration, celebrate, dismissCelebration } = useCelebrationMoment();',
    `${label} celebration hook state`,
  );
}

function addRenderBeforeAppScreenClose(source, label) {
  if (source.includes('<CelebrationMoment moment={celebration} onDismiss={dismissCelebration} />')) return source;
  const marker = '    </AppScreen>';
  const idx = source.lastIndexOf(marker);
  if (idx < 0) fail(`Could not locate AppScreen close for ${label}.`);
  return source.slice(0, idx) +
    '      <CelebrationMoment moment={celebration} onDismiss={dismissCelebration} />\n' +
    source.slice(idx);
}

// -----------------------------------------------------------------------------
// Tasks: completing a task
// -----------------------------------------------------------------------------

{
  const rel = 'src/app/features/tasks.tsx';
  let source = read(rel);
  source = addImports(source, 'Tasks');
  source = addHookAfterTheme(source, 'Tasks');

  source = replaceOnce(
    source,
    `    try { await updateTask(task.id, { status, updatedAt: task.updated_at }); await refresh(); }
    catch (error) { setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: previous } : item)); Alert.alert('Couldn’t update task', messageFrom(error)); }`,
    `    try {
      await updateTask(task.id, { status, updatedAt: task.updated_at });
      await refresh();
      if (status === 'completed' && previous !== 'completed') {
        celebrate({ title: 'Done ✓', body: task.title, icon: 'check' });
      }
    }
    catch (error) { setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: previous } : item)); Alert.alert('Couldn’t update task', messageFrom(error)); }`,
    'task completion celebration',
  );

  source = addRenderBeforeAppScreenClose(source, 'Tasks');
  write(rel, source);
}

// -----------------------------------------------------------------------------
// Goals: reaching target or marking complete
// -----------------------------------------------------------------------------

{
  const rel = 'src/app/features/goals.tsx';
  let source = read(rel);
  source = addImports(source, 'Goals');
  source = addHookAfterTheme(source, 'Goals');

  source = replaceOnce(
    source,
    `  async function contribute(goal: CoupleGoal) {
    const raw = contributions[goal.id] ?? ''; const value = Number(raw);
    if (!Number.isFinite(value) || value === 0) { Alert.alert('Contribution', 'Enter a non-zero number. Negative values can correct a goal total.'); return; }
    try { await contributeToGoal(goal.id, value); setContributions((state) => ({ ...state, [goal.id]: '' })); setContributionOpen(null); await refresh(); }
    catch (error) { Alert.alert('Couldn’t update goal', messageFrom(error)); }
  }
  async function setGoalStatus(goal: CoupleGoal, status: GoalStatus) { try { await updateGoal(goal.id, { status }); await refresh(); } catch (error) { Alert.alert('Couldn’t update goal', messageFrom(error)); } }`,
    `  async function contribute(goal: CoupleGoal) {
    const raw = contributions[goal.id] ?? ''; const value = Number(raw);
    if (!Number.isFinite(value) || value === 0) { Alert.alert('Contribution', 'Enter a non-zero number. Negative values can correct a goal total.'); return; }
    const currentValue = Number(goal.current_value);
    const targetValue = Number(goal.target_value);
    const reachesTarget = value > 0 && Number.isFinite(currentValue) && Number.isFinite(targetValue) && currentValue < targetValue && currentValue + value >= targetValue;
    try {
      await contributeToGoal(goal.id, value);
      setContributions((state) => ({ ...state, [goal.id]: '' }));
      setContributionOpen(null);
      await refresh();
      if (reachesTarget) celebrate({ title: 'Goal reached ✦', body: goal.title, icon: 'goal' });
    }
    catch (error) { Alert.alert('Couldn’t update goal', messageFrom(error)); }
  }
  async function setGoalStatus(goal: CoupleGoal, status: GoalStatus) {
    try {
      await updateGoal(goal.id, { status });
      await refresh();
      if (status === 'completed' && goal.status !== 'completed') {
        celebrate({ title: 'Goal complete ✦', body: goal.title, icon: 'goal' });
      }
    } catch (error) { Alert.alert('Couldn’t update goal', messageFrom(error)); }
  }`,
    'goal milestone celebrations',
  );

  source = addRenderBeforeAppScreenClose(source, 'Goals');
  write(rel, source);
}

// -----------------------------------------------------------------------------
// Daily Question: reveal ritual
// -----------------------------------------------------------------------------

{
  const rel = 'src/app/features/daily-question.tsx';
  let source = read(rel);
  source = addImports(source, 'Daily Question');
  source = addHookAfterTheme(source, 'Daily Question');

  source = replaceOnce(
    source,
    `      setRevealed(true);
      setState((current) => current ? { ...current, revealed: true, revealedAt: result.revealedAt } : current);`,
    `      setRevealed(true);
      setState((current) => current ? { ...current, revealed: true, revealedAt: result.revealedAt } : current);
      celebrate({ title: 'A little more of us ♥', body: 'Your answers are open.', icon: 'heart' });`,
    'Daily Question reveal celebration',
  );

  source = addRenderBeforeAppScreenClose(source, 'Daily Question');
  write(rel, source);
}

// -----------------------------------------------------------------------------
// Date Ideas: mutual match with Plan it action
// -----------------------------------------------------------------------------

{
  const rel = 'src/app/features/activities.tsx';
  let source = read(rel);
  source = addImports(source, 'Date Ideas');

  // Activities keeps theme and params on one compact line.
  if (!source.includes('const { celebration, celebrate, dismissCelebration } = useCelebrationMoment();')) {
    source = replaceOnce(
      source,
      `  const theme = useAppTheme(); const params = useLocalSearchParams<{ focus?: string; edit?: string }>(); const { profile, partnerProfile, colorForUser } = useWorkspace();`,
      `  const theme = useAppTheme(); const params = useLocalSearchParams<{ focus?: string; edit?: string }>(); const { profile, partnerProfile, colorForUser } = useWorkspace();
  const { celebration, celebrate, dismissCelebration } = useCelebrationMoment();`,
      'Date Ideas celebration hook state',
    );
  }

  source = replaceOnce(
    source,
    `        Alert.alert(
          'It’s a match ❤️',
          \`You and \${partnerName} both want to do “\${activity.title}”.\`,
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Plan it', onPress: () => router.push(planActivityHref(activity) as never) },
          ],
        );`,
    `        celebrate({
          title: 'It’s a match ❤️',
          body: \`You and \${partnerName} both want to do “\${activity.title}”.\`,
          icon: 'heart',
          actionLabel: 'Plan it',
          onAction: () => router.push(planActivityHref(activity) as never),
        });`,
    'Date Idea mutual-match celebration',
  );

  source = addRenderBeforeAppScreenClose(source, 'Date Ideas');
  write(rel, source);
}

// -----------------------------------------------------------------------------
// Audit
// -----------------------------------------------------------------------------

const audits = [
  ['src/hooks/useCelebrationMoment.ts', ['NotificationFeedbackType.Success', 'export function useCelebrationMoment']],
  ['src/components/common/CelebrationMoment.tsx', ['Easing.back(1.35)', 'moment.actionLabel ? 3600 : 1900', 'A little win for the two of you.']],
  ['src/app/features/tasks.tsx', ["celebrate({ title: 'Done ✓'", '<CelebrationMoment moment={celebration}']],
  ['src/app/features/goals.tsx', ["title: 'Goal reached ✦'", "title: 'Goal complete ✦'", '<CelebrationMoment moment={celebration}']],
  ['src/app/features/daily-question.tsx', ["title: 'A little more of us ♥'", '<CelebrationMoment moment={celebration}']],
  ['src/app/features/activities.tsx', ["title: 'It’s a match ❤️'", "actionLabel: 'Plan it'", '<CelebrationMoment moment={celebration}']],
];

for (const [rel, markers] of audits) {
  const source = read(rel);
  for (const marker of markers) {
    if (!source.includes(marker)) fail(`Post-apply audit missing "${marker}" in ${rel}`);
  }
}

console.log('D9 Shared Celebrations audit clean.');

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

console.log('\nD9 Shared Celebrations applied successfully.');
console.log('All requested validation checks passed.');
console.log('No migration is required.');
