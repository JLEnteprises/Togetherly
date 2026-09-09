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
  if (text.includes(statement)) return false;
  if (!text.includes(anchor)) throw new Error(`Could not add import to ${rel}`);
  text = text.replace(anchor, `${anchor}\n${statement}`);
  write(rel, text);
  return true;
}
function replaceIfPresent(rel, oldText, newText, label) {
  let text = read(rel);
  if (text.includes(newText)) {
    console.log(`Already good ${rel}: ${label}`);
    return false;
  }
  if (!text.includes(oldText)) {
    console.log(`Skipped ${rel}: ${label} (old text not present; will verify by audit)`);
    return false;
  }
  text = text.replace(oldText, newText);
  write(rel, text);
  return true;
}
function insertAfterOnce(rel, marker, addition, alreadyMarker, label) {
  let text = read(rel);
  if (alreadyMarker && text.includes(alreadyMarker)) {
    console.log(`Already good ${rel}: ${label}`);
    return false;
  }
  const first = text.indexOf(marker);
  if (first < 0) throw new Error(`Could not find insertion point in ${rel}: ${label}`);
  if (text.indexOf(marker, first + marker.length) >= 0) throw new Error(`Multiple insertion points in ${rel}: ${label}`);
  text = text.slice(0, first + marker.length) + addition + text.slice(first + marker.length);
  write(rel, text);
  return true;
}

// ------------------------------------------------------------
// ACTIVITIES: repair the exact partial state left by the last run.
// The old cost/where controls were already removed and DetailsToggle inserted.
// Put those controls inside the advanced section now.
// ------------------------------------------------------------
{
  const rel = 'src/app/features/activities.tsx';
  ensureImport(rel, `import { DetailsToggle } from '@/components/common/DetailsToggle';`, `import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';`);

  replaceIfPresent(
    rel,
    `<FormField label="ACTIVITY" value={title} onChangeText={setTitle} placeholder="Stargazing" />`,
    `<FormField label="What do you want to do?" value={title} onChangeText={setTitle} placeholder="Stargazing" />`,
    'primary prompt'
  );

  // If the old pre-details metadata block still exists, collapse it.
  replaceIfPresent(
    rel,
    `<View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">COST</AppText><ChoiceChips value={cost} onChange={setCost} options={[{ value: 'free', label: 'Free' }, { value: 'cheap', label: 'Cheap' }, { value: 'moderate', label: 'Moderate' }, { value: 'expensive', label: 'Expensive' }]} /></View>
      <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">WHERE</AppText><ChoiceChips value={locationType} onChange={setLocationType} options={[{ value: 'home', label: 'Home' }, { value: 'nearby', label: 'Nearby' }, { value: 'online', label: 'Online' }, { value: 'anywhere', label: 'Anywhere' }]} /></View>
      <Pressable accessibilityRole="button" onPress={() => setAdvancedOpen((value) => !value)} style={{ flexDirection: 'row', justifyContent: 'space-between', minHeight: 44, alignItems: 'center' }}><AppText variant="bodySmall" tone="accent">{advancedOpen ? 'Hide extra details' : 'Add extra details'}</AppText><AppIcon name="chevron" size={16} color={theme.colors.textMuted} /></Pressable>`,
    `<DetailsToggle open={advancedOpen} onToggle={() => setAdvancedOpen((value) => !value)} closedLabel="Add details" openLabel="Hide details" hint="Cost, place, mood, duration and anything else." />`,
    'collapse metadata'
  );

  // Current partial state lands here: advanced section exists but cost/location controls are absent.
  insertAfterOnce(
    rel,
    `{advancedOpen ? <View style={{ gap: theme.spacing.lg }}>`,
    `
        <View style={{ gap: theme.spacing.sm }}><AppText variant="bodySmall" tone="secondary">Cost</AppText><ChoiceChips value={cost} onChange={setCost} options={[{ value: 'free', label: 'Free' }, { value: 'cheap', label: 'Cheap' }, { value: 'moderate', label: 'Moderate' }, { value: 'expensive', label: 'Expensive' }]} /></View>
        <View style={{ gap: theme.spacing.sm }}><AppText variant="bodySmall" tone="secondary">Where?</AppText><ChoiceChips value={locationType} onChange={setLocationType} options={[{ value: 'home', label: 'Home' }, { value: 'nearby', label: 'Nearby' }, { value: 'online', label: 'Online' }, { value: 'anywhere', label: 'Anywhere' }]} /></View>`,
    `>Cost</AppText><ChoiceChips value={cost}`,
    'move cost/location into details'
  );

  for (const [oldText, newText, label] of [
    [`<FormField label="DESCRIPTION"`, `<FormField label="What makes this a good date?"`, 'description label'],
    [`>ENVIRONMENT<`, `>Setting<`, 'environment heading'],
    [`>MOOD<`, `>Mood<`, 'mood heading'],
    [`>TIME OF DAY<`, `>Time of day<`, 'time heading'],
    [`label="DURATION · MIN"`, `label="Duration · minutes"`, 'duration label'],
    [`label="LOCATION · OPTIONAL"`, `label="Specific place"`, 'location label'],
    [`label="RATING · OPTIONAL 1–5"`, `label="Rating · 1–5"`, 'rating label'],
  ]) replaceIfPresent(rel, oldText, newText, label);
}

// ------------------------------------------------------------
// LISTS
// ------------------------------------------------------------
{
  const rel = 'src/app/features/lists.tsx';
  ensureImport(rel, `import { DetailsToggle } from '@/components/common/DetailsToggle';`, `import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';`);

  let text = read(rel);
  if (!text.includes(`const [detailsOpen, setDetailsOpen]`)) {
    text = text.replace(
      `  const [composerOpen, setComposerOpen] = useState(false);`,
      `  const [composerOpen, setComposerOpen] = useState(false);\n  const [detailsOpen, setDetailsOpen] = useState(false);`
    );
    write(rel, text);
  }

  replaceIfPresent(
    rel,
    `setNewListTitle(''); setSelectedTagIds([]); setComposerOpen(false); await refresh();`,
    `setNewListTitle(''); setSelectedTagIds([]); setDetailsOpen(false); setComposerOpen(false); await refresh();`,
    'reset details after create'
  );

  replaceIfPresent(
    rel,
    `<FormField label="LIST NAME" value={newListTitle} onChangeText={setNewListTitle} placeholder="Things to pack" />
        <TagSelector tags={tags} selectedIds={selectedTagIds} onChange={setSelectedTagIds} />
        <AppButton label={busy ? 'Creating…' : 'Create list'} disabled={busy || !newListTitle.trim()} onPress={addList} />`,
    `<FormField label="What is this list for?" value={newListTitle} onChangeText={setNewListTitle} placeholder="Things to pack" />
        <DetailsToggle open={detailsOpen} onToggle={() => setDetailsOpen((value) => !value)} closedLabel="Add tags" openLabel="Hide tags" />
        {detailsOpen ? <TagSelector tags={tags} selectedIds={selectedTagIds} onChange={setSelectedTagIds} /> : null}
        <AppButton label={busy ? 'Creating…' : 'Create list'} disabled={busy || !newListTitle.trim()} onPress={addList} />`,
    'fast create'
  );
}

// ------------------------------------------------------------
// COUNTDOWNS
// ------------------------------------------------------------
{
  const rel = 'src/app/features/countdowns.tsx';
  ensureImport(rel, `import { DetailsToggle } from '@/components/common/DetailsToggle';`, `import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';`);

  replaceIfPresent(
    rel,
    `const [busy, setBusy] = useState(false); const [nowMs, setNowMs] = useState(() => Date.now());`,
    `const [busy, setBusy] = useState(false); const [detailsOpen, setDetailsOpen] = useState(false); const [nowMs, setNowMs] = useState(() => Date.now());`,
    'details state'
  );

  replaceIfPresent(
    rel,
    `function resetForm(close = true) { setEditingId(null); setTitle(''); setDate(''); setStartDate(''); setType('visit'); if (close) setComposerOpen(false); }`,
    `function resetForm(close = true) { setEditingId(null); setTitle(''); setDate(''); setStartDate(''); setType('visit'); setDetailsOpen(false); if (close) setComposerOpen(false); }`,
    'reset details'
  );

  replaceIfPresent(
    rel,
    `function beginEdit(countdown: CoupleCountdown) { setEditingId(countdown.id); setTitle(countdown.title); setDate(storedDateKey(countdown.target_at)); setStartDate(storedDateKey(countdown.start_at)); setType(countdown.type); setComposerOpen(true); }`,
    `function beginEdit(countdown: CoupleCountdown) { setEditingId(countdown.id); setTitle(countdown.title); setDate(storedDateKey(countdown.target_at)); setStartDate(storedDateKey(countdown.start_at)); setType(countdown.type); setDetailsOpen(true); setComposerOpen(true); }`,
    'edit opens details'
  );

  replaceIfPresent(
    rel,
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
    'fast create'
  );
}

// ------------------------------------------------------------
// NOTES
// ------------------------------------------------------------
{
  const rel = 'src/app/features/notes.tsx';
  ensureImport(rel, `import { DetailsToggle } from '@/components/common/DetailsToggle';`, `import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';`);

  replaceIfPresent(
    rel,
    `  const { colorForUser } = useWorkspace();`,
    `  const { colorForUser, profile } = useWorkspace();`,
    'profile identity'
  );

  replaceIfPresent(
    rel,
    `const [composerOpen, setComposerOpen] = useState(false); const [filter, setFilter] = useState<Filter>('all');`,
    `const [composerOpen, setComposerOpen] = useState(false); const [detailsOpen, setDetailsOpen] = useState(false); const [filter, setFilter] = useState<Filter>('all');`,
    'details state'
  );

  replaceIfPresent(
    rel,
    `function resetEditor(close = true) { setSelectedId(null); setSelectedUpdatedAt(null); setTitle(''); setBody(''); setVisibility('shared'); setPinned(false); setSelectedTagIds([]); if (close) setComposerOpen(false); }`,
    `function resetEditor(close = true) { setSelectedId(null); setSelectedUpdatedAt(null); setTitle(''); setBody(''); setVisibility('shared'); setPinned(false); setSelectedTagIds([]); setDetailsOpen(false); if (close) setComposerOpen(false); }`,
    'reset details'
  );

  replaceIfPresent(
    rel,
    `function select(note: CoupleNote) { setSelectedId(note.id); setSelectedUpdatedAt(note.updated_at); setTitle(note.title); setBody(note.body); setVisibility(note.visibility); setPinned(note.pinned); setSelectedTagIds((note.tags ?? []).map((tag) => tag.id)); setComposerOpen(true); }`,
    `function select(note: CoupleNote) { setSelectedId(note.id); setSelectedUpdatedAt(note.updated_at); setTitle(note.title); setBody(note.body); setVisibility(note.visibility); setPinned(note.pinned); setSelectedTagIds((note.tags ?? []).map((tag) => tag.id)); setDetailsOpen(true); setComposerOpen(true); }`,
    'edit opens details'
  );

  {
    let text = read(rel);
    if (!text.includes(`const canMakePrivate =`)) {
      const marker = `  const visible = useMemo(() => notes.filter((note) => filter === 'all' || (filter === 'pinned' ? note.pinned : note.visibility === filter)), [filter, notes]);`;
      if (!text.includes(marker)) throw new Error('Could not insert Notes privacy ownership rule.');
      text = text.replace(
        marker,
        `${marker}\n  const selectedNote = selectedId ? notes.find((note) => note.id === selectedId) ?? null : null;\n  const canMakePrivate = !selectedNote || selectedNote.creator_id === profile?.id;`
      );
      write(rel, text);
    }
  }

  replaceIfPresent(
    rel,
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
    'fast create'
  );
}

// ------------------------------------------------------------
// FINAL AUDIT
// ------------------------------------------------------------
const checks = [
  ['src/app/features/tasks.tsx', 'Add dates & details'],
  ['src/app/features/memories.tsx', 'Add the story & details'],
  ['src/app/features/activities.tsx', 'What do you want to do?'],
  ['src/app/features/activities.tsx', '>Cost</AppText><ChoiceChips value={cost}'],
  ['src/app/features/activities.tsx', '>Where?</AppText><ChoiceChips value={locationType}'],
  ['src/app/features/lists.tsx', 'What is this list for?'],
  ['src/app/features/countdowns.tsx', 'What are you counting down to?'],
  ['src/app/features/notes.tsx', 'Only the person who created a shared note can make it private.'],
];

const missing = checks
  .filter(([rel, marker]) => !read(rel).includes(marker))
  .map(([rel, marker]) => `${rel}: missing ${marker}`);

if (missing.length) {
  fs.writeFileSync(p('RELEASE_B2_REPAIR2_AUDIT_REMAINING.txt'), missing.join('\r\n') + '\r\n', 'utf8');
  console.log(`B2 repair audit found ${missing.length} issue(s). See RELEASE_B2_REPAIR2_AUDIT_REMAINING.txt`);
  process.exitCode = 2;
} else {
  const report = p('RELEASE_B2_REPAIR2_AUDIT_REMAINING.txt');
  if (fs.existsSync(report)) fs.unlinkSync(report);
  console.log('B2 repair audit clean.');
}

console.log('');
console.log('B2 Repair 2 complete.');
console.log('Now run:');
console.log('  npm.cmd run typecheck');
console.log('  npm.cmd --prefix server run typecheck');
console.log('  npm.cmd --prefix server run logic');
