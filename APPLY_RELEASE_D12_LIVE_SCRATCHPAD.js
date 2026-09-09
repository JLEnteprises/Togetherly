const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();

function fail(message) {
  console.error(`\nD12 Live Scratchpad FAILED: ${message}`);
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
  fs.writeFileSync(full(rel), text.replace(/\n/g, '\r\n'), 'utf8');
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
// Presence hook: allow opt-in claiming and expose the partner's actual scope.
// -----------------------------------------------------------------------------

{
  const rel = 'src/hooks/usePartnerPresence.ts';
  let source = read(rel);

  source = replaceOnce(
    source,
    `export function usePartnerPresence(scope: string) {`,
    `export function usePartnerPresence(scope: string, active = true) {`,
    'presence hook active option',
  );

  source = replaceOnce(
    source,
    `  useEffect(() => {
    const releasePresence = realtimeClient.claimPresence(scope);
    const unsubscribe = realtimeClient.subscribe((event) => {
      if (event.type !== 'presence.snapshot') return;
      const partner = partnerProfile ? event.users.find((user) => user.userId === partnerProfile.id) : null;
      setPartnerScope(partner?.scope ?? null);
    });
    return () => {
      releasePresence();
      unsubscribe();
    };
  }, [partnerProfile, scope]);`,
    `  useEffect(() => {
    if (!active) setPartnerScope(null);

    const unsubscribe = realtimeClient.subscribe((event) => {
      if (event.type !== 'presence.snapshot') return;
      const partner = partnerProfile ? event.users.find((user) => user.userId === partnerProfile.id) : null;
      setPartnerScope(partner?.scope ?? null);
    });
    const releasePresence = active ? realtimeClient.claimPresence(scope) : () => undefined;

    return () => {
      releasePresence();
      unsubscribe();
    };
  }, [active, partnerProfile, scope]);`,
    'presence subscription and conditional claim',
  );

  source = replaceOnce(
    source,
    `    partnerName: partnerProfile?.display_name || 'Your partner',
    isHere: Boolean(partnerProfile && partnerScope === scope),`,
    `    partnerName: partnerProfile?.display_name || 'Your partner',
    partnerScope,
    isHere: Boolean(active && partnerProfile && partnerScope === scope),`,
    'presence hook exposes scope',
  );

  write(rel, source);
}

// -----------------------------------------------------------------------------
// Shared scratchpad: contextual live co-presence for text/draw modes.
// -----------------------------------------------------------------------------

{
  const rel = 'src/components/dashboard/SharedScratchpadCard.tsx';
  let source = read(rel);

  if (!source.includes("import { AppIcon } from '@/components/art/AppIcon';")) {
    source = replaceOnce(
      source,
      "import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';",
      "import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';\nimport { AppIcon } from '@/components/art/AppIcon';",
      'scratchpad live icon import',
    );
  }

  if (!source.includes("import { usePartnerPresence } from '@/hooks/usePartnerPresence';")) {
    source = replaceOnce(
      source,
      "import { useWorkspace } from '@/providers/WorkspaceProvider';",
      "import { useWorkspace } from '@/providers/WorkspaceProvider';\nimport { usePartnerPresence } from '@/hooks/usePartnerPresence';",
      'scratchpad presence hook import',
    );
  }

  if (!source.includes("import { GentleFloat } from '@/components/motion/Motion';")) {
    source = replaceOnce(
      source,
      "import { participantPalette } from '@/theme/tokens';",
      "import { participantPalette } from '@/theme/tokens';\nimport { GentleFloat } from '@/components/motion/Motion';",
      'scratchpad live motion import',
    );
  }

  source = replaceOnce(
    source,
    `  const [expanded, setExpanded] = useState(!compact);
  const dirtyRef = useRef(false);`,
    `  const [expanded, setExpanded] = useState(!compact);
  const dirtyRef = useRef(false);
  const presenceActive = !compact || expanded;
  const presenceScope = \`scratchpad:\${mode}\`;
  const { partnerName, partnerScope, isHere: partnerSameMode } = usePartnerPresence(presenceScope, presenceActive);
  const partnerInScratchpad = presenceActive && Boolean(partnerScope?.startsWith('scratchpad:'));
  const partnerScratchpadMode: ScratchpadMode | null = partnerScope === 'scratchpad:draw'
    ? 'draw'
    : partnerScope === 'scratchpad:text'
      ? 'text'
      : null;`,
    'scratchpad presence state',
  );

  const headerMarker = `      {compact && !expanded ? (`;
  if (!source.includes("YOU’RE BOTH HERE")) {
    const idx = source.indexOf(headerMarker);
    if (idx < 0) fail('Could not locate scratchpad content start.');

    const presenceUi = `      {presenceActive ? (
        partnerInScratchpad ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing.sm,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: 10,
              borderRadius: theme.radii.md,
              borderWidth: 1,
              borderColor: partnerSameMode ? theme.colors.accent : theme.colors.border,
              backgroundColor: partnerSameMode ? theme.colors.accentSoft : theme.colors.elevatedBackground,
            }}
          >
            <GentleFloat distance={2} duration={1900}>
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: partnerSameMode ? theme.colors.background : theme.colors.accentSoft,
                }}
              >
                <AppIcon
                  name={partnerScratchpadMode === 'draw' ? 'draw' : 'note'}
                  size={16}
                  color={theme.colors.accentStrong}
                />
              </View>
            </GentleFloat>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="caption" tone="accent">{partnerSameMode ? 'YOU’RE BOTH HERE' : 'PARTNER IS HERE'}</AppText>
              <AppText variant="bodySmall">
                {partnerSameMode
                  ? mode === 'draw'
                    ? \`You and \${partnerName} both have the drawing open ♥\`
                    : \`You and \${partnerName} both have the note open ♥\`
                  : partnerScratchpadMode === 'draw'
                    ? \`\${partnerName} has the drawing open ♥\`
                    : \`\${partnerName} has the note open ♥\`}
              </AppText>
            </View>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.textMuted }} />
            <AppText variant="caption" tone="muted">Live presence appears when you both open this scratchpad.</AppText>
          </View>
        )
      ) : null}

`;
    source = source.slice(0, idx) + presenceUi + source.slice(idx);
    console.log('Added contextual scratchpad presence UI.');
  }

  write(rel, source);
}

// -----------------------------------------------------------------------------
// Audit
// -----------------------------------------------------------------------------

const audits = [
  ['src/hooks/usePartnerPresence.ts', [
    'export function usePartnerPresence(scope: string, active = true)',
    'const releasePresence = active ? realtimeClient.claimPresence(scope)',
    'partnerScope,',
  ]],
  ['src/components/dashboard/SharedScratchpadCard.tsx', [
    "const presenceScope = `scratchpad:${mode}`;",
    'usePartnerPresence(presenceScope, presenceActive)',
    "partnerScope?.startsWith('scratchpad:')",
    "partnerScope === 'scratchpad:draw'",
    'YOU’RE BOTH HERE',
    'has the drawing open ♥',
    'has the note open ♥',
    'Live presence appears when you both open this scratchpad.',
  ]],
];

for (const [rel, markers] of audits) {
  const source = read(rel);
  for (const marker of markers) {
    if (!source.includes(marker)) fail(`Post-apply audit missing "${marker}" in ${rel}`);
  }
}

console.log('D12 Live Scratchpad audit clean.');

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

console.log('\nD12 Live Scratchpad applied successfully.');
console.log('All requested validation checks passed.');
console.log('No migration is required.');
