const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RELEASE = 'F2 — Empty-State Coaching';
const MARKER = 'F2_EMPTY_STATE_COACHING';
const root = process.cwd();

function fail(message) {
  console.error(`\n[F2] ${message}`);
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
function restoreEol(source, eol) { return eol === '\r\n' ? source.replace(/\n/g, '\r\n') : source; }
function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Could not find patch anchor: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Patch anchor is ambiguous: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}
function replaceRegexOnce(source, regex, after, label) {
  const matches = [...source.matchAll(regex)];
  if (matches.length !== 1) throw new Error(`${label}: expected exactly one match, found ${matches.length}`);
  return source.replace(regex, after);
}

function patchEmptyState(source) {
  if (source.includes(MARKER)) return source;
  let next = replaceOnce(
    source,
    "import { AppText } from './AppText';\n",
    "import { AppText } from './AppText';\nimport { EyebrowText } from './EyebrowText';\n",
    'EmptyState eyebrow import',
  );
  next = replaceOnce(
    next,
    "export function EmptyState({ icon, title, body, actionLabel, onAction }: { icon: string; title: string; body: string; actionLabel?: string; onAction?: () => void }) {\n",
    `type Props = {\n  icon: string;\n  title: string;\n  body: string;\n  eyebrow?: string;\n  tip?: string;\n  actionLabel?: string;\n  onAction?: () => void;\n  secondaryActionLabel?: string;\n  onSecondaryAction?: () => void;\n};\n\n// ${MARKER}: empty states explain the next useful move instead of only describing missing content.\nexport function EmptyState({ icon, title, body, eyebrow, tip, actionLabel, onAction, secondaryActionLabel, onSecondaryAction }: Props) {\n`,
    'EmptyState props and marker',
  );
  next = replaceOnce(
    next,
`  return (\n    <Card tone="secondary" style={{ alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.xxxl }}>\n      <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 62 }}>\n        {isAppIconName(icon) ? <AppIcon name={icon} size={34} color={theme.colors.accent} /> : <AppText variant="hero" tone="accent">{icon}</AppText>}\n      </View>\n      <View style={{ gap: 5, alignItems: 'center' }}>\n        <AppText variant="section" align="center">{title}</AppText>\n        <AppText tone="secondary" align="center">{body}</AppText>\n      </View>\n      {actionLabel && onAction ? <AppButton compact label={actionLabel} onPress={onAction} /> : null}\n    </Card>\n  );\n`,
`  return (\n    <Card tone="secondary" style={{ alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.xxxl, paddingHorizontal: theme.spacing.xl }}>\n      <View style={{ alignItems: 'center', justifyContent: 'center', minHeight: 62 }}>\n        {isAppIconName(icon) ? <AppIcon name={icon} size={34} color={theme.colors.accent} /> : <AppText variant="hero" tone="accent">{icon}</AppText>}\n      </View>\n      <View style={{ gap: 5, alignItems: 'center' }}>\n        {eyebrow ? <EyebrowText tone="secondary">{eyebrow}</EyebrowText> : null}\n        <AppText variant="section" align="center">{title}</AppText>\n        <AppText tone="secondary" align="center">{body}</AppText>\n      </View>\n      {tip ? (\n        <View style={{ width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm, padding: theme.spacing.md, borderRadius: theme.radii.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.elevatedBackground }}>\n          <AppIcon name="spark" size={17} color={theme.colors.accent} />\n          <View style={{ flex: 1, gap: 2 }}>\n            <AppText variant="caption" tone="accent">TRY THIS</AppText>\n            <AppText variant="bodySmall" tone="secondary">{tip}</AppText>\n          </View>\n        </View>\n      ) : null}\n      {(actionLabel && onAction) || (secondaryActionLabel && onSecondaryAction) ? (\n        <View style={{ width: '100%', gap: theme.spacing.sm }}>\n          {actionLabel && onAction ? <AppButton compact label={actionLabel} onPress={onAction} /> : null}\n          {secondaryActionLabel && onSecondaryAction ? <AppButton compact variant="ghost" label={secondaryActionLabel} onPress={onSecondaryAction} /> : null}\n        </View>\n      ) : null}\n    </Card>\n  );\n`,
    'EmptyState coached layout',
  );
  return next;
}

function patchTasks(source) {
  if (source.includes(MARKER)) return source;
  return replaceRegexOnce(
    source,
    /        \{!loading && visibleTasks\.length === 0 \? <EmptyState icon="task"[^\n]+\/> : null\}\n/g,
`        {/* ${MARKER}: empty task views offer a useful next move or a filter reset. */}\n        {!loading && visibleTasks.length === 0 ? <EmptyState\n          icon="task"\n          eyebrow={tasks.length ? 'THIS VIEW IS CLEAR' : 'A GOOD FIRST STEP'}\n          title={tasks.length ? 'Nothing matches this view' : 'Nothing to do yet'}\n          body={tasks.length ? (statusFilter === 'now' ? 'Nothing needs attention right now.' : 'Your tasks are still here — this view is just filtered down.') : 'Add one real thing you want to remember, share or get done together.'}\n          tip={tasks.length ? 'Show everything again, then narrow it down only when you need to.' : 'Start tiny: “Book dinner”, “Call the hotel”, or “Remember the parcel” is enough.'}\n          actionLabel={tasks.length ? 'Show all tasks' : 'Add a task'}\n          onAction={tasks.length ? () => { setStatusFilter('all'); setAssignmentFilter('all'); } : () => setComposerOpen(true)}\n        /> : null}\n`,
    'Tasks coached empty state',
  );
}

function patchNotes(source) {
  if (source.includes(MARKER)) return source;
  let next = replaceOnce(
    source,
    "import { IconButton } from '@/components/common/IconButton';\n",
    "import { IconButton } from '@/components/common/IconButton';\nimport { EmptyState } from '@/components/common/EmptyState';\n",
    'Notes EmptyState import',
  );
  next = replaceOnce(
    next,
    "      {!loading && visible.length === 0 ? <Card tone=\"secondary\"><AppText tone=\"secondary\">No notes in this view.</AppText></Card> : null}\n",
`      {/* ${MARKER}: Notes uses the same coached empty-state pattern as the rest of Plan. */}\n      {!loading && visible.length === 0 ? <EmptyState\n        icon="note"\n        eyebrow={notes.length ? 'NOTHING IN THIS FILTER' : 'A GOOD FIRST NOTE'}\n        title={notes.length ? 'No notes in this view' : 'Keep the first useful thing'}\n        body={notes.length ? 'Your notes are still saved. This filter just has nothing in it yet.' : 'Notes are for the details you will want to find again — not everything has to become a task.'}\n        tip={notes.length ? 'Go back to All, then pin the notes you reach for most often.' : 'Try flight details, an address, a gift idea, or something your partner said you want to remember.'}\n        actionLabel={notes.length ? 'Show all notes' : 'Add a note'}\n        onAction={notes.length ? () => setFilter('all') : () => setComposerOpen(true)}\n      /> : null}\n`,
    'Notes coached empty state',
  );
  return next;
}

function patchMemories(source) {
  if (source.includes(MARKER)) return source;
  return replaceRegexOnce(
    source,
    /      \{!loading && visible\.length === 0 \? <EmptyState icon="memory"[^\n]+\/> : null\}\n/g,
`      {/* ${MARKER}: memory empties coach the first save and make filtered views recoverable. */}\n      {!loading && visible.length === 0 ? <EmptyState\n        icon="memory"\n        eyebrow={memories.length ? 'NOTHING IN THIS FILTER' : 'START WITH ONE MOMENT'}\n        title={memories.length ? 'No memories in this view' : 'Your story starts here'}\n        body={memories.length ? 'The rest of your story is still saved — this filter just has nothing to show.' : 'Save the ordinary days too. They become the good stuff later.'}\n        tip={memories.length ? 'Show all memories again, then use Milestones only for the moments that really changed your story.' : 'A photo from today, an inside joke, or the first time you did something together is enough.'}\n        actionLabel={memories.length ? 'Show all memories' : 'Add a memory'}\n        onAction={memories.length ? () => setFilter('all') : () => setComposerOpen(true)}\n      /> : null}\n`,
    'Memories coached empty state',
  );
}

function patchActivities(source) {
  if (source.includes(MARKER)) return source;
  return replaceRegexOnce(
    source,
    /      \{!loading && visible\.length === 0 \? <EmptyState icon="date"[^\n]+\/> : null\}\n/g,
`      {/* ${MARKER}: date-idea empties help couples seed the list and recover from narrow filters. */}\n      {!loading && visible.length === 0 ? <EmptyState\n        icon="date"\n        eyebrow={activities.length ? 'NOTHING IN THIS FILTER' : 'SEED THE LIST'}\n        title={activities.length ? 'No ideas in this view' : 'Your next date can start here'}\n        body={activities.length ? 'Your saved ideas are still here — this filter just has no matches yet.' : 'Save a few things you would genuinely enjoy doing together.'}\n        tip={activities.length ? 'Show every idea again and let each of you mark what sounds good. Mutual matches will surface naturally.' : 'Add three different kinds of ideas: one easy, one romantic, and one slightly adventurous.'}\n        actionLabel={activities.length ? 'Show all ideas' : 'Add an idea'}\n        onAction={activities.length ? () => setFilter('all') : () => setComposerOpen(true)}\n      /> : null}\n`,
    'Activities coached empty state',
  );
}

function patchGoals(source) {
  if (source.includes(MARKER)) return source;
  return replaceOnce(
    source,
    "        {!loading && goals.length === 0 ? <EmptyState icon=\"goal\" title=\"Pick something worth moving toward\" body=\"Your first shared goal will show progress from both of you.\" actionLabel=\"Add a goal\" onAction={() => setComposerOpen(true)} /> : null}\n",
`        {/* ${MARKER}: first goals explain what makes a useful shared target. */}\n        {!loading && goals.length === 0 ? <EmptyState icon="goal" eyebrow="ONE THING TO BUILD TOWARD" title="Pick something worth moving toward" body="Your first shared goal will show progress from both of you." tip="Choose something measurable enough to move: a visit fund, savings target, fitness streak, or number of date nights." actionLabel="Add a goal" onAction={() => setComposerOpen(true)} /> : null}\n`,
    'Goals coached empty state',
  );
}

function patchTrips(source) {
  if (source.includes(MARKER)) return source;
  return replaceOnce(
    source,
    "    <View style={{ gap: theme.spacing.md }}>{loading ? <AppText tone=\"muted\">Loading trips…</AppText> : null}{!loading && trips.length === 0 ? <EmptyState icon=\"trip\" title=\"No trips planned yet\" body=\"Create a visit, weekend away, or future holiday.\" actionLabel=\"Plan a trip\" onAction={() => setComposerOpen(true)} /> : null}{trips.map((trip) =>",
`    {/* ${MARKER}: trip empties suggest the smallest useful planning record. */}\n    <View style={{ gap: theme.spacing.md }}>{loading ? <AppText tone="muted">Loading trips…</AppText> : null}{!loading && trips.length === 0 ? <EmptyState icon="trip" eyebrow="PUT THE NEXT PLACE ON THE MAP" title="No trips planned yet" body="Create a visit, weekend away, or future holiday." tip="You only need a name to start. Add dates, flights, hotel details and planning items when they become real." actionLabel="Plan a trip" onAction={() => setComposerOpen(true)} /> : null}{trips.map((trip) =>`,
    'Trips coached empty state',
  );
}

function audit() {
  const failures = [];
  const empty = read('src/components/common/EmptyState.tsx');
  const tasks = read('src/app/features/tasks.tsx');
  const notes = read('src/app/features/notes.tsx');
  const memories = read('src/app/features/memories.tsx');
  const activities = read('src/app/features/activities.tsx');
  const goals = read('src/app/features/goals.tsx');
  const trips = read('src/app/features/trips.tsx');
  for (const [label, source] of [['EmptyState', empty], ['Tasks', tasks], ['Notes', notes], ['Memories', memories], ['Activities', activities], ['Goals', goals], ['Trips', trips]]) {
    if (!source.includes(MARKER)) failures.push(`${label} F2 marker missing`);
  }
  if (!empty.includes('tip?: string')) failures.push('EmptyState tip prop missing');
  if (!empty.includes('secondaryActionLabel?: string')) failures.push('EmptyState secondary action prop missing');
  if (!empty.includes('<EyebrowText tone="secondary">{eyebrow}</EyebrowText>')) failures.push('EmptyState eyebrow treatment missing');
  if (!tasks.includes("'Show all tasks'")) failures.push('Task filter recovery missing');
  if (!notes.includes("'Show all notes'")) failures.push('Notes filter recovery missing');
  if (!memories.includes("'Show all memories'")) failures.push('Memory filter recovery missing');
  if (!activities.includes("'Show all ideas'")) failures.push('Date idea filter recovery missing');
  if (!goals.includes('ONE THING TO BUILD TOWARD')) failures.push('Goal coaching missing');
  if (!trips.includes('PUT THE NEXT PLACE ON THE MAP')) failures.push('Trip coaching missing');

  // Prior-phase guardrails.
  const card = read('src/components/common/Card.tsx');
  const coupleIdentity = read('src/components/common/CoupleIdentitySignature.tsx');
  const eyebrow = read('src/components/common/EyebrowText.tsx');
  const guide = read('src/components/dashboard/FirstTimeGuideCard.tsx');
  if (!card.includes('E1_SHARED_OURS_VISUAL_IDENTITY')) failures.push('E1 marker missing');
  if (!card.includes('E2_PERSONAL_COLOUR_IDENTITY')) failures.push('E2 marker missing');
  if (!coupleIdentity.includes('E3_PAIRED_COUPLE_IDENTITY')) failures.push('E3 marker missing');
  if (!eyebrow.includes('E4_FINAL_VISUAL_CONSISTENCY')) failures.push('E4 marker missing');
  if (!guide.includes('F1_FIRST_TIME_USER_GUIDANCE')) failures.push('F1 marker missing');

  if (failures.length) fail(`Source audit failed:\n- ${failures.join('\n- ')}`);
}

function runNpm(args, label) {
  console.log(`\n[F2] ${label}`);
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
console.log(`[F2] Project root: ${root}`);
if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'server', 'package.json'))) fail('Run this installer from the Togetherly project root.');

const files = [
  ['src/components/common/EmptyState.tsx', patchEmptyState],
  ['src/app/features/tasks.tsx', patchTasks],
  ['src/app/features/notes.tsx', patchNotes],
  ['src/app/features/memories.tsx', patchMemories],
  ['src/app/features/activities.tsx', patchActivities],
  ['src/app/features/goals.tsx', patchGoals],
  ['src/app/features/trips.tsx', patchTrips],
];

const pending = [];
try {
  for (const [relativePath, patch] of files) {
    const { source, eol } = sourceWithEol(relativePath);
    pending.push({ relativePath, eol, source: patch(source) });
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

for (const item of pending) {
  fs.writeFileSync(path.join(root, item.relativePath), restoreEol(item.source, item.eol), 'utf8');
  console.log(`[F2] Updated ${item.relativePath}`);
}

audit();
console.log('[F2] Source audit passed.');
runNpm(['run', 'typecheck'], 'Frontend typecheck');
runNpm(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
runNpm(['--prefix', 'server', 'run', 'logic'], 'Server logic');
console.log('\n[F2] ALL VALIDATIONS PASSED');
console.log('[F2] No migration required. Do not run expo lint.');
