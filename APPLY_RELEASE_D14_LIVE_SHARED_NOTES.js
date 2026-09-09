const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();
const rel = 'src/app/features/notes.tsx';
const file = path.join(root, 'src', 'app', 'features', 'notes.tsx');

function fail(message) {
  console.error(`\nD14 Live Shared Notes FAILED: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(file)) {
  fail(`Missing ${rel}. Run this from the Togetherly project root.`);
}

let source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const baseline = [
  'export default function NotesScreen()',
  "useRealtimeRefresh('notes', refresh)",
  'const selectedNote = selectedId ? notes.find',
  '<RecordViewSheet visible={!!viewTarget}',
  'updatedAt: selectedUpdatedAt ?? undefined',
];

for (const marker of baseline) {
  if (!source.includes(marker)) fail(`Unexpected Notes baseline; missing "${marker}".`);
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
  "import { IconButton } from '@/components/common/IconButton';",
  "import { IconButton } from '@/components/common/IconButton';\nimport { AppIcon } from '@/components/art/AppIcon';\nimport { GentleFloat } from '@/components/motion/Motion';",
  'note presence visual imports',
);

replaceOnce(
  "import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';",
  "import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';\nimport { usePartnerPresence } from '@/hooks/usePartnerPresence';",
  'note presence hook import',
);

// Local helper component.
replaceOnce(
`const noteTools = [
  { icon: 'draw', title: 'Shared scratchpad', subtitle: 'Quick, shared and intentionally unorganised', href: '/features/scratchpad' },
] as const;`,
`const noteTools = [
  { icon: 'draw', title: 'Shared scratchpad', subtitle: 'Quick, shared and intentionally unorganised', href: '/features/scratchpad' },
] as const;

function SharedNotePresence({
  partnerName,
  partnerMode,
}: {
  partnerName: string;
  partnerMode: 'view' | 'edit';
}) {
  const theme = useAppTheme();
  return (
    <Card
      tone="accent"
      participantColor="both"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.md,
      }}
    >
      <GentleFloat distance={2} duration={1900}>
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.accentSoft,
            borderWidth: 1,
            borderColor: theme.colors.accent,
          }}
        >
          <AppIcon name={partnerMode === 'edit' ? 'note' : 'heart'} size={18} color={theme.colors.accentStrong} />
        </View>
      </GentleFloat>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="caption" tone="accent">YOU’RE BOTH IN THIS NOTE</AppText>
        <AppText variant="bodySmall">
          {partnerMode === 'edit'
            ? \`\${partnerName} is editing this shared note ♥\`
            : \`\${partnerName} has this shared note open ♥\`}
        </AppText>
      </View>
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: theme.colors.accentStrong,
        }}
      />
    </Card>
  );
}`,
  'shared note presence component',
);

// Record-specific, privacy-aware presence state.
replaceOnce(
`  const selectedNote = selectedId ? notes.find((note) => note.id === selectedId) ?? null : null;
  const canMakePrivate = !selectedNote || selectedNote.creator_id === profile?.id;`,
`  const selectedNote = selectedId ? notes.find((note) => note.id === selectedId) ?? null : null;
  const canMakePrivate = !selectedNote || selectedNote.creator_id === profile?.id;

  const editingSharedNote = Boolean(
    composerOpen &&
    selectedNote &&
    selectedNote.visibility === 'shared' &&
    visibility === 'shared',
  );
  const presenceNote = editingSharedNote
    ? selectedNote
    : viewTarget?.visibility === 'shared'
      ? viewTarget
      : null;
  const notePresenceMode: 'view' | 'edit' = editingSharedNote ? 'edit' : 'view';
  const notePresenceScope = presenceNote ? \`note:\${presenceNote.id}:\${notePresenceMode}\` : 'note:none';
  const {
    partnerName: livePartnerName,
    partnerScope,
  } = usePartnerPresence(notePresenceScope, Boolean(presenceNote));
  const partnerOnSameNote = Boolean(
    presenceNote &&
    partnerScope?.startsWith(\`note:\${presenceNote.id}:\`),
  );
  const partnerNoteMode: 'view' | 'edit' = partnerScope?.endsWith(':edit') ? 'edit' : 'view';`,
  'privacy-aware record-specific note presence',
);

// Presence inside the edit sheet, before first field.
replaceOnce(
`    <CollapsibleComposer title={selectedId ? 'Edit note' : 'Notes'} subtitle={selectedId ? 'Private notes remain private to their creator.' : \`\${notes.length} saved\`} open={composerOpen} actionLabel="New note" closeLabel={selectedId ? 'Cancel edit' : 'Close'} tone={visibility === 'private' ? 'secondary' : 'accent'} style={{ marginBottom: theme.spacing.lg }} onToggle={() => composerOpen ? resetEditor() : setComposerOpen(true)}>
      <FormField label="What is this note about?"`,
`    <CollapsibleComposer title={selectedId ? 'Edit note' : 'Notes'} subtitle={selectedId ? 'Private notes remain private to their creator.' : \`\${notes.length} saved\`} open={composerOpen} actionLabel="New note" closeLabel={selectedId ? 'Cancel edit' : 'Close'} tone={visibility === 'private' ? 'secondary' : 'accent'} style={{ marginBottom: theme.spacing.lg }} onToggle={() => composerOpen ? resetEditor() : setComposerOpen(true)}>
      {editingSharedNote && partnerOnSameNote ? <SharedNotePresence partnerName={livePartnerName} partnerMode={partnerNoteMode} /> : null}
      <FormField label="What is this note about?"`,
  'presence inside note editor',
);

// Presence inside the record view sheet.
replaceOnce(
`      {viewTarget ? <View style={{ gap: theme.spacing.md }}>
        <ParticipantAttribution userId={viewTarget.creator_id}`,
`      {viewTarget ? <View style={{ gap: theme.spacing.md }}>
        {viewTarget.visibility === 'shared' && presenceNote?.id === viewTarget.id && partnerOnSameNote
          ? <SharedNotePresence partnerName={livePartnerName} partnerMode={partnerNoteMode} />
          : null}
        <ParticipantAttribution userId={viewTarget.creator_id}`,
  'presence inside note view sheet',
);

fs.writeFileSync(file, source.replace(/\n/g, '\r\n'), 'utf8');
console.log(`Wrote ${rel}`);

// Audit.
const finalSource = fs.readFileSync(file, 'utf8');
const audits = [
  'function SharedNotePresence({',
  'YOU’RE BOTH IN THIS NOTE',
  'is editing this shared note ♥',
  'has this shared note open ♥',
  "selectedNote.visibility === 'shared'",
  "visibility === 'shared'",
  "viewTarget?.visibility === 'shared'",
  "const notePresenceScope = presenceNote ? `note:${presenceNote.id}:${notePresenceMode}` : 'note:none';",
  'usePartnerPresence(notePresenceScope, Boolean(presenceNote))',
  "partnerScope?.startsWith(`note:${presenceNote.id}:`)",
  "partnerScope?.endsWith(':edit')",
];

for (const marker of audits) {
  if (!finalSource.includes(marker)) fail(`Post-apply audit missing marker: ${marker}`);
}

console.log('D14 Live Shared Notes audit clean.');

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

console.log('\nD14 Live Shared Notes applied successfully.');
console.log('All requested validation checks passed.');
console.log('No migration is required.');
