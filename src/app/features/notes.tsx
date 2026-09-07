import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FormField } from '@/components/common/FormField';
import { ChoiceChips } from '@/components/common/ChoiceChips';
import { TagChip } from '@/components/common/TagChip';
import { TagSelector } from '@/components/common/TagSelector';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FeatureGroupCard } from '@/components/navigation/FeatureGroupCard';
import { createNote, deleteNote, getNotes, updateNote } from '@/services/backend/coreFeatures';
import { getTags } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import type { CoupleNote, Tag } from '@/types/database';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }
type Filter = 'all' | 'shared' | 'private' | 'pinned';

const noteTools = [
  { icon: 'draw', title: 'Shared scratchpad', subtitle: 'Quick, shared and intentionally unorganised', href: '/features/scratchpad' },
] as const;

export default function NotesScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ focus?: string }>();
  const { colorForUser } = useWorkspace();
  const [notes, setNotes] = useState<CoupleNote[]>([]); const [tags, setTags] = useState<Tag[]>([]); const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null); const [selectedUpdatedAt, setSelectedUpdatedAt] = useState<string | null>(null); const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [visibility, setVisibility] = useState<'shared' | 'private'>('shared'); const [pinned, setPinned] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false); const [filter, setFilter] = useState<Filter>('all'); const [deleteOpen, setDeleteOpen] = useState(false); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => { try { const [nextNotes, nextTags] = await Promise.all([getNotes(), getTags()]); setNotes(nextNotes); setTags(nextTags); } catch (error) { Alert.alert('Couldn’t load notes', messageFrom(error)); } finally { setLoading(false); } }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]); useRealtimeRefresh('notes', refresh); useRealtimeRefresh('tags', refresh);
  const visible = useMemo(() => notes.filter((note) => filter === 'all' || (filter === 'pinned' ? note.pinned : note.visibility === filter)), [filter, notes]);

  function resetEditor(close = true) { setSelectedId(null); setSelectedUpdatedAt(null); setTitle(''); setBody(''); setVisibility('shared'); setPinned(false); setSelectedTagIds([]); if (close) setComposerOpen(false); }
  function select(note: CoupleNote) { setSelectedId(note.id); setSelectedUpdatedAt(note.updated_at); setTitle(note.title); setBody(note.body); setVisibility(note.visibility); setPinned(note.pinned); setSelectedTagIds((note.tags ?? []).map((tag) => tag.id)); setComposerOpen(true); }
  useEffect(() => { if (!params.focus || selectedId === params.focus || !notes.length) return; const focused = notes.find((note) => note.id === params.focus); if (focused) select(focused); }, [params.focus, notes]);

  async function save() { if (!title.trim()) return; setBusy(true); try { if (selectedId) await updateNote(selectedId, { title: title.trim(), body, visibility, pinned, tagIds: selectedTagIds, updatedAt: selectedUpdatedAt ?? undefined }); else await createNote({ title: title.trim(), body, visibility, pinned, tagIds: selectedTagIds }); resetEditor(); await refresh(); } catch (error) { Alert.alert('Couldn’t save note', messageFrom(error)); } finally { setBusy(false); } }
  async function removeConfirmed() { if (!selectedId) return; setDeleteOpen(false); setBusy(true); try { await deleteNote(selectedId); setNotes((current) => current.filter((note) => note.id !== selectedId)); resetEditor(); } catch (error) { Alert.alert('Couldn’t delete note', messageFrom(error)); } finally { setBusy(false); } }

  return <AppScreen>
    <BackHeader eyebrow="Plan" title="Notes" subtitle="Saved writing you want to keep. Scratchpad stays quick and shared." />
    <View style={{ marginBottom: theme.spacing.lg }}><FeatureGroupCard title="Scratchpad" items={noteTools} /></View>
    <CollapsibleComposer title={selectedId ? 'Edit note' : 'Notes'} subtitle={selectedId ? 'Private notes remain private to their creator.' : `${notes.length} saved`} open={composerOpen} actionLabel="New note" closeLabel={selectedId ? 'Cancel edit' : 'Close'} tone={visibility === 'private' ? 'secondary' : 'accent'} style={{ marginBottom: theme.spacing.lg }} onToggle={() => composerOpen ? resetEditor() : setComposerOpen(true)}>
      <FormField label="TITLE" value={title} onChangeText={setTitle} placeholder="Flight details" />
      <FormField label="NOTE" value={body} onChangeText={setBody} placeholder="Keep the useful bits in one place…" multiline />
      <View style={{ gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">WHO CAN SEE THIS?</AppText><ChoiceChips value={visibility} onChange={setVisibility} options={[{ value: 'shared', label: '♥ Shared' }, { value: 'private', label: '🔒 Private' }]} /></View>
      <TagSelector tags={tags} selectedIds={selectedTagIds} onChange={setSelectedTagIds} />
      <Pressable accessibilityRole="button" onPress={() => setPinned((value) => !value)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ width: 22, height: 22, borderRadius: 7, borderWidth: 1, borderColor: pinned ? theme.colors.secondaryAccent : theme.colors.border, backgroundColor: pinned ? theme.colors.secondarySoft : 'transparent', alignItems: 'center', justifyContent: 'center' }}><AppText variant="caption" tone="secondary">{pinned ? '✓' : ''}</AppText></View><AppText variant="bodySmall" tone="secondary">Pin this note to the top</AppText></Pressable>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}><View style={{ flex: 1 }}><AppButton label={busy ? 'Saving…' : selectedId ? 'Save changes' : 'Add note'} disabled={busy || !title.trim()} onPress={save} /></View>{selectedId ? <AppButton compact label="Delete" variant="danger" disabled={busy} onPress={() => setDeleteOpen(true)} /> : null}</View>
    </CollapsibleComposer>
    <Card tone="secondary" style={{ marginBottom: theme.spacing.xxl, gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">FILTER</AppText><ChoiceChips value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'shared', label: 'Shared' }, { value: 'private', label: 'Private' }, { value: 'pinned', label: 'Pinned' }]} /></Card>
    <View style={{ gap: theme.spacing.md }}>
      {loading ? <AppText tone="muted">Loading notes…</AppText> : null}
      {!loading && visible.length === 0 ? <Card tone="secondary"><AppText tone="secondary">No notes in this view.</AppText></Card> : null}
      {visible.map((note) => { const creatorColor = colorForUser(note.creator_id); const updated = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(note.updated_at)); return <Pressable accessibilityRole="button" key={note.id} onPress={() => select(note)}>{({ pressed }) => <Card participantColor={creatorColor} style={{ gap: theme.spacing.sm, opacity: pressed ? 0.76 : 1, borderColor: selectedId === note.id ? theme.colors.accent : theme.colors.border }}><View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}><AppText variant="cardTitle" style={{ flex: 1 }}>{note.pinned ? '✦ ' : ''}{note.title}</AppText><TagChip subtle label={note.visibility === 'private' ? 'PRIVATE' : 'SHARED'} /></View>{note.body ? <AppText variant="bodySmall" tone="secondary" numberOfLines={3}>{note.body}</AppText> : null}{(note.tags ?? []).length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{(note.tags ?? []).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}</View> : null}<ParticipantAttribution userId={note.creator_id} suffix={updated} /></Card>}</Pressable>; })}
    </View>
    <ConfirmDialog visible={deleteOpen} title="Delete note?" body={`Delete “${title}”? This can’t be undone.`} onCancel={() => setDeleteOpen(false)} onConfirm={() => removeConfirmed().catch(() => undefined)} />
  </AppScreen>;
}
