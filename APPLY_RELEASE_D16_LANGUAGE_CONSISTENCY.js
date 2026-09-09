const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.cwd();

function fail(message) {
  console.error(`\nD16 Language Consistency FAILED: ${message}`);
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

function replaceOnce(source, oldText, newText, label, required = true) {
  if (source.includes(newText)) {
    console.log(`Already good: ${label}`);
    return source;
  }
  const first = source.indexOf(oldText);
  if (first < 0) {
    if (!required) {
      console.log(`Skipped optional patch: ${label}`);
      return source;
    }
    fail(`Could not find expected source for: ${label}`);
  }
  if (source.indexOf(oldText, first + oldText.length) >= 0) {
    fail(`Multiple matches found for: ${label}`);
  }
  return source.slice(0, first) + newText + source.slice(first + oldText.length);
}

// -----------------------------------------------------------------------------
// Tasks
// -----------------------------------------------------------------------------
{
  const rel = 'src/app/features/tasks.tsx';
  let source = read(rel);

  const baseline = [
    'title="Shared tasks"',
    'SHARED TASKS',
    'actionLabel="New task"',
    "'Manage this task'",
  ];
  for (const marker of baseline) {
    if (!source.includes(marker)) fail(`Unexpected Tasks baseline; missing "${marker}".`);
  }

  source = replaceOnce(
    source,
    '<BackHeader eyebrow="Plan" title="Shared tasks" subtitle="Tasks, deadlines and shared to-dos." />',
    '<BackHeader eyebrow="Plan" title="Shared tasks" subtitle="What needs doing, who’s got it, and what matters next." />',
    'Tasks header copy',
  );

  source = replaceOnce(
    source,
    '<View><AppText variant="caption" tone="accent">SHARED TASKS</AppText><AppText variant="pageTitle">{tasks.length - completed} remaining</AppText></View>',
    '<View><AppText variant="caption" tone="accent">WHAT NEEDS DOING</AppText><AppText variant="pageTitle">{tasks.length - completed} remaining</AppText></View>',
    'Tasks hero language',
  );

  source = replaceOnce(
    source,
    "title={editingId ? 'Edit task' : 'Tasks'}",
    "title={editingId ? 'Edit task' : 'Add something to do'}",
    'Tasks composer title',
  );

  source = replaceOnce(
    source,
    "subtitle={editingId ? undefined : `${tasks.length - completed} open`}",
    "subtitle={editingId ? undefined : `${tasks.length - completed} still open`}",
    'Tasks composer subtitle',
  );

  source = replaceOnce(
    source,
    'actionLabel="New task"',
    'actionLabel="Add task"',
    'Tasks composer action',
  );

  source = replaceOnce(
    source,
    "<AppText variant=\"caption\" tone=\"secondary\">SHOW</AppText>",
    "<AppText variant=\"caption\" tone=\"secondary\">WHAT</AppText>",
    'Tasks filter what label',
  );

  source = replaceOnce(
    source,
    "<AppText variant=\"caption\" tone=\"secondary\">ASSIGNED</AppText>",
    "<AppText variant=\"caption\" tone=\"secondary\">WHO</AppText>",
    'Tasks filter who label',
  );

  source = replaceOnce(
    source,
    "Alert.alert(task.title, 'Manage this task', [",
    "Alert.alert(task.title, 'Choose what to do.', [",
    'Tasks action menu language',
  );

  write(rel, source);
}

// -----------------------------------------------------------------------------
// Goals
// -----------------------------------------------------------------------------
{
  const rel = 'src/app/features/goals.tsx';
  let source = read(rel);

  const baseline = [
    'title="Shared goals"',
    'actionLabel="New goal"',
    "'Manage this goal'",
    "'Create goal'",
  ];
  for (const marker of baseline) {
    if (!source.includes(marker)) fail(`Unexpected Goals baseline; missing "${marker}".`);
  }

  source = replaceOnce(
    source,
    '<BackHeader eyebrow="Plan" title="Shared goals" subtitle="Things you’re working toward together." />',
    '<BackHeader eyebrow="Plan" title="Shared goals" subtitle="The things you’re building toward, little by little." />',
    'Goals header copy',
  );

  source = replaceOnce(
    source,
    'actionLabel="New goal"',
    'actionLabel="Add goal"',
    'Goals composer action',
  );

  source = replaceOnce(
    source,
    "editingId ? 'Save goal' : 'Create goal'",
    "editingId ? 'Save changes' : 'Add goal'",
    'Goals primary save language',
  );

  source = replaceOnce(
    source,
    'actionLabel="Create a goal"',
    'actionLabel="Add a goal"',
    'Goals empty-state action',
  );

  source = replaceOnce(
    source,
    "Alert.alert(goal.title, 'Manage this goal', actions);",
    "Alert.alert(goal.title, 'Choose what to do.', actions);",
    'Goals action menu language',
  );

  source = replaceOnce(
    source,
    'Progress is changed through Add progress so the contribution history always matches the total.',
    'Use Add progress below so you can both see how the goal moved over time.',
    'Goals progress explanation',
  );

  source = replaceOnce(
    source,
    "Alert.alert(editingId ? 'Couldn’t update goal' : 'Couldn’t create goal', messageFrom(error));",
    "Alert.alert(editingId ? 'Couldn’t save changes' : 'Couldn’t add goal', messageFrom(error));",
    'Goals save error language',
  );

  write(rel, source);
}

// -----------------------------------------------------------------------------
// Lists
// -----------------------------------------------------------------------------
{
  const rel = 'src/app/features/lists.tsx';
  let source = read(rel);

  const baseline = [
    'title="Shared lists"',
    'actionLabel="New list"',
    "'Create list'",
    "'Couldn’t create list'",
  ];
  for (const marker of baseline) {
    if (!source.includes(marker)) fail(`Unexpected Lists baseline; missing "${marker}".`);
  }

  source = replaceOnce(
    source,
    '<BackHeader eyebrow="Plan" title="Shared lists" subtitle="Shopping, packing and shared lists." />',
    '<BackHeader eyebrow="Plan" title="Shared lists" subtitle="Groceries, packing, ideas — anything easier when it lives in one place together." />',
    'Lists header copy',
  );

  source = replaceOnce(
    source,
    'actionLabel="New list"',
    'actionLabel="Add list"',
    'Lists composer action',
  );

  source = replaceOnce(
    source,
    "label={busy ? 'Creating…' : 'Create list'}",
    "label={busy ? 'Adding…' : 'Add list'}",
    'Lists primary action',
  );

  source = replaceOnce(
    source,
    'actionLabel="Create a list"',
    'actionLabel="Add a list"',
    'Lists empty-state action',
  );

  source = replaceOnce(
    source,
    "Alert.alert('Couldn’t create list', messageFrom(error));",
    "Alert.alert('Couldn’t add list', messageFrom(error));",
    'Lists error language',
  );

  source = replaceOnce(
    source,
    "{list.completed_count ?? 0}/{list.item_count ?? 0} completed",
    "{list.completed_count ?? 0} of {list.item_count ?? 0} done",
    'Lists progress language',
  );

  write(rel, source);
}

// -----------------------------------------------------------------------------
// Availability
// -----------------------------------------------------------------------------
{
  const rel = 'src/app/features/availability.tsx';
  let source = read(rel);

  const baseline = [
    'title="Schedules & overlap"',
    "'Manage this schedule window'",
    'actionLabel="Add window"',
    'Add schedule window',
  ];
  for (const marker of baseline) {
    if (!source.includes(marker)) fail(`Unexpected Availability baseline; missing "${marker}".`);
  }

  source = replaceOnce(
    source,
    '<BackHeader eyebrow="Plan" title="Schedules & overlap" subtitle="Free windows create availability. Work, Sleep and Busy time block it automatically." />',
    '<BackHeader eyebrow="Plan" title="When are we both free?" subtitle="Add the parts of your usual week that are free, busy, work or sleep. Togetherly finds the overlap." />',
    'Availability header copy',
  );

  source = replaceOnce(
    source,
    "function openScheduleMenu(item: ScheduleWindow) { Alert.alert(item.label, 'Manage this schedule window', [{ text: 'Edit window', onPress: () => beginEdit(item) }, { text: 'Delete window', style: 'destructive', onPress: () => setDeleteTarget(item) }, { text: 'Cancel', style: 'cancel' }]); }",
    "function openScheduleMenu(item: ScheduleWindow) { Alert.alert(item.label, 'Choose what to do.', [{ text: 'Edit time', onPress: () => beginEdit(item) }, { text: 'Delete time', style: 'destructive', onPress: () => setDeleteTarget(item) }, { text: 'Cancel', style: 'cancel' }]); }",
    'Availability action menu language',
  );

  source = replaceOnce(
    source,
    "title={editing ? 'Edit schedule window' : 'My recurring schedule'}",
    "title={editing ? 'Edit this time' : 'My usual week'}",
    'Availability composer title',
  );

  source = replaceOnce(
    source,
    'subtitle="Your schedule"',
    'subtitle="The times that usually repeat each week"',
    'Availability composer subtitle',
  );

  source = replaceOnce(
    source,
    'actionLabel="Add window"',
    'actionLabel="Add time"',
    'Availability composer action',
  );

  source = replaceOnce(
    source,
    "label={editing ? 'Save changes' : 'Add schedule window'}",
    "label={editing ? 'Save changes' : 'Add time'}",
    'Availability primary action',
  );

  source = replaceOnce(
    source,
    'title="No schedule yet" body="Add at least one Free window. Work, Sleep and Busy windows will subtract from it." actionLabel="Add a window"',
    'title="Add your usual free time" body="Start with one Free time. Work, Sleep and Busy times can narrow it down from there." actionLabel="Add time"',
    'Availability empty state',
  );

  source = replaceOnce(
    source,
    "reason || 'No shared free-time overlap found in the next two weeks.'",
    "reason || 'No time you’re both free showed up in the next two weeks.'",
    'Availability no-overlap copy',
  );

  source = replaceOnce(
    source,
    "hasn’t added schedule windows yet.",
    "hasn’t added their usual times yet.",
    'Availability partner empty copy',
  );

  source = replaceOnce(
    source,
    'title="Delete schedule window?"',
    'title="Delete this time?"',
    'Availability delete confirmation title',
  );

  write(rel, source);
}

// -----------------------------------------------------------------------------
// Notes: use the same action-menu language as Tasks / Goals / Availability.
// -----------------------------------------------------------------------------
{
  const rel = 'src/app/features/notes.tsx';
  let source = read(rel);

  if (!source.includes("'Manage this note'") && !source.includes("'Choose what to do.'")) {
    fail('Unexpected Notes baseline; could not find note action-menu language.');
  }

  source = replaceOnce(
    source,
    "Alert.alert(note.title, 'Manage this note', [",
    "Alert.alert(note.title, 'Choose what to do.', [",
    'Notes action menu language',
    false,
  );

  source = replaceOnce(
    source,
    'actionLabel="New note"',
    'actionLabel="Add note"',
    'Notes composer action',
    false,
  );

  write(rel, source);
}

// -----------------------------------------------------------------------------
// Audit
// -----------------------------------------------------------------------------
const audits = [
  ['src/app/features/tasks.tsx', [
    'What needs doing, who’s got it, and what matters next.',
    'WHAT NEEDS DOING',
    "title={editingId ? 'Edit task' : 'Add something to do'}",
    'actionLabel="Add task"',
    "'Choose what to do.'",
  ]],
  ['src/app/features/goals.tsx', [
    'The things you’re building toward, little by little.',
    'actionLabel="Add goal"',
    "editingId ? 'Save changes' : 'Add goal'",
    'Use Add progress below so you can both see how the goal moved over time.',
  ]],
  ['src/app/features/lists.tsx', [
    'anything easier when it lives in one place together.',
    'actionLabel="Add list"',
    "label={busy ? 'Adding…' : 'Add list'}",
    ' of {list.item_count ?? 0} done',
  ]],
  ['src/app/features/availability.tsx', [
    'title="When are we both free?"',
    "title={editing ? 'Edit this time' : 'My usual week'}",
    'actionLabel="Add time"',
    "label={editing ? 'Save changes' : 'Add time'}",
    'No time you’re both free showed up in the next two weeks.',
  ]],
  ['src/app/features/notes.tsx', [
    "'Choose what to do.'",
  ]],
];

for (const [rel, markers] of audits) {
  const finalSource = read(rel);
  for (const marker of markers) {
    if (!finalSource.includes(marker)) fail(`Post-apply audit missing "${marker}" in ${rel}`);
  }
}

console.log('D16 Language Consistency audit clean.');

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

console.log('\nD16 Language Consistency applied successfully.');
console.log('All requested validation checks passed.');
console.log('No migration is required.');
