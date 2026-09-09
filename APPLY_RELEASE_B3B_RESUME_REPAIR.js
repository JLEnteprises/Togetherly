const fs = require('fs');
const path = require('path');

const project = process.cwd();
function p(rel) { return path.join(project, rel); }
function read(rel) {
  const f = p(rel);
  if (!fs.existsSync(f)) throw new Error(`Missing ${rel}. Run this from the Togetherly project root.`);
  return fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
}
function write(rel, text) {
  fs.writeFileSync(p(rel), text.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`Wrote ${rel}`);
}
function ensureImport(rel, statement, anchor) {
  let text = read(rel);
  if (text.includes(statement)) return;
  if (!text.includes(anchor)) throw new Error(`Could not add import to ${rel}`);
  text = text.replace(anchor, `${anchor}\n${statement}`);
  write(rel, text);
}
function replaceOnce(rel, oldText, newText, label) {
  let text = read(rel);
  if (text.includes(newText)) {
    console.log(`Already good ${rel}: ${label}`);
    return;
  }
  const i = text.indexOf(oldText);
  if (i < 0) throw new Error(`Could not safely patch ${rel}: ${label}`);
  if (text.indexOf(oldText, i + oldText.length) >= 0) throw new Error(`Multiple matches in ${rel}: ${label}`);
  text = text.replace(oldText, newText);
  write(rel, text);
}
function insertBefore(rel, marker, addition, alreadyMarker, label) {
  let text = read(rel);
  if (alreadyMarker && text.includes(alreadyMarker)) {
    console.log(`Already good ${rel}: ${label}`);
    return;
  }
  const i = text.indexOf(marker);
  if (i < 0) throw new Error(`Could not find insertion point in ${rel}: ${label}`);
  text = text.slice(0, i) + addition + text.slice(i);
  write(rel, text);
}
function replaceRange(rel, startMarker, endMarker, replacement, label) {
  let text = read(rel);
  if (text.includes(replacement)) {
    console.log(`Already good ${rel}: ${label}`);
    return;
  }
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing start marker in ${rel}: ${label}`);
  const end = text.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Missing end marker in ${rel}: ${label}`);
  text = text.slice(0, start) + replacement + text.slice(end + endMarker.length);
  write(rel, text);
}

// Verify we really are resuming the partial B3B state.
for (const [rel, marker] of [
  ['src/app/features/tasks.tsx', 'setViewTarget(task)'],
  ['src/app/features/notes.tsx', 'openNoteMenu(note)'],
  ['src/app/features/countdowns.tsx', 'Open countdown'],
  ['src/app/features/activities.tsx', 'Open date idea'],
]) {
  if (!read(rel).includes(marker)) {
    throw new Error(`${rel} is not in the expected partial B3B state. Missing marker: ${marker}`);
  }
}

// ------------------------------------------------------------
// ACTIVITIES: the earlier installer expected "Delete idea?" but
// this source actually says "Delete activity?". Insert by stable
// ConfirmDialog marker instead of title text.
// ------------------------------------------------------------
insertBefore(
  'src/app/features/activities.tsx',
  `    <ConfirmDialog visible={!!deleteTarget}`,
  `    <RecordViewSheet visible={!!viewTarget} onClose={() => setViewTarget(null)} eyebrow="Date idea" title={viewTarget?.title ?? ''}>
      {viewTarget ? <View style={{ gap: theme.spacing.md }}>
        <ParticipantAttribution userId={viewTarget.creator_id} />
        {viewTarget.description ? <AppText tone="secondary">{viewTarget.description}</AppText> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <TagChip subtle label={viewTarget.cost_level.toUpperCase()} />
          <TagChip subtle label={durationLabel(viewTarget.duration_minutes).toUpperCase()} />
          <TagChip subtle label={viewTarget.location_type.toUpperCase()} />
          <TagChip subtle label={viewTarget.environment.toUpperCase()} />
          <TagChip subtle label={viewTarget.mood.toUpperCase()} />
          <TagChip subtle label={viewTarget.time_of_day.toUpperCase()} />
          {viewTarget.location ? <TagChip subtle label={viewTarget.location.toUpperCase()} /> : null}
          {viewTarget.rating ? <TagChip subtle label={\`\${viewTarget.rating}/5 ★\`} /> : null}
          {viewTarget.kid_friendly ? <TagChip subtle label="KID FRIENDLY" /> : null}
          {viewTarget.booking_required ? <TagChip subtle label="BOOKING NEEDED" /> : null}
          {(viewTarget.tags ?? []).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}
        </View>
      </View> : null}
    </RecordViewSheet>
`,
  `<RecordViewSheet visible={!!viewTarget}`,
  'activity detail sheet'
);

// ------------------------------------------------------------
// GOALS
// ------------------------------------------------------------
ensureImport(
  'src/app/features/goals.tsx',
  `import { RecordViewSheet } from '@/components/common/RecordViewSheet';`,
  `import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';`
);

replaceOnce(
  'src/app/features/goals.tsx',
  `const params = useLocalSearchParams<{ focus?: string }>();`,
  `const params = useLocalSearchParams<{ focus?: string; edit?: string }>();`,
  'goal route params'
);

replaceOnce(
  'src/app/features/goals.tsx',
  `  const [deleteTarget, setDeleteTarget] = useState<CoupleGoal | null>(null);`,
  `  const [viewTarget, setViewTarget] = useState<CoupleGoal | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CoupleGoal | null>(null);`,
  'goal view state'
);

replaceRange(
  'src/app/features/goals.tsx',
  `  useEffect(() => {
    if (!params.focus || editingId === params.focus || !goals.length) return;
    const focused = goals.find((goal) => goal.id === params.focus); if (focused) beginEdit(focused);
  }, [params.focus, goals]);`,
  `  async function saveGoal() {`,
  `  useEffect(() => {
    if (!params.focus || !goals.length) return;
    const focused = goals.find((goal) => goal.id === params.focus); if (focused) setViewTarget(focused);
  }, [params.focus, goals]);
  useEffect(() => {
    if (!params.edit || editingId === params.edit || !goals.length) return;
    const target = goals.find((goal) => goal.id === params.edit); if (target) beginEdit(target);
  }, [params.edit, editingId, goals]);

  async function saveGoal() {`,
  'goal focus/edit semantics'
);

replaceOnce(
  'src/app/features/goals.tsx',
  `<View style={{ flex: 1, gap: 5 }}><AppText variant="cardTitle">{goal.title}</AppText><ParticipantAttribution userId={goal.creator_id} />{goal.description ? <AppText variant="bodySmall" tone="secondary" numberOfLines={2}>{goal.description}</AppText> : null}</View>`,
  `<Pressable accessibilityRole="button" accessibilityLabel={\`Open goal \${goal.title}\`} onPress={() => setViewTarget(goal)} style={({ pressed }) => ({ flex: 1, gap: 5, opacity: pressed ? 0.76 : 1 })}><AppText variant="cardTitle">{goal.title}</AppText><ParticipantAttribution userId={goal.creator_id} />{goal.description ? <AppText variant="bodySmall" tone="secondary" numberOfLines={2}>{goal.description}</AppText> : <AppText variant="bodySmall" tone="muted">Tap to view this goal.</AppText>}</Pressable>`,
  'goal tap views'
);

insertBefore(
  'src/app/features/goals.tsx',
  `      <ConfirmDialog visible={!!deleteTarget}`,
  `      <RecordViewSheet visible={!!viewTarget} onClose={() => setViewTarget(null)} eyebrow="Shared goal" title={viewTarget?.title ?? ''}>
        {viewTarget ? <View style={{ gap: theme.spacing.md }}>
          <ParticipantAttribution userId={viewTarget.creator_id} />
          {viewTarget.description ? <AppText tone="secondary">{viewTarget.description}</AppText> : null}
          <AppText variant="section">{amount(viewTarget, viewTarget.current_value)} / {amount(viewTarget, viewTarget.target_value)}</AppText>
          <ProgressBar value={Math.max(0, Math.min(100, Number(viewTarget.target_value) ? (Number(viewTarget.current_value) / Number(viewTarget.target_value)) * 100 : 0))} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <TagChip subtle label={viewTarget.status.toUpperCase()} />
            {viewTarget.deadline ? <TagChip subtle label={\`BY \${viewTarget.deadline}\`} /> : null}
            {(viewTarget.tags ?? []).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}
          </View>
          {(viewTarget.contributions ?? []).length ? <View style={{ gap: 7 }}><AppText variant="cardTitle">Contribution history</AppText>{(viewTarget.contributions ?? []).slice(-8).reverse().map((entry) => <ParticipantIdentityBadge key={entry.id} userId={entry.creator_id} detail={amount(viewTarget, Number(entry.amount))} compact />)}</View> : null}
        </View> : null}
      </RecordViewSheet>
`,
  `<RecordViewSheet visible={!!viewTarget}`,
  'goal detail sheet'
);

// ------------------------------------------------------------
// CALENDAR
// ------------------------------------------------------------
ensureImport(
  'src/app/features/calendar.tsx',
  `import { RecordViewSheet } from '@/components/common/RecordViewSheet';`,
  `import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';`
);

replaceOnce(
  'src/app/features/calendar.tsx',
  `useLocalSearchParams<{ focus?: string; prefillTitle?: string; prefillDescription?: string; prefillDuration?: string; sourceActivityId?: string }>()`,
  `useLocalSearchParams<{ focus?: string; edit?: string; prefillTitle?: string; prefillDescription?: string; prefillDuration?: string; sourceActivityId?: string }>()`,
  'calendar route params'
);

replaceOnce(
  'src/app/features/calendar.tsx',
  `const [composerOpen, setComposerOpen] = useState(false); const [prefillApplied, setPrefillApplied] = useState(false);`,
  `const [composerOpen, setComposerOpen] = useState(false); const [viewTarget, setViewTarget] = useState<CoupleEvent | null>(null); const [prefillApplied, setPrefillApplied] = useState(false);`,
  'calendar view state'
);

replaceOnce(
  'src/app/features/calendar.tsx',
  `useEffect(() => { if (!params.focus || editingId === params.focus || !events.length) return; const focused = events.find((event) => event.id === params.focus); if (focused) beginEdit(focused); }, [params.focus, events]);`,
  `useEffect(() => { if (!params.focus || !events.length) return; const focused = events.find((event) => event.id === params.focus); if (focused) setViewTarget(focused); }, [params.focus, events]);
  useEffect(() => { if (!params.edit || editingId === params.edit || !events.length) return; const target = events.find((event) => event.id === params.edit); if (target) beginEdit(target); }, [params.edit, editingId, events]);`,
  'calendar focus/edit semantics'
);

replaceOnce(
  'src/app/features/calendar.tsx',
  `onPress={() => beginEdit(event)} style={{ flex: 1, gap: 5 }}`,
  `onPress={() => setViewTarget(event)} style={{ flex: 1, gap: 5 }}`,
  'calendar tap views'
);

insertBefore(
  'src/app/features/calendar.tsx',
  `    <ConfirmDialog visible={!!deleteTarget}`,
  `    <RecordViewSheet visible={!!viewTarget} onClose={() => setViewTarget(null)} eyebrow="Calendar event" title={viewTarget?.title ?? ''}>
      {viewTarget ? <View style={{ gap: theme.spacing.md }}>
        <ParticipantIdentityBadge both={viewTarget.assign_to_both} userId={viewTarget.assigned_user_id} compact />
        <ParticipantAttribution userId={viewTarget.creator_id} />
        <AppText variant="cardTitle">{viewTarget.all_day ? (viewTarget.start_date ?? splitDateTime(viewTarget.start_at).date) : new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(viewTarget.start_at))}</AppText>
        {viewTarget.description ? <AppText tone="secondary">{viewTarget.description}</AppText> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {viewTarget.location ? <TagChip subtle label={viewTarget.location.toUpperCase()} /> : null}
          {viewTarget.all_day ? <TagChip subtle label="ALL DAY" /> : null}
          {viewTarget.recurrence !== 'none' ? <TagChip subtle label={\`↻ \${viewTarget.recurrence.toUpperCase()}\`} /> : null}
          {(viewTarget.tags ?? []).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}
        </View>
      </View> : null}
    </RecordViewSheet>
`,
  `<RecordViewSheet visible={!!viewTarget}`,
  'calendar detail sheet'
);

// Final audit across the whole B3B scope.
const checks = [
  ['src/app/features/tasks.tsx', 'setViewTarget(task)'],
  ['src/app/features/tasks.tsx', 'RecordViewSheet visible={!!viewTarget}'],
  ['src/app/features/notes.tsx', 'openNoteMenu(note)'],
  ['src/app/features/notes.tsx', 'RecordViewSheet visible={!!viewTarget}'],
  ['src/app/features/countdowns.tsx', 'Open countdown'],
  ['src/app/features/countdowns.tsx', 'RecordViewSheet visible={!!viewTarget}'],
  ['src/app/features/activities.tsx', 'Open date idea'],
  ['src/app/features/activities.tsx', 'RecordViewSheet visible={!!viewTarget}'],
  ['src/app/features/goals.tsx', 'Open goal'],
  ['src/app/features/goals.tsx', 'RecordViewSheet visible={!!viewTarget}'],
  ['src/app/features/calendar.tsx', 'setViewTarget(event)'],
  ['src/app/features/calendar.tsx', 'RecordViewSheet visible={!!viewTarget}'],
  ['src/components/common/RecordViewSheet.tsx', 'Use ••• on the item card'],
];

const missing = checks
  .filter(([rel, marker]) => !read(rel).includes(marker))
  .map(([rel, marker]) => `${rel}: missing ${marker}`);

if (missing.length) {
  fs.writeFileSync(p('RELEASE_B3B_RESUME_AUDIT_REMAINING.txt'), missing.join('\r\n') + '\r\n', 'utf8');
  console.error(`B3B resume audit found ${missing.length} issue(s). See RELEASE_B3B_RESUME_AUDIT_REMAINING.txt`);
  process.exitCode = 2;
} else {
  const report = p('RELEASE_B3B_RESUME_AUDIT_REMAINING.txt');
  if (fs.existsSync(report)) fs.unlinkSync(report);
  console.log('B3B resume audit clean.');
}

console.log('');
console.log('B3B resume repair complete.');
console.log('Now run:');
console.log('  npm.cmd run typecheck');
console.log('  npm.cmd --prefix server run typecheck');
console.log('  npm.cmd --prefix server run logic');
