const fs = require('fs');
const path = require('path');

const project = process.cwd();
function p(rel) { return path.join(project, rel); }
function read(rel) {
  if (!fs.existsSync(p(rel))) throw new Error(`Missing ${rel}. Run this from the Togetherly project root.`);
  return fs.readFileSync(p(rel), 'utf8').replace(/\r\n/g, '\n');
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
    console.log(`Already patched ${rel}: ${label}`);
    return;
  }
  const i = text.indexOf(oldText);
  if (i < 0) throw new Error(`Could not safely patch ${rel}: ${label}`);
  if (text.indexOf(oldText, i + oldText.length) >= 0) throw new Error(`Multiple matches in ${rel}: ${label}`);
  text = text.replace(oldText, newText);
  write(rel, text);
}
function replaceRegexOnce(rel, regex, replacement, label) {
  let text = read(rel);
  if (typeof replacement === 'string' && text.includes(replacement)) {
    console.log(`Already patched ${rel}: ${label}`);
    return;
  }
  const matches = [...text.matchAll(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g'))];
  if (matches.length !== 1) throw new Error(`Expected 1 match in ${rel} for ${label}, found ${matches.length}`);
  text = text.replace(regex, replacement);
  write(rel, text);
}

// Verify the first half of B2 really did apply before resuming.
for (const [rel, marker] of [
  ['src/app/features/tasks.tsx', 'Add dates & details'],
  ['src/app/features/memories.tsx', 'Add the story & details'],
]) {
  if (!read(rel).includes(marker)) throw new Error(`${rel} does not contain the expected partial B2 changes (${marker}). Stop and share the file before proceeding.`);
}

// ---------- ACTIVITIES ----------
ensureImport(
  'src/app/features/activities.tsx',
  `import { DetailsToggle } from '@/components/common/DetailsToggle';`,
  `import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';`
);

replaceOnce(
  'src/app/features/activities.tsx',
  `<FormField label="ACTIVITY" value={title} onChangeText={setTitle} placeholder="Stargazing" />`,
  `<FormField label="What do you want to do?" value={title} onChangeText={setTitle} placeholder="Stargazing" />`,
  'activity primary prompt'
);

replaceOnce(
  'src/app/features/activities.tsx',
  `<View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">COST</AppText><ChoiceChips value={cost} onChange={setCost} options={[{ value: 'free', label: 'Free' }, { value: 'cheap', label: 'Cheap' }, { value: 'moderate', label: 'Moderate' }, { value: 'expensive', label: 'Expensive' }]} /></View>
      <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">WHERE</AppText><ChoiceChips value={locationType} onChange={setLocationType} options={[{ value: 'home', label: 'Home' }, { value: 'nearby', label: 'Nearby' }, { value: 'online', label: 'Online' }, { value: 'anywhere', label: 'Anywhere' }]} /></View>
      <Pressable accessibilityRole="button" onPress={() => setAdvancedOpen((value) => !value)} style={{ flexDirection: 'row', justifyContent: 'space-between', minHeight: 44, alignItems: 'center' }}><AppText variant="bodySmall" tone="accent">{advancedOpen ? 'Hide extra details' : 'Add extra details'}</AppText><AppIcon name="chevron" size={16} color={theme.colors.textMuted} /></Pressable>`,
  `<DetailsToggle open={advancedOpen} onToggle={() => setAdvancedOpen((value) => !value)} closedLabel="Add details" openLabel="Hide details" hint="Cost, place, mood, duration and anything else." />`,
  'activity collapse metadata'
);

replaceOnce(
  'src/app/features/activities.tsx',
  `{advancedOpen ? <View style={{ gap: theme.spacing.lg }}>
        <FormField label="DESCRIPTION" value={description} onChangeText={setDescription} multiline placeholder="What makes this a good date…`,
  `{advancedOpen ? <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.sm }}><AppText variant="bodySmall" tone="secondary">Cost</AppText><ChoiceChips value={cost} onChange={setCost} options={[{ value: 'free', label: 'Free' }, { value: 'cheap', label: 'Cheap' }, { value: 'moderate', label: 'Moderate' }, { value: 'expensive', label: 'Expensive' }]} /></View>
        <View style={{ gap: theme.spacing.sm }}><AppText variant="bodySmall" tone="secondary">Where?</AppText><ChoiceChips value={locationType} onChange={setLocationType} options={[{ value: 'home', label: 'Home' }, { value: 'nearby', label: 'Nearby' }, { value: 'online', label: 'Online' }, { value: 'anywhere', label: 'Anywhere' }]} /></View>
        <FormField label="What makes this a good date?" value={description} onChangeText={setDescription} multiline placeholder="What makes this a good date…`,
  'activity move cost/location into details'
);

for (const [oldText, newText, label] of [
  ['>ENVIRONMENT<', '>Setting<', 'activity environment'],
  ['>MOOD<', '>Mood<', 'activity mood'],
  ['>TIME OF DAY<', '>Time of day<', 'activity time'],
  ['label="DURATION · MIN"', 'label="Duration · minutes"', 'activity duration'],
  ['label="LOCATION · OPTIONAL"', 'label="Specific place"', 'activity location'],
  ['label="RATING · OPTIONAL 1–5"', 'label="Rating · 1–5"', 'activity rating'],
]) replaceOnce('src/app/features/activities.tsx', oldText, newText, label);

// ---------- LISTS ----------
ensureImport(
  'src/app/features/lists.tsx',
  `import { DetailsToggle } from '@/components/common/DetailsToggle';`,
  `import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';`
);
replaceOnce(
  'src/app/features/lists.tsx',
  `  const [composerOpen, setComposerOpen] = useState(false);`,
  `  const [composerOpen, setComposerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);`,
  'list details state'
);
replaceOnce(
  'src/app/features/lists.tsx',
  `setNewListTitle(''); setSelectedTagIds([]); setComposerOpen(false); await refresh();`,
  `setNewListTitle(''); setSelectedTagIds([]); setDetailsOpen(false); setComposerOpen(false); await refresh();`,
  'list details reset'
);
replaceOnce(
  'src/app/features/lists.tsx',
  `<FormField label="LIST NAME" value={newListTitle} onChangeText={setNewListTitle} placeholder="Things to pack" />
        <TagSelector tags={tags} selectedIds={selectedTagIds} onChange={setSelectedTagIds} />
        <AppButton label={busy ? 'Creating…' : 'Create list'} disabled={busy || !newListTitle.trim()} onPress={addList} />`,
  `<FormField label="What is this list for?" value={newListTitle} onChangeText={setNewListTitle} placeholder="Things to pack" />
        <DetailsToggle open={detailsOpen} onToggle={() => setDetailsOpen((value) => !value)} closedLabel="Add tags" openLabel="Hide tags" />
        {detailsOpen ? <TagSelector tags={tags} selectedIds={selectedTagIds} onChange={setSelectedTagIds} /> : null}
        <AppButton label={busy ? 'Creating…' : 'Create list'} disabled={busy || !newListTitle.trim()} onPress={addList} />`,
  'list fast create'
);

// ---------- COUNTDOWNS ----------
ensureImport(
  'src/app/features/countdowns.tsx',
  `import { DetailsToggle } from '@/components/common/DetailsToggle';`,
  `import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';`
);
replaceOnce(
  'src/app/features/countdowns.tsx',
  `const [busy, setBusy] = useState(false); const [nowMs, setNowMs] = useState(() => Date.now());`,
  `const [busy, setBusy] = useState(false); const [detailsOpen, setDetailsOpen] = useState(false); const [nowMs, setNowMs] = useState(() => Date.now());`,
  'countdown details state'
);
replaceOnce(
  'src/app/features/countdowns.tsx',
  `function resetForm(close = true) { setEditingId(null); setTitle(''); setDate(''); setStartDate(''); setType('visit'); if (close) setComposerOpen(false); }`,
  `function resetForm(close = true) { setEditingId(null); setTitle(''); setDate(''); setStartDate(''); setType('visit'); setDetailsOpen(false); if (close) setComposerOpen(false); }`,
  'countdown reset'
);
replaceOnce(
  'src/app/features/countdowns.tsx',
  `function beginEdit(countdown: CoupleCountdown) { setEditingId(countdown.id); setTitle(countdown.title); setDate(storedDateKey(countdown.target_at)); setStartDate(storedDateKey(countdown.start_at)); setType(countdown.type); setComposerOpen(true); }`,
  `function beginEdit(countdown: CoupleCountdown) { setEditingId(countdown.id); setTitle(countdown.title); setDate(storedDateKey(countdown.target_at)); setStartDate(storedDateKey(countdown.start_at)); setType(countdown.type); setDetailsOpen(true); setComposerOpen(true); }`,
  'countdown edit opens details'
);
replaceOnce(
  'src/app/features/countdowns.tsx',
  `<FormField label="COUNTDOWN NAME" value={title} onChangeText={setTitle} placeholder="Next time we're together" />
      <DatePickerField label="TARGET DATE" value={date} onChange={setDate} />
      <DatePickerField label="START DATE · OPTIONAL" value={startDate} onChange={setStartDate} optional />
      <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">TYPE</AppText><ChoiceChips value={type} onChange={setType} options={[{ value: 'visit', label: 'Visit' }, { value: 'flight', label: 'Flight' }, { value: 'anniversary', label: 'Anniversary' }, { value: 'birthday', label: 'Birthday' }, { value: 'moving', label: 'Moving' }, { value: 'wedding', label: 'Wedding' }, { value: 'holiday', label: 'Holiday' }, { value: 'custom', label: 'Custom' }]} /></View>
      <AppButton label={busy ? 'Saving…' : editingId ? 'Save changes' : 'Create countdown'} disabled={busy || !title.trim() || !date} onPress={save} />`,
  `<FormField label="What are you counting down to?" value={title} onChangeText={setTitle} placeholder="Next time we're together" />
      <DatePickerField label="When is it?" value={date} onChange={setDate} />
      <DetailsToggle open={detailsOpen} onToggle={() => setDetailsOpen((value) => !value)} closedLabel="Add details" openLabel="Hide details" hint="Start date and countdown type." />
      {detailsOpen ? <View style={{ gap: theme.spacing.lg }}>
        <DatePickerField label="When did the wait start?" value={startDate} onChange={setStartDate} optional />
        <View style={{ gap: theme.spacing.sm }}><AppText variant="bodySmall" tone="secondary">What kind of countdown is it?</AppText><ChoiceChips value={type} onChange={setType} options={[{ value: 'visit', label: 'Visit' }, { value: 'flight', label: 'Flight' }, { value: 'anniversary', label: 'Anniversary' }, { value: 'birthday', label: 'Birthday' }, { value: 'moving', label: 'Moving' }, { value: 'wedding', label: 'Wedding' }, { value: 'holiday', label: 'Holiday' }, { value: 'custom', label: 'Custom' }]} /></View>
      </View> : null}
      <AppButton label={busy ? 'Saving…' : editingId ? 'Save changes' : 'Create countdown'} disabled={busy || !title.trim() || !date} onPress={save} />`,
  'countdown fast create'
);

// ---------- NOTES ----------
ensureImport(
  'src/app/features/notes.tsx',
  `import { DetailsToggle } from '@/components/common/DetailsToggle';`,
  `import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';`
);
replaceOnce(
  'src/app/features/notes.tsx',
  `  const { colorForUser } = useWorkspace();`,
  `  const { colorForUser, profile } = useWorkspace();`,
  'notes profile'
);
replaceOnce(
  'src/app/features/notes.tsx',
  `const [composerOpen, setComposerOpen] = useState(false); const [filter, setFilter] = useState<Filter>('all');`,
  `const [composerOpen, setComposerOpen] = useState(false); const [detailsOpen, setDetailsOpen] = useState(false); const [filter, setFilter] = useState<Filter>('all');`,
  'notes details state'
);
replaceOnce(
  'src/app/features/notes.tsx',
  `function resetEditor(close = true) { setSelectedId(null); setSelectedUpdatedAt(null); setTitle(''); setBody(''); setVisibility('shared'); setPinned(false); setSelectedTagIds([]); if (close) setComposerOpen(false); }`,
  `function resetEditor(close = true) { setSelectedId(null); setSelectedUpdatedAt(null); setTitle(''); setBody(''); setVisibility('shared'); setPinned(false); setSelectedTagIds([]); setDetailsOpen(false); if (close) setComposerOpen(false); }`,
  'notes reset'
);
replaceOnce(
  'src/app/features/notes.tsx',
  `function select(note: CoupleNote) { setSelectedId(note.id); setSelectedUpdatedAt(note.updated_at); setTitle(note.title); setBody(note.body); setVisibility(note.visibility); setPinned(note.pinned); setSelectedTagIds((note.tags ?? []).map((tag) => tag.id)); setComposerOpen(true); }`,
  `function select(note: CoupleNote) { setSelectedId(note.id); setSelectedUpdatedAt(note.updated_at); setTitle(note.title); setBody(note.body); setVisibility(note.visibility); setPinned(note.pinned); setSelectedTagIds((note.tags ?? []).map((tag) => tag.id)); setDetailsOpen(true); setComposerOpen(true); }`,
  'notes edit opens details'
);
replaceOnce(
  'src/app/features/notes.tsx',
  `  const visible = useMemo(() => notes.filter((note) => filter === 'all' || (filter === 'pinned' ? note.pinned : note.visibility === filter)), [filter, notes]);`,
  `  const visible = useMemo(() => notes.filter((note) => filter === 'all' || (filter === 'pinned' ? note.pinned : note.visibility === filter)), [filter, notes]);
  const selectedNote = selectedId ? notes.find((note) => note.id === selectedId) ?? null : null;
  const canMakePrivate = !selectedNote || selectedNote.creator_id === profile?.id;`,
  'notes ownership rule'
);
replaceOnce(
  'src/app/features/notes.tsx',
  `<FormField label="TITLE" value={title} onChangeText={setTitle} placeholder="Flight details" />
      <FormField label="NOTE" value={body} onChangeText={setBody} placeholder="Keep the useful bits in one place…" multiline />
      <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">WHO CAN SEE THIS?</AppText><ChoiceChips value={visibility} onChange={setVisibility} options={[{ value: 'shared', label: '♥ Shared' }, { value: 'private', label: '🔒 Private' }]} /></View>
      <TagSelector tags={tags} selectedIds={selectedTagIds} onChange={setSelectedTagIds} />
      <Pressable accessibilityRole="button" onPress={() => setPinned((value) => !value)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 1, borderColor: pinned ? theme.colors.secondaryAccent : theme.colors.border, backgroundColor: pinned ? theme.colors.secondarySoft : 'transparent', alignItems: 'center', justifyContent: 'center' }}><AppText variant="caption" tone="secondary">{pinned ? '✓' : ''}</AppText></View><AppText variant="bodySmall" tone="secondary">Pin this note to the top</AppText></Pressable>`,
  `<FormField label="What is this note about?" value={title} onChangeText={setTitle} placeholder="Flight details" />
      <FormField label="Write it down" value={body} onChangeText={setBody} placeholder="Keep the useful bits in one place…" multiline />
      <DetailsToggle open={detailsOpen} onToggle={() => setDetailsOpen((value) => !value)} closedLabel="Add note options" openLabel="Hide note options" hint="Privacy, pinning and tags." />
      {detailsOpen ? <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.sm }}>
          <AppText variant="bodySmall" tone="secondary">Who can see this?</AppText>
          <ChoiceChips value={visibility} onChange={setVisibility} options={canMakePrivate ? [{ value: 'shared' as const, label: '♥ Shared' }, { value: 'private' as const, label: '🔒 Private to me' }] : [{ value: 'shared' as const, label: '♥ Shared' }]} />
          {!canMakePrivate ? <AppText variant="caption" tone="muted">Only the person who created a shared note can make it private.</AppText> : null}
        </View>
        <TagSelector tags={tags} selectedIds={selectedTagIds} onChange={setSelectedTagIds} />
        <Pressable accessibilityRole="button" onPress={() => setPinned((value) => !value)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 1, borderColor: pinned ? theme.colors.secondaryAccent : theme.colors.border, backgroundColor: pinned ? theme.colors.secondarySoft : 'transparent', alignItems: 'center', justifyContent: 'center' }}><AppText variant="caption" tone="secondary">{pinned ? '✓' : ''}</AppText></View><AppText variant="bodySmall" tone="secondary">Pin this note to the top</AppText></Pressable>
      </View> : null}`,
  'notes fast create'
);

// Final audit.
const checks = [
  ['src/app/features/tasks.tsx', 'Add dates & details'],
  ['src/app/features/memories.tsx', 'Add the story & details'],
  ['src/app/features/activities.tsx', 'What do you want to do?'],
  ['src/app/features/activities.tsx', 'Cost, place, mood, duration and anything else.'],
  ['src/app/features/lists.tsx', 'What is this list for?'],
  ['src/app/features/countdowns.tsx', 'What are you counting down to?'],
  ['src/app/features/notes.tsx', 'Only the person who created a shared note can make it private.'],
];
const missing = checks.filter(([rel, marker]) => !read(rel).includes(marker)).map(([rel, marker]) => `${rel}: missing "${marker}"`);
if (missing.length) {
  fs.writeFileSync(p('RELEASE_B2_RESUME_AUDIT_REMAINING.txt'), missing.join('\r\n') + '\r\n', 'utf8');
  console.log(`Resume audit found ${missing.length} issue(s). See RELEASE_B2_RESUME_AUDIT_REMAINING.txt`);
  process.exitCode = 2;
} else {
  const report = p('RELEASE_B2_RESUME_AUDIT_REMAINING.txt');
  if (fs.existsSync(report)) fs.unlinkSync(report);
  console.log('B2 resume audit clean.');
}

console.log('');
console.log('B2 resume repair complete.');
console.log('Now run:');
console.log('  npm.cmd run typecheck');
console.log('  npm.cmd --prefix server run typecheck');
console.log('  npm.cmd --prefix server run logic');
