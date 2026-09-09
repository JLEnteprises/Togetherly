const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const rel = 'src/app/features/games/[id].tsx';
const file = path.join(root, 'src', 'app', 'features', 'games', '[id].tsx');

function fail(message) {
  console.error(`\nD13 Live Game Rooms FAILED: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(file)) {
  fail(`Missing ${rel}. Run this from the Togetherly project root.`);
}

let source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const baseline = [
  'export default function GameDetailScreen()',
  "useRealtimeRefresh('games', refresh);",
  "game.game_type === 'draw_together'",
  'GAME COMPLETE',
];
for (const marker of baseline) {
  if (!source.includes(marker)) fail(`Unexpected game detail baseline; missing "${marker}".`);
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

// Imports.
replaceOnce(
  "import { BackHeader } from '@/components/common/BackHeader';",
  "import { BackHeader } from '@/components/common/BackHeader';\nimport { AppIcon } from '@/components/art/AppIcon';\nimport { GentleFloat } from '@/components/motion/Motion';",
  'game room presence visual imports',
);

replaceOnce(
  "import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';",
  "import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';\nimport { usePartnerPresence } from '@/hooks/usePartnerPresence';",
  'game room presence hook import',
);

// Helper copy.
replaceOnce(
`function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }`,
`function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }

function liveRoomCopy(gameType: GameSession['game_type']) {
  if (gameType === 'draw_together') return 'You both have the canvas open ♥';
  if (gameType === 'hangman') return 'You’re both watching the same puzzle ♥';
  if (gameType === 'this_or_that') return 'You’re both in this round ♥';
  if (gameType === 'know_me') return 'You’re both in this question ♥';
  if (gameType === 'bingo') return 'You’re both in the same game room ♥';
  return 'You’re both here ♥';
}`,
  'game-specific live room copy',
);

// Presence hook state.
replaceOnce(
`  const [game, setGame] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);`,
`  const [game, setGame] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const gamePresenceScope = id ? \`game:\${id}\` : 'game:loading';
  const { hasPartner, partnerName: livePartnerName, isHere: partnerInRoom } = usePartnerPresence(gamePresenceScope, Boolean(id));`,
  'game room presence state',
);

// Live room UI after header.
const header = `      <BackHeader eyebrow="Play Together" title={game.title} subtitle={game.reward ? \`Reward: \${game.reward}\` : 'Just for bragging rights.'} />`;
if (!source.includes('LIVE GAME ROOM')) {
  const idx = source.indexOf(header);
  if (idx < 0) fail('Could not locate the game header.');
  const insertion = `${header}
      {hasPartner ? (
        <Card
          tone={partnerInRoom ? 'accent' : 'secondary'}
          participantColor={partnerInRoom ? 'both' : undefined}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            marginBottom: theme.spacing.lg,
            paddingVertical: theme.spacing.md,
          }}
        >
          <GentleFloat distance={partnerInRoom ? 3 : 1} duration={partnerInRoom ? 1800 : 2600}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 15,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: partnerInRoom ? theme.colors.accentSoft : theme.colors.elevatedBackground,
                borderWidth: 1,
                borderColor: partnerInRoom ? theme.colors.accent : theme.colors.border,
              }}
            >
              <AppIcon
                name={partnerInRoom ? 'heart' : 'game'}
                size={19}
                color={partnerInRoom ? theme.colors.accentStrong : theme.colors.textMuted}
              />
            </View>
          </GentleFloat>

          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="caption" tone={partnerInRoom ? 'accent' : 'muted'}>
              {partnerInRoom ? 'LIVE GAME ROOM' : 'WAITING IN THIS GAME'}
            </AppText>
            <AppText variant="bodySmall" tone={partnerInRoom ? 'primary' : 'secondary'}>
              {partnerInRoom
                ? liveRoomCopy(game.game_type)
                : game.status === 'active'
                  ? \`Waiting for \${livePartnerName} to open this game…\`
                  : \`\${livePartnerName} isn’t viewing this game right now.\`}
            </AppText>
          </View>

          <View
            accessibilityLabel={partnerInRoom ? \`\${livePartnerName} is viewing this game\` : \`\${livePartnerName} is not viewing this game\`}
            style={{
              width: 9,
              height: 9,
              borderRadius: 5,
              backgroundColor: partnerInRoom ? theme.colors.accentStrong : theme.colors.textMuted,
            }}
          />
        </Card>
      ) : null}`;
  source = source.slice(0, idx) + insertion + source.slice(idx + header.length);
  console.log('Added live game room presence card.');
}

// Slightly enrich the "watch guesses live" message so it is accurate even if partner is absent.
// This preserves the actual game behavior and only improves copy.
replaceOnce(
  `You set the challenge. Watch {partnerName}’s guesses appear live.`,
  `You set the challenge. {partnerName}’s guesses will appear here as they play.`,
  'hangman live-copy accuracy',
);

fs.writeFileSync(file, source.replace(/\n/g, '\r\n'), 'utf8');
console.log(`Wrote ${rel}`);

const finalSource = fs.readFileSync(file, 'utf8');
const audits = [
  "const gamePresenceScope = id ? `game:${id}` : 'game:loading';",
  'usePartnerPresence(gamePresenceScope, Boolean(id))',
  'LIVE GAME ROOM',
  'WAITING IN THIS GAME',
  'You both have the canvas open ♥',
  'You’re both watching the same puzzle ♥',
  'You’re both in this round ♥',
  'You’re both in this question ♥',
  'You’re both in the same game room ♥',
  'is viewing this game',
];

for (const marker of audits) {
  if (!finalSource.includes(marker)) fail(`Post-apply audit missing marker: ${marker}`);
}

console.log('D13 Live Game Rooms audit clean.');

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

console.log('\nD13 Live Game Rooms applied successfully.');
console.log('All requested validation checks passed.');
console.log('No migration is required.');
