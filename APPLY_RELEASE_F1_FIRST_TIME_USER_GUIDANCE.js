const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RELEASE = 'F1 — First-Time User Guidance';
const MARKER = 'F1_FIRST_TIME_USER_GUIDANCE';
const root = process.cwd();

function fail(message) {
  console.error(`\n[F1] ${message}`);
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

function patchOnboarding(source) {
  if (source.includes(MARKER)) return source;

  let next = replaceOnce(
    source,
    "import { refreshCurrentUser } from '@/services/backend/auth';\n",
    "import { refreshCurrentUser } from '@/services/backend/auth';\nimport { queueFirstTimeGuide } from '@/services/firstTimeGuide';\n",
    'onboarding first-time guide import',
  );

  next = replaceOnce(
    next,
    "  async function finish() {\n",
    `  // ${MARKER}: only accounts that actually complete onboarding queue the one-time Home guide.\n  async function finish() {\n`,
    'onboarding F1 marker',
  );

  next = replaceOnce(
    next,
    "      await updateProfile({ onboardingComplete: true });\n      await refreshCurrentUser();\n",
    "      await updateProfile({ onboardingComplete: true });\n      await queueFirstTimeGuide(profile?.id).catch(() => undefined);\n      await refreshCurrentUser();\n",
    'onboarding queue guide after completion',
  );

  return next;
}

function patchHome(source) {
  if (source.includes(MARKER)) return source;

  let next = replaceOnce(
    source,
    "import { SharedScratchpadCard } from '@/components/dashboard/SharedScratchpadCard';\n",
    "import { SharedScratchpadCard } from '@/components/dashboard/SharedScratchpadCard';\nimport { FirstTimeGuideCard } from '@/components/dashboard/FirstTimeGuideCard';\n",
    'Home first-time guide import',
  );

  next = replaceOnce(
    next,
    "export default function HomeScreen() {\n",
    `// ${MARKER}: Home gives newly onboarded accounts a lightweight map of what to do first.\nexport default function HomeScreen() {\n`,
    'Home F1 marker',
  );

  next = replaceOnce(
    next,
    "        <InvitePartnerCard />\n        <CoupleHero />\n\n        {todayVisible ? <HomeTodayCard /> : null}\n",
    "        <InvitePartnerCard />\n        <CoupleHero />\n        <FirstTimeGuideCard />\n\n        {todayVisible ? <HomeTodayCard /> : null}\n",
    'Home first-time guide placement',
  );

  return next;
}

const servicePath = 'src/services/firstTimeGuide.ts';
const serviceSource = `import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'togetherly:first-time-guide:v1:';

function keyFor(userId: string) {
  return \`${'${STORAGE_PREFIX}'}${'${userId}'}\`;
}

// ${MARKER}: a local pending flag means existing users are not opted into new-user guidance after an upgrade.
export async function queueFirstTimeGuide(userId: string | null | undefined) {
  if (!userId) return;
  await AsyncStorage.setItem(keyFor(userId), 'pending');
}

export async function shouldShowFirstTimeGuide(userId: string | null | undefined) {
  if (!userId) return false;
  return (await AsyncStorage.getItem(keyFor(userId))) === 'pending';
}

export async function dismissFirstTimeGuide(userId: string | null | undefined) {
  if (!userId) return;
  await AsyncStorage.setItem(keyFor(userId), 'dismissed');
}
`;

const componentPath = 'src/components/dashboard/FirstTimeGuideCard.tsx';
const componentSource = `import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AppButton } from '@/components/common/AppButton';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { EyebrowText } from '@/components/common/EyebrowText';
import { AppIcon, type AppIconName } from '@/components/art/AppIcon';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import { useInteractionFeedback } from '@/hooks/useInteractionFeedback';
import { dismissFirstTimeGuide, shouldShowFirstTimeGuide } from '@/services/firstTimeGuide';

type GuideStep = {
  icon: AppIconName;
  title: string;
  body: string;
  href?: string;
};

const linkedSteps: readonly GuideStep[] = [
  { icon: 'question', title: 'Check in together', body: 'Answer today’s question separately, then open it together.', href: '/features/daily-question' },
  { icon: 'task', title: 'Plan one real thing', body: 'Add one task so Plan immediately has something useful in it.', href: '/features/tasks' },
  { icon: 'memory', title: 'Save one moment', body: 'Add a photo, funny moment or ordinary memory to start your story.', href: '/features/memories' },
];

const waitingSteps: readonly GuideStep[] = [
  { icon: 'together', title: 'Together is for connection', body: 'Questions, moods, location and playful things you do with each other.' },
  { icon: 'plan', title: 'Plan is practical life', body: 'Tasks, calendars, trips, goals and the things you are coordinating.' },
  { icon: 'us', title: 'Us becomes your story', body: 'Memories, photos and milestones build up here over time.' },
];

// ${MARKER}: this guide appears only after onboarding explicitly queues it for this profile.
export function FirstTimeGuideCard() {
  const theme = useAppTheme();
  const feedback = useInteractionFeedback();
  const { profile, partnerProfile } = useWorkspace();
  const [visible, setVisible] = useState(false);
  const userId = profile?.id;

  useEffect(() => {
    let active = true;
    setVisible(false);
    if (!userId) return () => { active = false; };
    shouldShowFirstTimeGuide(userId)
      .then((show) => { if (active) setVisible(show); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [userId]);

  if (!visible || !userId) return null;

  const linked = Boolean(partnerProfile);
  const steps = linked ? linkedSteps : waitingSteps;

  function openStep(href: string) {
    feedback();
    router.push(href as never);
  }

  async function dismiss() {
    setVisible(false);
    await dismissFirstTimeGuide(userId).catch(() => undefined);
  }

  return (
    <Card participantColor={linked ? 'both' : undefined} tone="secondary" style={{ gap: theme.spacing.md, overflow: 'hidden' }}>
      <View style={{ gap: 4 }}>
        <EyebrowText>New here</EyebrowText>
        <AppText variant="section">{linked ? 'A good first five minutes' : 'Your next step is the invite'}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {linked
            ? 'You do not need to set everything up. Three small things are enough to make Togetherly start feeling like yours.'
            : 'Send the invite card above. While you wait, this is the simple map of where things live.'}
        </AppText>
      </View>

      <View style={{ borderTopWidth: 1, borderBottomWidth: 1, borderColor: theme.colors.border }}>
        {steps.map((step, index) => {
          const content = (
            <>
              <View style={{ width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentSoft }}>
                <AppIcon name={step.icon} size={19} color={theme.colors.accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="cardTitle">{step.title}</AppText>
                <AppText variant="caption" tone="muted">{step.body}</AppText>
              </View>
              {step.href ? <AppIcon name="chevron" size={16} color={theme.colors.textMuted} /> : null}
            </>
          );
          const rowStyle = {
            minHeight: 68,
            flexDirection: 'row' as const,
            alignItems: 'center' as const,
            gap: theme.spacing.md,
            paddingVertical: 10,
            borderTopWidth: index === 0 ? 0 : 1,
            borderTopColor: theme.colors.border,
          };

          return step.href ? (
            <Pressable
              key={step.title}
              accessibilityRole="button"
              accessibilityLabel={\`${'${step.title}'}. ${'${step.body}'}\`}
              onPress={() => openStep(step.href!)}
              style={({ pressed }) => [rowStyle, { opacity: pressed ? 0.72 : 1, backgroundColor: pressed ? theme.colors.elevatedBackground : 'transparent', borderRadius: pressed ? theme.radii.sm : 0 }]}
            >
              {content}
            </Pressable>
          ) : <View key={step.title} style={rowStyle}>{content}</View>;
        })}
      </View>

      <AppButton compact variant="ghost" label="Got it" onPress={() => dismiss().catch(() => undefined)} />
    </Card>
  );
}
`;

function plannedNewFile(relativePath, source, eol) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return { relativePath, source, eol, isNew: true };
  const existing = fs.readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n');
  if (existing.includes(MARKER)) return { relativePath, source: existing, eol: fs.readFileSync(fullPath, 'utf8').includes('\r\n') ? '\r\n' : '\n', isNew: false };
  throw new Error(`${relativePath} already exists without the F1 marker; refusing to overwrite it.`);
}

function audit() {
  const onboarding = read('src/app/(onboarding)/index.tsx');
  const home = read('src/app/(tabs)/index.tsx');
  const service = read(servicePath);
  const component = read(componentPath);
  const failures = [];

  for (const [label, source] of [['Onboarding', onboarding], ['Home', home], ['Guide service', service], ['Guide card', component]]) {
    if (!source.includes(MARKER)) failures.push(`${label} F1 marker missing`);
  }
  if (!onboarding.includes('await queueFirstTimeGuide(profile?.id).catch(() => undefined);')) failures.push('Onboarding does not queue the guide');
  if (!home.includes('<FirstTimeGuideCard />')) failures.push('Home guide placement missing');
  if (!service.includes("=== 'pending'")) failures.push('Pending-only guide gate missing');
  if (!service.includes("'dismissed'")) failures.push('Guide dismissal persistence missing');
  if (!component.includes("href: '/features/daily-question'")) failures.push('Together starter action missing');
  if (!component.includes("href: '/features/tasks'")) failures.push('Plan starter action missing');
  if (!component.includes("href: '/features/memories'")) failures.push('Us starter action missing');
  if (!component.includes("const waitingSteps")) failures.push('Waiting-for-partner guidance missing');

  // Guardrails from the completed visual identity phases.
  const card = read('src/components/common/Card.tsx');
  const coupleIdentity = read('src/components/common/CoupleIdentitySignature.tsx');
  const eyebrow = read('src/components/common/EyebrowText.tsx');
  if (!card.includes('E1_SHARED_OURS_VISUAL_IDENTITY')) failures.push('E1 shared identity marker missing');
  if (!card.includes('E2_PERSONAL_COLOUR_IDENTITY')) failures.push('E2 personal identity marker missing');
  if (!coupleIdentity.includes('E3_PAIRED_COUPLE_IDENTITY')) failures.push('E3 paired identity marker missing');
  if (!eyebrow.includes('E4_FINAL_VISUAL_CONSISTENCY')) failures.push('E4 consistency marker missing');

  if (failures.length) fail(`Source audit failed:\n- ${failures.join('\n- ')}`);
}

function runNpm(args, label) {
  console.log(`\n[F1] ${label}`);
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
console.log(`[F1] Project root: ${root}`);

if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'server', 'package.json'))) {
  fail('Run this installer from the Togetherly project root.');
}

const onboardingPath = 'src/app/(onboarding)/index.tsx';
const homePath = 'src/app/(tabs)/index.tsx';
const pending = [];

try {
  const onboardingInput = sourceWithEol(onboardingPath);
  const homeInput = sourceWithEol(homePath);
  const newFileEol = onboardingInput.eol;

  // Precompute every output before writing anything, so an anchor failure cannot half-apply F1.
  pending.push({ relativePath: onboardingPath, source: patchOnboarding(onboardingInput.source), eol: onboardingInput.eol });
  pending.push({ relativePath: homePath, source: patchHome(homeInput.source), eol: homeInput.eol });
  pending.push(plannedNewFile(servicePath, serviceSource, newFileEol));
  pending.push(plannedNewFile(componentPath, componentSource, newFileEol));
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

for (const item of pending) {
  fs.mkdirSync(path.dirname(path.join(root, item.relativePath)), { recursive: true });
  fs.writeFileSync(path.join(root, item.relativePath), restoreEol(item.source, item.eol), 'utf8');
}

console.log('[F1] First-time guidance patches applied (or already present).');
audit();
console.log('[F1] Source audit passed.');

runNpm(['run', 'typecheck'], 'Frontend typecheck');
runNpm(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
runNpm(['--prefix', 'server', 'run', 'logic'], 'Server logic smoke checks');

console.log('\n[F1] ALL VALIDATIONS PASSED');
console.log('[F1] Newly onboarded accounts now get one lightweight Home guide.');
console.log('[F1] Existing completed accounts are not automatically opted into it.');
console.log('[F1] No database migration or dependency change was required.');
console.log('[F1] Do not run expo lint as part of this release.\n');
