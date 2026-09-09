const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const rel = 'src/app/features/countdowns.tsx';
const file = path.join(root, ...rel.split('/'));

function fail(message) {
  console.error(`\nD11 Living Countdowns FAILED: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(file)) {
  fail(`Missing ${rel}. Run this from the Togetherly project root.`);
}

let source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const baseline = [
  'export default function CountdownsScreen()',
  'countdownRemaining(countdown.target_at, nowMs)',
  'countdownProgress(countdown.start_at, countdown.target_at, nowMs)',
  'CollapsibleComposer',
  'RecordViewSheet',
];
for (const marker of baseline) {
  if (!source.includes(marker)) fail(`Unexpected countdowns baseline; missing "${marker}".`);
}

function replaceOnce(oldText, newText, label) {
  if (source.includes(newText)) {
    console.log(`Already good: ${label}`);
    return;
  }
  const first = source.indexOf(oldText);
  if (first < 0) fail(`Could not find expected source for: ${label}`);
  if (source.indexOf(oldText, first + oldText.length) >= 0) fail(`Multiple matches found for: ${label}`);
  source = source.slice(0, first) + newText + source.slice(first + oldText.length);
}

// Imports
replaceOnce(
  "import { useCallback, useEffect, useState } from 'react';",
  "import { useCallback, useEffect, useMemo, useState } from 'react';",
  'useMemo import',
);

replaceOnce(
  "import { FormField } from '@/components/common/FormField';",
  "import { FormField } from '@/components/common/FormField';\nimport { AppIcon } from '@/components/art/AppIcon';\nimport { ConnectionOrbitArt } from '@/components/art/TogetherlyArt';\nimport { GentleFloat, RevealScale } from '@/components/motion/Motion';",
  'countdown motion imports',
);

// Helper copy
replaceOnce(
`function formatTarget(target: string) {
  const date = localNoonFromDateKey(countdownDateKey(target));
  return date ? new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(date) : '';
}`,
`function formatTarget(target: string) {
  const date = localNoonFromDateKey(countdownDateKey(target));
  return date ? new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).format(date) : '';
}

function livingCountdownLabel(countdown: CoupleCountdown, nowMs: number) {
  const time = countdownRemaining(countdown.target_at, nowMs);
  if (time.passed) return 'This moment has arrived';
  if (time.days === 0) return 'Today ♥';
  if (time.days === 1) return 'Tomorrow ♥';
  if (time.days <= 7) return \`\${time.days} days — so close now ♥\`;
  if (time.days <= 30) return \`\${time.days} days until \${countdown.title}\`;
  return \`\${time.days} days to go\`;
}

function countdownTypeLine(type: CountdownType) {
  if (type === 'visit') return 'until you’re together again';
  if (type === 'flight') return 'until takeoff';
  if (type === 'anniversary') return 'until your anniversary';
  if (type === 'birthday') return 'until the birthday';
  if (type === 'moving') return 'until the move';
  if (type === 'wedding') return 'until the wedding';
  if (type === 'holiday') return 'until the holiday';
  return 'until the moment you’re waiting for';
}`,
  'living countdown helpers',
);

// Derived lead countdown state after timer effects
replaceOnce(
`  useEffect(() => { refresh().catch(() => undefined); }, [refresh]); useRealtimeRefresh('countdowns', refresh);
  useEffect(() => { const timer = setInterval(() => setNowMs(Date.now()), 60_000); return () => clearInterval(timer); }, []);`,
`  useEffect(() => { refresh().catch(() => undefined); }, [refresh]); useRealtimeRefresh('countdowns', refresh);
  useEffect(() => { const timer = setInterval(() => setNowMs(Date.now()), 60_000); return () => clearInterval(timer); }, []);

  const leadCountdown = useMemo(() => {
    return countdowns
      .filter((item) => !countdownRemaining(item.target_at, nowMs).passed)
      .sort((a, b) => new Date(a.target_at).getTime() - new Date(b.target_at).getTime())[0] ?? null;
  }, [countdowns, nowMs]);

  const secondaryCountdowns = useMemo(
    () => leadCountdown ? countdowns.filter((item) => item.id !== leadCountdown.id) : countdowns,
    [countdowns, leadCountdown],
  );`,
  'lead countdown derivation',
);

// Insert hero before existing list
const listMarker = `    <View style={{ gap: theme.spacing.md }}>
      {loading ? <AppText tone="muted">Loading countdowns…</AppText> : null}`;
if (!source.includes('NEXT THING WE’RE WAITING FOR')) {
  const idx = source.indexOf(listMarker);
  if (idx < 0) fail('Could not locate countdown list insertion point.');

  const hero = `    {leadCountdown ? (() => {
      const leadTime = countdownRemaining(leadCountdown.target_at, nowMs);
      const leadProgress = countdownProgress(leadCountdown.start_at, leadCountdown.target_at, nowMs);
      return <RevealScale trigger={leadTime.days}>
        <Card participantColor="both" tone="accent" style={{ gap: theme.spacing.lg, marginBottom: theme.spacing.xl, padding: theme.spacing.xl, overflow: 'hidden' }}>
          <View style={{ position: 'absolute', right: -18, top: -18, opacity: 0.38 }}>
            <GentleFloat distance={leadTime.days <= 7 ? 4 : 2}>
              <ConnectionOrbitArt width={168} height={92} />
            </GentleFloat>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md }}>
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="caption" tone="accent">NEXT THING WE’RE WAITING FOR</AppText>
              <AppText variant="hero" style={{ maxWidth: '92%' }}>{leadCountdown.title}</AppText>
            </View>
            <GentleFloat distance={leadTime.days <= 7 ? 5 : 2} duration={leadTime.days <= 7 ? 1900 : 2800}>
              <View style={{ width: 52, height: 52, borderRadius: 20, backgroundColor: theme.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                <AppIcon name={leadTime.days <= 1 ? 'heart' : 'countdown'} size={25} color={theme.colors.accentStrong} />
              </View>
            </GentleFloat>
          </View>

          <View style={{ gap: 2 }}>
            <AppText variant="numeric">{leadTime.days}</AppText>
            <AppText variant="section">{livingCountdownLabel(leadCountdown, nowMs)}</AppText>
            <AppText variant="bodySmall" tone="secondary">{countdownTypeLine(leadCountdown.type)} · {formatTarget(leadCountdown.target_at)}</AppText>
          </View>

          {leadProgress != null ? <View style={{ gap: 7 }}>
            <ProgressBar value={leadProgress} />
            <AppText variant="caption" tone="secondary">{Math.round(leadProgress)}% of the wait is already behind you</AppText>
          </View> : null}

          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <AppButton compact label="Open countdown" onPress={() => setViewTarget(leadCountdown)} />
            </View>
            <IconButton icon="overflow" label={\`More actions for \${leadCountdown.title}\`} onPress={() => openCountdownMenu(leadCountdown)} />
          </View>
        </Card>
      </RevealScale>;
    })() : null}

`;
  source = source.slice(0, idx) + hero + source.slice(idx);
  console.log('Added living lead countdown hero.');
}

// Make underlying list use secondaryCountdowns and add a conversational heading.
replaceOnce(
`    <View style={{ gap: theme.spacing.md }}>
      {loading ? <AppText tone="muted">Loading countdowns…</AppText> : null}
      {!loading && countdowns.length === 0 ? <EmptyState`,
`    <View style={{ gap: theme.spacing.md }}>
      {secondaryCountdowns.length ? <View style={{ gap: 3, marginBottom: 2 }}><AppText variant="section">{leadCountdown ? 'Other things you’re counting down to' : 'Your countdowns'}</AppText><AppText variant="bodySmall" tone="muted">The dates you’re keeping close.</AppText></View> : null}
      {loading ? <AppText tone="muted">Loading countdowns…</AppText> : null}
      {!loading && countdowns.length === 0 ? <EmptyState`,
  'secondary list heading',
);

replaceOnce(
  `{countdowns.map((countdown) => {`,
  `{secondaryCountdowns.map((countdown) => {`,
  'secondary countdown mapping',
);

// Add conversational detail to view sheet
replaceOnce(
`        <AppText variant="numeric">{Math.max(0, countdownRemaining(viewTarget.target_at, nowMs).days)}</AppText>
        <AppText tone="secondary">{countdownRemaining(viewTarget.target_at, nowMs).passed ? 'This countdown has arrived.' : 'days remaining'}</AppText>`,
`        <AppText variant="numeric">{Math.max(0, countdownRemaining(viewTarget.target_at, nowMs).days)}</AppText>
        <AppText variant="section">{livingCountdownLabel(viewTarget, nowMs)}</AppText>
        <AppText tone="secondary">{countdownTypeLine(viewTarget.type)}</AppText>
        {countdownProgress(viewTarget.start_at, viewTarget.target_at, nowMs) != null ? <View style={{ gap: 7 }}><ProgressBar value={countdownProgress(viewTarget.start_at, viewTarget.target_at, nowMs) ?? 0} /><AppText variant="caption" tone="muted">{Math.round(countdownProgress(viewTarget.start_at, viewTarget.target_at, nowMs) ?? 0)}% of the wait complete</AppText></View> : null}`,
  'countdown detail emotional state',
);

fs.writeFileSync(file, source.replace(/\n/g, '\r\n'), 'utf8');
console.log(`Wrote ${rel}`);

// Audit
const finalSource = fs.readFileSync(file, 'utf8');
const audits = [
  'const leadCountdown = useMemo(() => {',
  'const secondaryCountdowns = useMemo(',
  'NEXT THING WE’RE WAITING FOR',
  'Tomorrow ♥',
  'Today ♥',
  'Other things you’re counting down to',
  '<RevealScale trigger={leadTime.days}>',
  'of the wait is already behind you',
  'countdownTypeLine(viewTarget.type)',
];
for (const marker of audits) {
  if (!finalSource.includes(marker)) fail(`Post-apply audit missing marker: ${marker}`);
}

console.log('D11 Living Countdowns audit clean.');

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

console.log('\nD11 Living Countdowns applied successfully.');
console.log('All requested validation checks passed.');
console.log('No migration is required.');
