const fs = require('fs');
const path = require('path');

const project = process.cwd();
function file(rel) { return path.join(project, rel); }
function read(rel) {
  const p = file(rel);
  if (!fs.existsSync(p)) throw new Error(`Missing ${rel}. Run this from the Togetherly project root.`);
  return fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
}
function write(rel, text) {
  const p = file(rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text.replace(/\n/g, '\r\n'), 'utf8');
  console.log(`Wrote ${rel}`);
}
function ensureImport(rel, statement, anchor) {
  let text = read(rel);
  if (text.includes(statement)) return;
  if (!text.includes(anchor)) throw new Error(`Could not add import to ${rel}: ${statement}`);
  text = text.replace(anchor, `${anchor}\n${statement}`);
  write(rel, text);
}
function replaceOne(rel, oldText, newText, label) {
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

write('src/components/common/DetailsToggle.tsx', "import { Pressable, View } from 'react-native';\nimport { AppIcon } from '@/components/art/AppIcon';\nimport { useInteractionFeedback } from '@/hooks/useInteractionFeedback';\nimport { useAppTheme } from '@/theme/useAppTheme';\nimport { AppText } from './AppText';\n\nexport function DetailsToggle({\n  open,\n  onToggle,\n  closedLabel = 'Add details',\n  openLabel = 'Hide details',\n  hint,\n}: {\n  open: boolean;\n  onToggle: () => void;\n  closedLabel?: string;\n  openLabel?: string;\n  hint?: string;\n}) {\n  const theme = useAppTheme();\n  const feedback = useInteractionFeedback();\n\n  return (\n    <Pressable\n      accessibilityRole=\"button\"\n      accessibilityState={{ expanded: open }}\n      accessibilityLabel={open ? openLabel : closedLabel}\n      onPress={() => { feedback(); onToggle(); }}\n      style={({ pressed }) => ({\n        minHeight: 46,\n        flexDirection: 'row',\n        alignItems: 'center',\n        justifyContent: 'space-between',\n        gap: theme.spacing.md,\n        borderTopWidth: 1,\n        borderBottomWidth: 1,\n        borderColor: theme.colors.border,\n        paddingVertical: 9,\n        opacity: pressed ? 0.72 : 1,\n      })}\n    >\n      <View style={{ flex: 1, gap: 2 }}>\n        <AppText variant=\"bodySmall\" style={{ fontWeight: '700' }}>{open ? openLabel : closedLabel}</AppText>\n        {!open && hint ? <AppText variant=\"caption\" tone=\"muted\">{hint}</AppText> : null}\n      </View>\n      <AppIcon name={open ? 'chevronUp' : 'chevronDown'} size={15} color={theme.colors.textMuted} />\n    </Pressable>\n  );\n}\n");

// TASKS: already had progressive disclosure; make it feel conversational and consistent.
ensureImport('src/app/features/tasks.tsx', `import { DetailsToggle } from '@/components/common/DetailsToggle';`, `import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';`);
replaceOne(
  'src/app/features/tasks.tsx',
  `<FormField label="TASK" value={title} onChangeText={setTitle} placeholder="Book dinner for Saturday" returnKeyType="done" />`,
  `<FormField label="What needs doing?" value={title} onChangeText={setTitle} placeholder="Book dinner for Saturday" returnKeyType="done" />`,
  'task primary label'
);
replaceOne(
  'src/app/features/tasks.tsx',
  `<View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">ASSIGN TO</AppText><ChoiceChips value={assignee} onChange={setAssignee} options={[{ value: 'both', label: 'Both' }, { value: 'me', label: profile?.display_name ?? 'My account' }, ...(partnerProfile ? [{ value: 'partner' as const, label: partnerProfile.display_name }] : [])]} /></View>`,
  `<View style={{ gap: theme.spacing.sm }}><AppText variant="bodySmall" tone="secondary">Who’s doing it?</AppText><ChoiceChips value={assignee} onChange={setAssignee} options={[{ value: 'both', label: 'Both of us' }, { value: 'me', label: profile?.display_name ? \`Me · \${profile.display_name}\` : 'Me' }, ...(partnerProfile ? [{ value: 'partner' as const, label: partnerProfile.display_name }] : [])]} /></View>`,
  'task assignee language'
);
replaceOne(
  'src/app/features/tasks.tsx',
  `<Pressable accessibilityRole="button" onPress={() => setAdvancedOpen((value) => !value)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 }}>
          <AppText variant="bodySmall" tone="accent">{advancedOpen ? 'Hide options' : 'More options'}</AppText><AppIcon name={advancedOpen ? 'chevronUp' : 'chevronDown'} size={15} color={theme.colors.textMuted} />
        </Pressable>`,
  `<DetailsToggle open={advancedOpen} onToggle={() => setAdvancedOpen((value) => !value)} closedLabel="Add dates & details" openLabel="Hide dates & details" hint="Due dates, steps, priority, repeat and tags." />`,
  'task details toggle'
);
for (const [oldText, newText, label] of [
  ['label="DETAILS · OPTIONAL"', 'label="Details"', 'task details label'],
  ['label="DUE DATE · OPTIONAL"', 'label="Due date"', 'task due label'],
  ['label="START / NEEDS ATTENTION · OPTIONAL"', 'label="When should this start getting attention?"', 'task start label'],
  ['>ESTIMATED DURATION · OPTIONAL<', '>Estimated duration<', 'task duration heading'],
  ['>PRIORITY<', '>Priority<', 'task priority heading'],
  ['>REPEAT<', '>Repeat<', 'task repeat heading'],
  ['>CHECKLIST<', '>Steps<', 'task checklist heading'],
  ['label="ADD STEP"', 'label="Add a step"', 'task add step label'],
]) replaceOne('src/app/features/tasks.tsx', oldText, newText, label);

// MEMORIES: photo/title/date first, story/admin fields behind details.
ensureImport('src/app/features/memories.tsx', `import { DetailsToggle } from '@/components/common/DetailsToggle';`, `import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';`);
replaceOne(
  'src/app/features/memories.tsx',
  `const [composerOpen, setComposerOpen] = useState(false); const [filter, setFilter] = useState<Filter>('all');`,
  `const [composerOpen, setComposerOpen] = useState(false); const [detailsOpen, setDetailsOpen] = useState(false); const [filter, setFilter] = useState<Filter>('all');`,
  'memory details state'
);
replaceOne(
  'src/app/features/memories.tsx',
  `function resetForm(close = true) { setEditingId(null); setTitle(''); setDate(''); setDescription(''); setLocation(''); setEmoji('✦'); setPhotoUrls([]); setMilestone(false); setSelectedTags([]); if (close) setComposerOpen(false); }`,
  `function resetForm(close = true) { setEditingId(null); setTitle(''); setDate(''); setDescription(''); setLocation(''); setEmoji('✦'); setPhotoUrls([]); setMilestone(false); setSelectedTags([]); setDetailsOpen(false); if (close) setComposerOpen(false); }`,
  'memory reset details'
);
replaceOne(
  'src/app/features/memories.tsx',
  `function beginEdit(memory: CoupleMemory) { setEditingId(memory.id); setTitle(memory.title); setDate(memory.memory_date); setDescription(memory.description ?? ''); setLocation(memory.location ?? ''); setEmoji(memory.emoji || '✦'); setPhotoUrls((memory.photos ?? []).map((photo) => photo.media_url).length ? (memory.photos ?? []).map((photo) => photo.media_url) : memory.photo_url ? [memory.photo_url] : []); setMilestone(Boolean(memory.is_milestone)); setSelectedTags((memory.tags ?? []).map((tag) => tag.id)); setComposerOpen(true); }`,
  `function beginEdit(memory: CoupleMemory) { setEditingId(memory.id); setTitle(memory.title); setDate(memory.memory_date); setDescription(memory.description ?? ''); setLocation(memory.location ?? ''); setEmoji(memory.emoji || '✦'); setPhotoUrls((memory.photos ?? []).map((photo) => photo.media_url).length ? (memory.photos ?? []).map((photo) => photo.media_url) : memory.photo_url ? [memory.photo_url] : []); setMilestone(Boolean(memory.is_milestone)); setSelectedTags((memory.tags ?? []).map((tag) => tag.id)); setDetailsOpen(true); setComposerOpen(true); }`,
  'memory edit opens details'
);
replaceOne(
  'src/app/features/memories.tsx',
  `<View style={{ flexDirection: 'row', gap: theme.spacing.sm }}><View style={{ width: 82 }}><FormField label="ICON" value={emoji} onChangeText={setEmoji} maxLength={8} placeholder="✦" /></View><View style={{ flex: 1 }}><FormField label="TITLE" value={title} onChangeText={setTitle} placeholder="First meeting" /></View></View>
      <DatePickerField label="DATE" value={date} onChange={setDate} /><FormField label="DESCRIPTION" value={description} onChangeText={setDescription} multiline placeholder="What happened, what it felt like, the little details…" /><FormField label="LOCATION · OPTIONAL" value={location} onChangeText={setLocation} placeholder="Where were you?" /><MultiPhotoPickerField label="PHOTOS · OPTIONAL" values={photoUrls} onChange={setPhotoUrls} /><ToggleRow label="Relationship milestone" subtitle="Show this memory on your timeline." value={milestone} onChange={setMilestone} /><TagSelector tags={tags} selectedIds={selectedTags} onChange={setSelectedTags} /><AppButton label={busy ? 'Saving…' : editingId ? 'Update memory' : 'Save memory'} disabled={busy || !title.trim() || !date} onPress={save} />`,
  `<FormField label="What happened?" value={title} onChangeText={setTitle} placeholder="First meeting" />
      <DatePickerField label="When was it?" value={date} onChange={setDate} />
      <MultiPhotoPickerField label="Photos" values={photoUrls} onChange={setPhotoUrls} />
      <DetailsToggle open={detailsOpen} onToggle={() => setDetailsOpen((value) => !value)} closedLabel="Add the story & details" openLabel="Hide story & details" hint="Description, place, icon, milestone and tags." />
      {detailsOpen ? <View style={{ gap: theme.spacing.lg }}>
        <FormField label="What do you want to remember?" value={description} onChangeText={setDescription} multiline placeholder="What happened, what it felt like, the little details…" />
        <FormField label="Where were you?" value={location} onChangeText={setLocation} placeholder="Optional" />
        <FormField label="Memory icon" value={emoji} onChangeText={setEmoji} maxLength={8} placeholder="✦" />
        <ToggleRow label="Relationship milestone" subtitle="Show this memory on your timeline." value={milestone} onChange={setMilestone} />
        <TagSelector tags={tags} selectedIds={selectedTags} onChange={setSelectedTags} />
      </View> : null}
      <AppButton label={busy ? 'Saving…' : editingId ? 'Update memory' : 'Save memory'} disabled={busy || !title.trim() || !date} onPress={save} />`,
  'memory fast-create composer'
);

// DATE IDEAS: one field is enough to save; all metadata moves behind details.
ensureImport('src/app/features/activities.tsx', `import { DetailsToggle } from '@/components/common/DetailsToggle';`, `import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';`);
replaceOne(
  'src/app/features/activities.tsx',
  `<FormField label="ACTIVITY" value={title} onChangeText={setTitle} placeholder="Stargazing" />
      <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">COST</AppText><ChoiceChips value={cost} onChange={setCost} options={[{ value: 'free', label: 'Free' }, { value: 'cheap', label: 'Cheap' }, { value: 'moderate', label: 'Moderate' }, { value: 'expensive', label: 'Expensive' }]} /></View>
      <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">WHERE</AppText><ChoiceChips value={locationType} onChange={setLocationType} options={[{ value: 'home', label: 'Home' }, { value: 'nearby', label: 'Nearby' }, { value: 'online', label: 'Online' }, { value: 'anywhere', label: 'Anywhere' }]} /></View>
      <Pressable accessibilityRole="button" onPress={() => setAdvancedOpen((value) => !value)} style={{ flexDirection: 'row', justifyContent: 'space-between', minHeight: 44, alignItems: 'center' }}><AppText variant="bodySmall" tone="accent">{advancedOpen ? 'Hide extra details' : 'Add extra details'}</AppText><AppIcon name="chevron" size={16} color={theme.colors.textMuted} /></Pressable>
      {advancedOpen ? <View style={{ gap: theme.spacing.lg }}>
        <FormField label="DESCRIPTION" value={description} onChangeText={setDescription} multiline placeholder="What makes this a good date…" />`,
  `<FormField label="What do you want to do?" value={title} onChangeText={setTitle} placeholder="Stargazing" />
      <DetailsToggle open={advancedOpen} onToggle={() => setAdvancedOpen((value) => !value)} closedLabel="Add details" openLabel="Hide details" hint="Cost, place, mood, duration and anything else." />
      {advancedOpen ? <View style={{ gap: theme.spacing.lg }}>
        <View style={{ gap: theme.spacing.sm }}><AppText variant="bodySmall" tone="secondary">Cost</AppText><ChoiceChips value={cost} onChange={setCost} options={[{ value: 'free', label: 'Free' }, { value: 'cheap', label: 'Cheap' }, { value: 'moderate', label: 'Moderate' }, { value: 'expensive', label: 'Expensive' }]} /></View>
        <View style={{ gap: theme.spacing.sm }}><AppText variant="bodySmall" tone="secondary">Where?</AppText><ChoiceChips value={locationType} onChange={setLocationType} options={[{ value: 'home', label: 'Home' }, { value: 'nearby', label: 'Nearby' }, { value: 'online', label: 'Online' }, { value: 'anywhere', label: 'Anywhere' }]} /></View>
        <FormField label="What makes this a good date?" value={description} onChangeText={setDescription} multiline placeholder="Anything you want to remember about the idea…" />`,
  'date idea fast-create composer'
);
for (const [oldText, newText, label] of [
  ['>ENVIRONMENT<', '>Setting<', 'activity environment heading'],
  ['>MOOD<', '>Mood<', 'activity mood heading'],
  ['>TIME OF DAY<', '>Time of day<', 'activity time heading'],
  ['label="DURATION · MIN"', 'label="Duration · minutes"', 'activity duration label'],
  ['label="LOCATION · OPTIONAL"', 'label="Specific place"', 'activity location label'],
  ['label="RATING · OPTIONAL 1–5"', 'label="Rating · 1–5"', 'activity rating label'],
]) replaceOne('src/app/features/activities.tsx', oldText, newText, label);

// LISTS: list name is the only required thing; tags are optional detail.
ensureImport('src/app/features/lists.tsx', `import { DetailsToggle } from '@/components/common/DetailsToggle';`, `import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';`);
replaceOne(
  'src/app/features/lists.tsx',
  `const [composerOpen, setComposerOpen] = useState(false);`,
  `const [composerOpen, setComposerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);`,
  'list details state'
);
replaceOne(
  'src/app/features/lists.tsx',
  `setNewListTitle(''); setSelectedTagIds([]); setComposerOpen(false); await refresh();`,
  `setNewListTitle(''); setSelectedTagIds([]); setDetailsOpen(false); setComposerOpen(false); await refresh();`,
  'list reset details after create'
);
replaceOne(
  'src/app/features/lists.tsx',
  `<FormField label="LIST NAME" value={newListTitle} onChangeText={setNewListTitle} placeholder="Things to pack" />
        <TagSelector tags={tags} selectedIds={selectedTagIds} onChange={setSelectedTagIds} />
        <AppButton label={busy ? 'Creating…' : 'Create list'} disabled={busy || !newListTitle.trim()} onPress={addList} />`,
  `<FormField label="What is this list for?" value={newListTitle} onChangeText={setNewListTitle} placeholder="Things to pack" />
        <DetailsToggle open={detailsOpen} onToggle={() => setDetailsOpen((value) => !value)} closedLabel="Add tags" openLabel="Hide tags" />
        {detailsOpen ? <TagSelector tags={tags} selectedIds={selectedTagIds} onChange={setSelectedTagIds} /> : null}
        <AppButton label={busy ? 'Creating…' : 'Create list'} disabled={busy || !newListTitle.trim()} onPress={addList} />`,
  'list fast-create composer'
);

// COUNTDOWNS: title + date first; type/start date optional.
ensureImport('src/app/features/countdowns.tsx', `import { DetailsToggle } from '@/components/common/DetailsToggle';`, `import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';`);
replaceOne(
  'src/app/features/countdowns.tsx',
  `const [busy, setBusy] = useState(false); const [nowMs, setNowMs] = useState(() => Date.now());`,
  `const [busy, setBusy] = useState(false); const [detailsOpen, setDetailsOpen] = useState(false); const [nowMs, setNowMs] = useState(() => Date.now());`,
  'countdown details state'
);
replaceOne(
  'src/app/features/countdowns.tsx',
  `function resetForm(close = true) { setEditingId(null); setTitle(''); setDate(''); setStartDate(''); setType('visit'); if (close) setComposerOpen(false); }`,
  `function resetForm(close = true) { setEditingId(null); setTitle(''); setDate(''); setStartDate(''); setType('visit'); setDetailsOpen(false); if (close) setComposerOpen(false); }`,
  'countdown reset details'
);
replaceOne(
  'src/app/features/countdowns.tsx',
  `function beginEdit(countdown: CoupleCountdown) { setEditingId(countdown.id); setTitle(countdown.title); setDate(storedDateKey(countdown.target_at)); setStartDate(storedDateKey(countdown.start_at)); setType(countdown.type); setComposerOpen(true); }`,
  `function beginEdit(countdown: CoupleCountdown) { setEditingId(countdown.id); setTitle(countdown.title); setDate(storedDateKey(countdown.target_at)); setStartDate(storedDateKey(countdown.start_at)); setType(countdown.type); setDetailsOpen(true); setComposerOpen(true); }`,
  'countdown edit opens details'
);
replaceOne(
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
  'countdown fast-create composer'
);

// NOTES: keep title/body primary; optional visibility/tags/pinning behind details.
// Also fix the known UX mismatch: a partner cannot convert someone else's shared note to private.
ensureImport('src/app/features/notes.tsx', `import { DetailsToggle } from '@/components/common/DetailsToggle';`, `import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';`);
replaceOne(
  'src/app/features/notes.tsx',
  `const { colorForUser } = useWorkspace();`,
  `const { colorForUser, profile } = useWorkspace();`,
  'notes profile identity'
);
replaceOne(
  'src/app/features/notes.tsx',
  `const [composerOpen, setComposerOpen] = useState(false); const [filter, setFilter] = useState<Filter>('all');`,
  `const [composerOpen, setComposerOpen] = useState(false); const [detailsOpen, setDetailsOpen] = useState(false); const [filter, setFilter] = useState<Filter>('all');`,
  'notes details state'
);
replaceOne(
  'src/app/features/notes.tsx',
  `function resetEditor(close = true) { setSelectedId(null); setSelectedUpdatedAt(null); setTitle(''); setBody(''); setVisibility('shared'); setPinned(false); setSelectedTagIds([]); if (close) setComposerOpen(false); }`,
  `function resetEditor(close = true) { setSelectedId(null); setSelectedUpdatedAt(null); setTitle(''); setBody(''); setVisibility('shared'); setPinned(false); setSelectedTagIds([]); setDetailsOpen(false); if (close) setComposerOpen(false); }`,
  'notes reset details'
);
replaceOne(
  'src/app/features/notes.tsx',
  `function select(note: CoupleNote) { setSelectedId(note.id); setSelectedUpdatedAt(note.updated_at); setTitle(note.title); setBody(note.body); setVisibility(note.visibility); setPinned(note.pinned); setSelectedTagIds((note.tags ?? []).map((tag) => tag.id)); setComposerOpen(true); }`,
  `function select(note: CoupleNote) { setSelectedId(note.id); setSelectedUpdatedAt(note.updated_at); setTitle(note.title); setBody(note.body); setVisibility(note.visibility); setPinned(note.pinned); setSelectedTagIds((note.tags ?? []).map((tag) => tag.id)); setDetailsOpen(true); setComposerOpen(true); }`,
  'notes edit opens details'
);
replaceOne(
  'src/app/features/notes.tsx',
  `const visible = useMemo(() => notes.filter((note) => filter === 'all' || (filter === 'pinned' ? note.pinned : note.visibility === filter)), [filter, notes]);`,
  `const visible = useMemo(() => notes.filter((note) => filter === 'all' || (filter === 'pinned' ? note.pinned : note.visibility === filter)), [filter, notes]);
  const selectedNote = selectedId ? notes.find((note) => note.id === selectedId) ?? null : null;
  const canMakePrivate = !selectedNote || selectedNote.creator_id === profile?.id;`,
  'notes privacy ownership rule'
);
replaceOne(
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
  'notes fast-create and privacy UX'
);

// Audit the intended progressive disclosure markers.
const expected = [
  ['src/app/features/tasks.tsx', 'Add dates & details'],
  ['src/app/features/memories.tsx', 'Add the story & details'],
  ['src/app/features/activities.tsx', 'What do you want to do?'],
  ['src/app/features/lists.tsx', 'What is this list for?'],
  ['src/app/features/countdowns.tsx', 'What are you counting down to?'],
  ['src/app/features/notes.tsx', 'Only the person who created a shared note can make it private.'],
];
const problems = expected.filter(([rel, marker]) => !read(rel).includes(marker)).map(([rel, marker]) => `${rel}: missing ${marker}`);
if (problems.length) {
  fs.writeFileSync(file('RELEASE_B2_FAST_CREATE_AUDIT_REMAINING.txt'), problems.join('\r\n') + '\r\n', 'utf8');
  console.log(`B2 audit found ${problems.length} item(s). See RELEASE_B2_FAST_CREATE_AUDIT_REMAINING.txt`);
} else {
  const report = file('RELEASE_B2_FAST_CREATE_AUDIT_REMAINING.txt');
  if (fs.existsSync(report)) fs.unlinkSync(report);
  console.log('B2 fast-create audit clean.');
}

console.log('');
console.log('Release B2 applied.');
console.log('Run:');
console.log('  npm.cmd run typecheck');
console.log('  npm.cmd --prefix server run typecheck');
console.log('  npm.cmd --prefix server run logic');
