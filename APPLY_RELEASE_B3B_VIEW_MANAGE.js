const fs = require('fs');
const path = require('path');

const project = process.cwd();
function p(rel) { return path.join(project, rel); }
function read(rel) {
  const target = p(rel);
  if (!fs.existsSync(target)) throw new Error(`Missing ${rel}. Run this from the Togetherly project root.`);
  return fs.readFileSync(target, 'utf8').replace(/\r\n/g, '\n');
}
function write(rel, text) {
  const target = p(rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text.replace(/\n/g, '\r\n'), 'utf8');
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
    console.log(`Already patched ${rel}: ${label}`);
    return;
  }
  const first = text.indexOf(oldText);
  if (first < 0) throw new Error(`Could not safely patch ${rel}: ${label}`);
  if (text.indexOf(oldText, first + oldText.length) >= 0) throw new Error(`Multiple matches in ${rel}: ${label}`);
  text = text.replace(oldText, newText);
  write(rel, text);
}
function replaceRange(rel, startMarker, endMarker, replacement, label) {
  let text = read(rel);
  if (text.includes(replacement)) {
    console.log(`Already patched ${rel}: ${label}`);
    return;
  }
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing start marker in ${rel}: ${label}`);
  const end = text.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Missing end marker in ${rel}: ${label}`);
  const after = end + endMarker.length;
  text = text.slice(0, start) + replacement + text.slice(after);
  write(rel, text);
}

// B3A should already be present locally. It does not modify the list screens below.
if (!read('src/components/dashboard/SharedScratchpadCard.tsx').includes('Newer version available')) {
  throw new Error('B3A Scratchpad Safety is not present. Apply/verify B3A before B3B.');
}
write('src/components/common/RecordViewSheet.tsx', "import type { ReactNode } from 'react';\nimport { Modal, Pressable, ScrollView, View } from 'react-native';\nimport { AppIcon } from '@/components/art/AppIcon';\nimport { useAppTheme } from '@/theme/useAppTheme';\nimport { AppText } from './AppText';\n\nexport function RecordViewSheet({\n  visible,\n  onClose,\n  eyebrow,\n  title,\n  subtitle,\n  children,\n}: {\n  visible: boolean;\n  onClose: () => void;\n  eyebrow: string;\n  title: string;\n  subtitle?: string;\n  children?: ReactNode;\n}) {\n  const theme = useAppTheme();\n\n  return (\n    <Modal visible={visible} transparent animationType=\"slide\" onRequestClose={onClose}>\n      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay }}>\n        <Pressable accessibilityRole=\"button\" accessibilityLabel=\"Close details\" onPress={onClose} style={{ flex: 1 }} />\n        <View\n          style={{\n            maxHeight: '88%',\n            borderTopLeftRadius: theme.radii.xl,\n            borderTopRightRadius: theme.radii.xl,\n            borderWidth: 1,\n            borderBottomWidth: 0,\n            borderColor: theme.colors.border,\n            backgroundColor: theme.colors.background,\n            paddingBottom: theme.spacing.xxl,\n          }}\n        >\n          <View style={{ width: 42, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: theme.colors.border, marginTop: 9 }} />\n          <ScrollView\n            keyboardShouldPersistTaps=\"handled\"\n            contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}\n          >\n            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md }}>\n              <View style={{ flex: 1, gap: 4 }}>\n                <AppText variant=\"caption\" tone=\"secondary\">{eyebrow.toUpperCase()}</AppText>\n                <AppText variant=\"pageTitle\">{title}</AppText>\n                {subtitle ? <AppText variant=\"bodySmall\" tone=\"secondary\">{subtitle}</AppText> : null}\n              </View>\n              <Pressable\n                accessibilityRole=\"button\"\n                accessibilityLabel=\"Close details\"\n                hitSlop={10}\n                onPress={onClose}\n                style={({ pressed }) => ({\n                  width: 40,\n                  height: 40,\n                  borderRadius: 20,\n                  alignItems: 'center',\n                  justifyContent: 'center',\n                  backgroundColor: theme.colors.elevatedBackground,\n                  opacity: pressed ? 0.7 : 1,\n                })}\n              >\n                <AppIcon name=\"close\" size={17} color={theme.colors.textSecondary} />\n              </Pressable>\n            </View>\n            {children}\n            <AppText variant=\"caption\" tone=\"muted\">Use \u2022\u2022\u2022 on the item card to edit, manage or delete it.</AppText>\n          </ScrollView>\n        </View>\n      </View>\n    </Modal>\n  );\n}\n");

// ------------------------------------------------------------
// TASKS: tap opens details. Overflow continues to edit/delete.
// Deep-link focus=view; explicit edit=edit.
// ------------------------------------------------------------
ensureImport('src/app/features/tasks.tsx', `import { RecordViewSheet } from '@/components/common/RecordViewSheet';`, `import { DetailsToggle } from '@/components/common/DetailsToggle';`);
replaceOnce(
  'src/app/features/tasks.tsx',
  `const params = useLocalSearchParams<{ focus?: string }>();`,
  `const params = useLocalSearchParams<{ focus?: string; edit?: string }>();`,
  'task route params'
);
replaceOnce(
  'src/app/features/tasks.tsx',
  `  const [deleteTarget, setDeleteTarget] = useState<CoupleTask | null>(null);`,
  `  const [viewTarget, setViewTarget] = useState<CoupleTask | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CoupleTask | null>(null);`,
  'task view state'
);
replaceRange(
  'src/app/features/tasks.tsx',
  `  useEffect(() => {
    if (!params.focus || editingId === params.focus || !tasks.length) return;
    const focused = tasks.find((task) => task.id === params.focus);
    if (focused) beginEdit(focused);
  }, [params.focus, tasks]);`,
  `  async function saveTask() {`,
  `  useEffect(() => {
    if (!params.focus || !tasks.length) return;
    const focused = tasks.find((task) => task.id === params.focus);
    if (focused) setViewTarget(focused);
  }, [params.focus, tasks]);
  useEffect(() => {
    if (!params.edit || editingId === params.edit || !tasks.length) return;
    const target = tasks.find((task) => task.id === params.edit);
    if (target) beginEdit(target);
  }, [params.edit, editingId, tasks]);

  async function saveTask() {`,
  'task focus/edit semantics'
);
replaceOnce(
  'src/app/features/tasks.tsx',
  `onPress={() => beginEdit(task)} style={{ flex: 1, gap: 6 }}`,
  `onPress={() => setViewTarget(task)} style={{ flex: 1, gap: 6 }}`,
  'task tap views'
);
replaceOnce(
  'src/app/features/tasks.tsx',
  `      <ConfirmDialog visible={!!deleteTarget} title="Delete task?"`,
  `      <RecordViewSheet visible={!!viewTarget} onClose={() => setViewTarget(null)} eyebrow="Task" title={viewTarget?.title ?? ''} subtitle={viewTarget ? dueLabel(viewTarget) : undefined}>
        {viewTarget ? <View style={{ gap: theme.spacing.md }}>
          <ParticipantIdentityBadge both={viewTarget.assign_to_both} userId={viewTarget.assignee_id} compact />
          <ParticipantAttribution userId={viewTarget.creator_id} />
          {viewTarget.description ? <AppText tone="secondary">{viewTarget.description}</AppText> : <AppText tone="muted">No extra details.</AppText>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            <TagChip subtle label={viewTarget.status.replace('_', ' ').toUpperCase()} />
            {viewTarget.start_date ? <TagChip subtle label={\`START \${shortDate(viewTarget.start_date).toUpperCase()}\`} /> : null}
            {viewTarget.estimated_minutes ? <TagChip subtle label={\`~\${durationLabel(viewTarget.estimated_minutes).toUpperCase()}\`} /> : null}
            {viewTarget.recurrence !== 'none' ? <TagChip subtle label={\`↻ \${recurrenceLabel(viewTarget.recurrence).toUpperCase()}\`} /> : null}
            {viewTarget.priority !== 'normal' ? <TagChip subtle label={\`\${viewTarget.priority.toUpperCase()} PRIORITY\`} /> : null}
            {(viewTarget.tags ?? []).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}
          </View>
          {(viewTarget.subtasks ?? []).length ? <View style={{ gap: 8 }}>
            <AppText variant="cardTitle">Steps</AppText>
            {(viewTarget.subtasks ?? []).map((step) => <View key={step.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><AppIcon name={step.completed ? 'squareCheck' : 'square'} size={17} color={step.completed ? theme.colors.textMuted : theme.colors.textSecondary} /><View style={{ flex: 1 }}><AppText variant="bodySmall" tone={step.completed ? 'muted' : 'secondary'} style={step.completed ? { textDecorationLine: 'line-through' } : undefined}>{step.title}</AppText>{step.due_date ? <AppText variant="caption" tone="muted">Due {shortDate(step.due_date)}</AppText> : null}</View></View>)}
          </View> : null}
        </View> : null}
      </RecordViewSheet>
      <ConfirmDialog visible={!!deleteTarget} title="Delete task?"`,
  'task detail sheet'
);

// ------------------------------------------------------------
// NOTES: tap=view, •••=manage. Deep links follow the same focus/edit split.
// ------------------------------------------------------------
ensureImport('src/app/features/notes.tsx', `import { RecordViewSheet } from '@/components/common/RecordViewSheet';`, `import { DetailsToggle } from '@/components/common/DetailsToggle';`);
ensureImport('src/app/features/notes.tsx', `import { IconButton } from '@/components/common/IconButton';`, `import { ConfirmDialog } from '@/components/common/ConfirmDialog';`);
replaceOnce(
  'src/app/features/notes.tsx',
  `const params = useLocalSearchParams<{ focus?: string }>();`,
  `const params = useLocalSearchParams<{ focus?: string; edit?: string }>();`,
  'note route params'
);
replaceOnce(
  'src/app/features/notes.tsx',
  `const [composerOpen, setComposerOpen] = useState(false); const [detailsOpen, setDetailsOpen] = useState(false); const [filter, setFilter] = useState<Filter>('all'); const [deleteOpen, setDeleteOpen] = useState(false);`,
  `const [composerOpen, setComposerOpen] = useState(false); const [detailsOpen, setDetailsOpen] = useState(false); const [filter, setFilter] = useState<Filter>('all'); const [viewTarget, setViewTarget] = useState<CoupleNote | null>(null); const [deleteTarget, setDeleteTarget] = useState<CoupleNote | null>(null); const [deleteOpen, setDeleteOpen] = useState(false);`,
  'note view/delete state'
);
replaceOnce(
  'src/app/features/notes.tsx',
  `useEffect(() => { if (!params.focus || selectedId === params.focus || !notes.length) return; const focused = notes.find((note) => note.id === params.focus); if (focused) select(focused); }, [params.focus, notes]);`,
  `useEffect(() => { if (!params.focus || !notes.length) return; const focused = notes.find((note) => note.id === params.focus); if (focused) setViewTarget(focused); }, [params.focus, notes]);
  useEffect(() => { if (!params.edit || selectedId === params.edit || !notes.length) return; const target = notes.find((note) => note.id === params.edit); if (target) select(target); }, [params.edit, notes, selectedId]);`,
  'note focus/edit semantics'
);
replaceOnce(
  'src/app/features/notes.tsx',
  `  async function removeConfirmed() { if (!selectedId) return; setDeleteOpen(false); setBusy(true); try { await deleteNote(selectedId); setNotes((current) => current.filter((note) => note.id !== selectedId)); resetEditor(); } catch (error) { Alert.alert('Couldn’t delete note', messageFrom(error)); } finally { setBusy(false); } }`,
  `  async function removeConfirmed() { const target = deleteTarget ?? selectedNote; if (!target) return; setDeleteOpen(false); setDeleteTarget(null); setBusy(true); try { await deleteNote(target.id); setNotes((current) => current.filter((note) => note.id !== target.id)); if (selectedId === target.id) resetEditor(); if (viewTarget?.id === target.id) setViewTarget(null); } catch (error) { Alert.alert('Couldn’t delete note', messageFrom(error)); } finally { setBusy(false); } }
  function openNoteMenu(note: CoupleNote) {
    Alert.alert(note.title, 'Manage this note', [
      { text: 'Edit note', onPress: () => select(note) },
      { text: 'Delete note', style: 'destructive', onPress: () => { setDeleteTarget(note); setDeleteOpen(true); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }`,
  'note manage menu'
);
replaceOnce(
  'src/app/features/notes.tsx',
  `{selectedId ? <AppButton compact label="Delete" variant="danger" disabled={busy} onPress={() => setDeleteOpen(true)} /> : null}`,
  `{selectedId ? <AppButton compact label="Delete" variant="danger" disabled={busy} onPress={() => { if (selectedNote) setDeleteTarget(selectedNote); setDeleteOpen(true); }} /> : null}`,
  'note editor delete target'
);
replaceRange(
  'src/app/features/notes.tsx',
  `      {visible.map((note) => { const creatorColor = colorForUser(note.creator_id);`,
  `; })}`,
  `      {visible.map((note) => {
        const creatorColor = colorForUser(note.creator_id);
        const updated = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(note.updated_at));
        return <Card key={note.id} participantColor={note.visibility === 'shared' ? 'both' : creatorColor} style={{ gap: theme.spacing.sm, borderColor: selectedId === note.id ? theme.colors.accent : theme.colors.border }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' }}>
            <Pressable accessibilityRole="button" accessibilityLabel={\`Open note \${note.title}\`} onPress={() => setViewTarget(note)} style={({ pressed }) => ({ flex: 1, gap: theme.spacing.sm, opacity: pressed ? 0.76 : 1 })}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}><AppText variant="cardTitle" style={{ flex: 1 }}>{note.pinned ? '✦ ' : ''}{note.title}</AppText><TagChip subtle label={note.visibility === 'private' ? 'PRIVATE' : 'SHARED'} /></View>
              {note.body ? <AppText variant="bodySmall" tone="secondary" numberOfLines={3}>{note.body}</AppText> : null}
              {(note.tags ?? []).length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{(note.tags ?? []).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}</View> : null}
              <ParticipantAttribution userId={note.creator_id} suffix={updated} />
            </Pressable>
            <IconButton icon="overflow" label={\`More actions for \${note.title}\`} onPress={() => openNoteMenu(note)} />
          </View>
        </Card>;
      })}`,
  'note card interaction'
);
replaceOnce(
  'src/app/features/notes.tsx',
  `    <ConfirmDialog visible={deleteOpen} title="Delete note?" body={\`Delete “\${title}”? This can’t be undone.\`}`,
  `    <RecordViewSheet visible={!!viewTarget} onClose={() => setViewTarget(null)} eyebrow={viewTarget?.visibility === 'private' ? 'Private note' : 'Shared note'} title={viewTarget?.title ?? ''}>
      {viewTarget ? <View style={{ gap: theme.spacing.md }}>
        <ParticipantAttribution userId={viewTarget.creator_id} suffix={new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(viewTarget.updated_at))} />
        <AppText tone={viewTarget.body ? 'primary' : 'muted'}>{viewTarget.body || 'This note has no body.'}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <TagChip subtle label={viewTarget.visibility === 'private' ? 'PRIVATE' : 'SHARED'} />
          {viewTarget.pinned ? <TagChip subtle label="PINNED" /> : null}
          {(viewTarget.tags ?? []).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}
        </View>
      </View> : null}
    </RecordViewSheet>
    <ConfirmDialog visible={deleteOpen} title="Delete note?" body={deleteTarget ? \`Delete “\${deleteTarget.title}”? This can’t be undone.\` : \`Delete “\${title}”? This can’t be undone.\`}`,
  'note detail sheet'
);

// ------------------------------------------------------------
// COUNTDOWNS: title/date area opens details; ••• stays manage.
// ------------------------------------------------------------
ensureImport('src/app/features/countdowns.tsx', `import { RecordViewSheet } from '@/components/common/RecordViewSheet';`, `import { DetailsToggle } from '@/components/common/DetailsToggle';`);
replaceOnce(
  'src/app/features/countdowns.tsx',
  `const params = useLocalSearchParams<{ focus?: string }>();`,
  `const params = useLocalSearchParams<{ focus?: string; edit?: string }>();`,
  'countdown route params'
);
replaceOnce(
  'src/app/features/countdowns.tsx',
  `const [busy, setBusy] = useState(false); const [detailsOpen, setDetailsOpen] = useState(false);`,
  `const [busy, setBusy] = useState(false); const [viewTarget, setViewTarget] = useState<CoupleCountdown | null>(null); const [detailsOpen, setDetailsOpen] = useState(false);`,
  'countdown view state'
);
replaceOnce(
  'src/app/features/countdowns.tsx',
  `useEffect(() => { if (!params.focus || editingId === params.focus || !countdowns.length) return; const focused = countdowns.find((item) => item.id === params.focus); if (focused) beginEdit(focused); }, [params.focus, countdowns]);`,
  `useEffect(() => { if (!params.focus || !countdowns.length) return; const focused = countdowns.find((item) => item.id === params.focus); if (focused) setViewTarget(focused); }, [params.focus, countdowns]);
  useEffect(() => { if (!params.edit || editingId === params.edit || !countdowns.length) return; const target = countdowns.find((item) => item.id === params.edit); if (target) beginEdit(target); }, [params.edit, editingId, countdowns]);`,
  'countdown focus/edit semantics'
);
replaceOnce(
  'src/app/features/countdowns.tsx',
  `<View style={{ flex: 1, gap: 5 }}><TagChip subtle label={countdown.type.toUpperCase()} /><AppText variant="section" style={{ marginTop: 3 }}>{countdown.title}</AppText><ParticipantAttribution userId={countdown.creator_id} /><AppText variant="bodySmall" tone="secondary">{formatTarget(countdown.target_at)}</AppText></View>`,
  `<Pressable accessibilityRole="button" accessibilityLabel={\`Open countdown \${countdown.title}\`} onPress={() => setViewTarget(countdown)} style={({ pressed }) => ({ flex: 1, gap: 5, opacity: pressed ? 0.76 : 1 })}><TagChip subtle label={countdown.type.toUpperCase()} /><AppText variant="section" style={{ marginTop: 3 }}>{countdown.title}</AppText><ParticipantAttribution userId={countdown.creator_id} /><AppText variant="bodySmall" tone="secondary">{formatTarget(countdown.target_at)}</AppText></Pressable>`,
  'countdown tap views'
);
replaceOnce(
  'src/app/features/countdowns.tsx',
  `    <ConfirmDialog visible={!!deleteTarget} title="Delete countdown?"`,
  `    <RecordViewSheet visible={!!viewTarget} onClose={() => setViewTarget(null)} eyebrow="Countdown" title={viewTarget?.title ?? ''} subtitle={viewTarget ? formatTarget(viewTarget.target_at) : undefined}>
      {viewTarget ? <View style={{ gap: theme.spacing.md }}>
        <ParticipantAttribution userId={viewTarget.creator_id} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <TagChip subtle label={viewTarget.type.toUpperCase()} />
          {viewTarget.start_at ? <TagChip subtle label={\`STARTED \${formatTarget(viewTarget.start_at).toUpperCase()}\`} /> : null}
        </View>
        <AppText variant="numeric">{Math.max(0, remaining(viewTarget.target_at, nowMs).days)}</AppText>
        <AppText tone="secondary">{remaining(viewTarget.target_at, nowMs).passed ? 'This countdown has arrived.' : 'days remaining'}</AppText>
      </View> : null}
    </RecordViewSheet>
    <ConfirmDialog visible={!!deleteTarget} title="Delete countdown?"`,
  'countdown detail sheet'
);

// ------------------------------------------------------------
// DATE IDEAS: main title/description opens view; inline Interested/Plan remain actions.
// ------------------------------------------------------------
ensureImport('src/app/features/activities.tsx', `import { RecordViewSheet } from '@/components/common/RecordViewSheet';`, `import { DetailsToggle } from '@/components/common/DetailsToggle';`);
replaceOnce(
  'src/app/features/activities.tsx',
  `const params = useLocalSearchParams<{ focus?: string }>();`,
  `const params = useLocalSearchParams<{ focus?: string; edit?: string }>();`,
  'activity route params'
);
replaceOnce(
  'src/app/features/activities.tsx',
  `const [composerOpen, setComposerOpen] = useState(false); const [advancedOpen, setAdvancedOpen] = useState(false);`,
  `const [composerOpen, setComposerOpen] = useState(false); const [viewTarget, setViewTarget] = useState<CoupleActivity | null>(null); const [advancedOpen, setAdvancedOpen] = useState(false);`,
  'activity view state'
);
replaceOnce(
  'src/app/features/activities.tsx',
  `useEffect(() => { if (!params.focus || editingId === params.focus || !activities.length) return; const focused = activities.find((activity) => activity.id === params.focus); if (focused) beginEdit(focused); }, [params.focus, activities]);`,
  `useEffect(() => { if (!params.focus || !activities.length) return; const focused = activities.find((activity) => activity.id === params.focus); if (focused) setViewTarget(focused); }, [params.focus, activities]);
  useEffect(() => { if (!params.edit || editingId === params.edit || !activities.length) return; const target = activities.find((activity) => activity.id === params.edit); if (target) beginEdit(target); }, [params.edit, editingId, activities]);`,
  'activity focus/edit semantics'
);
replaceOnce(
  'src/app/features/activities.tsx',
  `<View style={{ flex: 1, gap: 5 }}><AppText variant="section">{activity.title}</AppText><ParticipantAttribution userId={activity.creator_id} />{activity.description ? <AppText variant="bodySmall" tone="secondary" numberOfLines={2}>{activity.description}</AppText> : null}</View>`,
  `<Pressable accessibilityRole="button" accessibilityLabel={\`Open date idea \${activity.title}\`} onPress={() => setViewTarget(activity)} style={({ pressed }) => ({ flex: 1, gap: 5, opacity: pressed ? 0.76 : 1 })}><AppText variant="section">{activity.title}</AppText><ParticipantAttribution userId={activity.creator_id} />{activity.description ? <AppText variant="bodySmall" tone="secondary" numberOfLines={2}>{activity.description}</AppText> : <AppText variant="bodySmall" tone="muted">Tap to see the idea.</AppText>}</Pressable>`,
  'activity tap views'
);
replaceOnce(
  'src/app/features/activities.tsx',
  `    <ConfirmDialog visible={!!deleteTarget} title="Delete idea?"`,
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
    <ConfirmDialog visible={!!deleteTarget} title="Delete idea?"`,
  'activity detail sheet'
);

// ------------------------------------------------------------
// GOALS: title/summary opens view; contribution remains an inline action.
// ------------------------------------------------------------
ensureImport('src/app/features/goals.tsx', `import { RecordViewSheet } from '@/components/common/RecordViewSheet';`, `import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';`);
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
replaceOnce(
  'src/app/features/goals.tsx',
  `      <ConfirmDialog visible={!!deleteTarget} title="Delete goal?"`,
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
      <ConfirmDialog visible={!!deleteTarget} title="Delete goal?"`,
  'goal detail sheet'
);

// ------------------------------------------------------------
// CALENDAR: event tap=view, overflow=manage; focus/edit deep links split.
// ------------------------------------------------------------
ensureImport('src/app/features/calendar.tsx', `import { RecordViewSheet } from '@/components/common/RecordViewSheet';`, `import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';`);
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
replaceOnce(
  'src/app/features/calendar.tsx',
  `    <ConfirmDialog visible={!!deleteTarget} title="Delete event?"`,
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
    <ConfirmDialog visible={!!deleteTarget} title="Delete event?"`,
  'calendar detail sheet'
);

// Final audit.
const checks = [
  ['src/app/features/tasks.tsx', 'setViewTarget(task)'],
  ['src/app/features/notes.tsx', 'openNoteMenu(note)'],
  ['src/app/features/countdowns.tsx', 'Open countdown'],
  ['src/app/features/activities.tsx', 'Open date idea'],
  ['src/app/features/goals.tsx', 'Open goal'],
  ['src/app/features/calendar.tsx', 'setViewTarget(event)'],
  ['src/components/common/RecordViewSheet.tsx', 'Use ••• on the item card'],
];
const missing = checks.filter(([rel, marker]) => !read(rel).includes(marker)).map(([rel, marker]) => `${rel}: missing ${marker}`);
if (missing.length) {
  fs.writeFileSync(p('RELEASE_B3B_VIEW_MANAGE_AUDIT_REMAINING.txt'), missing.join('\r\n') + '\r\n', 'utf8');
  console.error(`B3B audit found ${missing.length} issue(s). See RELEASE_B3B_VIEW_MANAGE_AUDIT_REMAINING.txt`);
  process.exitCode = 2;
} else {
  const report = p('RELEASE_B3B_VIEW_MANAGE_AUDIT_REMAINING.txt');
  if (fs.existsSync(report)) fs.unlinkSync(report);
  console.log('B3B view/manage interaction audit clean.');
}

console.log('');
console.log('Release B3B applied.');
console.log('Run:');
console.log('  npm.cmd run typecheck');
console.log('  npm.cmd --prefix server run typecheck');
console.log('  npm.cmd --prefix server run logic');
