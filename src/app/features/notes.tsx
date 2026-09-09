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
import { DetailsToggle } from '@/components/common/DetailsToggle';
import { RecordViewSheet } from '@/components/common/RecordViewSheet';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { IconButton } from '@/components/common/IconButton';
import { AppIcon } from '@/components/art/AppIcon';
import { GentleFloat } from '@/components/motion/Motion';
import { FeatureGroupCard } from '@/components/navigation/FeatureGroupCard';
import { createNote, deleteNote, getNotes, updateNote } from '@/services/backend/coreFeatures';
import { getTags } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { usePartnerPresence } from '@/hooks/usePartnerPresence';
import type { CoupleNote, Tag } from '@/types/database';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong. Please try again.'; }
type Filter = 'all' | 'shared' | 'private' | 'pinned';

const noteTools = [
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
            ? `${partnerName} is editing this shared note ♥`
            : `${partnerName} has this shared note open ♥`}
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
}

export default function NotesScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ focus?: string; edit?: string }>();
  const { colorForUser, profile } = useWorkspace();
  const [notes, setNotes] = useState<CoupleNote[]>([]); const [tags, setTags] = useState<Tag[]>([]); const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null); const [selectedUpdatedAt, setSelectedUpdatedAt] = useState<string | null>(null); const [title, setTitle] = useState(''); const [body, setBody] = useState(''); const [visibility, setVisibility] = useState<'shared' | 'private'>('shared'); const [pinned, setPinned] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false); const [detailsOpen, setDetailsOpen] = useState(false); const [filter, setFilter] = useState<Filter>('all'); const [viewTarget, setViewTarget] = useState<CoupleNote | null>(null); const [deleteTarget, setDeleteTarget] = useState<CoupleNote | null>(null); const [deleteOpen, setDeleteOpen] = useState(false); const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => { try { const [nextNotes, nextTags] = await Promise.all([getNotes(), getTags()]); setNotes(nextNotes); setTags(nextTags); } catch (error) { Alert.alert('Couldn’t load notes', messageFrom(error)); } finally { setLoading(false); } }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]); useRealtimeRefresh('notes', refresh); useRealtimeRefresh('tags', refresh);
  const visible = useMemo(() => notes.filter((note) => filter === 'all' || (filter === 'pinned' ? note.pinned : note.visibility === filter)), [filter, notes]);
  const selectedNote = selectedId ? notes.find((note) => note.id === selectedId) ?? null : null;
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
  const notePresenceScope = presenceNote ? `note:${presenceNote.id}:${notePresenceMode}` : 'note:none';
  const {
    partnerName: livePartnerName,
    partnerScope,
  } = usePartnerPresence(notePresenceScope, Boolean(presenceNote));
  const partnerOnSameNote = Boolean(
    presenceNote &&
    partnerScope?.startsWith(`note:${presenceNote.id}:`),
  );
  const partnerNoteMode: 'view' | 'edit' = partnerScope?.endsWith(':edit') ? 'edit' : 'view';

  function resetEditor(close = true) { setSelectedId(null); setSelectedUpdatedAt(null); setTitle(''); setBody(''); setVisibility('shared'); setPinned(false); setSelectedTagIds([]); setDetailsOpen(false); if (close) setComposerOpen(false); }
  function select(note: CoupleNote) { setSelectedId(note.id); setSelectedUpdatedAt(note.updated_at); setTitle(note.title); setBody(note.body); setVisibility(note.visibility); setPinned(note.pinned); setSelectedTagIds((note.tags ?? []).map((tag) => tag.id)); setDetailsOpen(true); setComposerOpen(true); }
  useEffect(() => { if (!params.focus || !notes.length) return; const focused = notes.find((note) => note.id === params.focus); if (focused) setViewTarget(focused); }, [params.focus, notes]);
  useEffect(() => { if (!params.edit || selectedId === params.edit || !notes.length) return; const target = notes.find((note) => note.id === params.edit); if (target) select(target); }, [params.edit, notes, selectedId]);

  async function save() { if (!title.trim()) return; setBusy(true); try { if (selectedId) await updateNote(selectedId, { title: title.trim(), body, visibility, pinned, tagIds: selectedTagIds, updatedAt: selectedUpdatedAt ?? undefined }); else await createNote({ title: title.trim(), body, visibility, pinned, tagIds: selectedTagIds }); resetEditor(); await refresh(); } catch (error) { Alert.alert('Couldn’t save note', messageFrom(error)); } finally { setBusy(false); } }
  async function removeConfirmed() { const target = deleteTarget ?? selectedNote; if (!target) return; setDeleteOpen(false); setDeleteTarget(null); setBusy(true); try { await deleteNote(target.id); setNotes((current) => current.filter((note) => note.id !== target.id)); if (selectedId === target.id) resetEditor(); if (viewTarget?.id === target.id) setViewTarget(null); } catch (error) { Alert.alert('Couldn’t delete note', messageFrom(error)); } finally { setBusy(false); } }
  function openNoteMenu(note: CoupleNote) {
    Alert.alert(note.title, 'Manage this note', [
      { text: 'Edit note', onPress: () => select(note) },
      { text: 'Delete note', style: 'destructive', onPress: () => { setDeleteTarget(note); setDeleteOpen(true); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return <AppScreen>
    <BackHeader eyebrow="Plan" title="Notes" subtitle="Saved writing you want to keep. Scratchpad stays quick and shared." />
    <View style={{ marginBottom: theme.spacing.lg }}><FeatureGroupCard title="Scratchpad" items={noteTools} /></View>
    <CollapsibleComposer title={selectedId ? 'Edit note' : 'Notes'} subtitle={selectedId ? 'Private notes remain private to their creator.' : `${notes.length} saved`} open={composerOpen} actionLabel="New note" closeLabel={selectedId ? 'Cancel edit' : 'Close'} tone={visibility === 'private' ? 'secondary' : 'accent'} style={{ marginBottom: theme.spacing.lg }} onToggle={() => composerOpen ? resetEditor() : setComposerOpen(true)}>
      {editingSharedNote && partnerOnSameNote ? <SharedNotePresence partnerName={livePartnerName} partnerMode={partnerNoteMode} /> : null}
      <FormField label="What is this note about?" value={title} onChangeText={setTitle} placeholder="Flight details" />
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
      </View> : null}
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}><View style={{ flex: 1 }}><AppButton label={busy ? 'Saving…' : selectedId ? 'Save changes' : 'Add note'} disabled={busy || !title.trim()} onPress={save} /></View>{selectedId ? <AppButton compact label="Delete" variant="danger" disabled={busy} onPress={() => { if (selectedNote) setDeleteTarget(selectedNote); setDeleteOpen(true); }} /> : null}</View>
    </CollapsibleComposer>
    <Card tone="secondary" style={{ marginBottom: theme.spacing.xxl, gap: theme.spacing.sm }}><AppText variant="caption" tone="secondary">FILTER</AppText><ChoiceChips value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'shared', label: 'Shared' }, { value: 'private', label: 'Private' }, { value: 'pinned', label: 'Pinned' }]} /></Card>
    <View style={{ gap: theme.spacing.md }}>
      {loading ? <AppText tone="muted">Loading notes…</AppText> : null}
      {!loading && visible.length === 0 ? <Card tone="secondary"><AppText tone="secondary">No notes in this view.</AppText></Card> : null}
      {visible.map((note) => {
        const creatorColor = colorForUser(note.creator_id);
        const updated = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(note.updated_at));
        return <Card key={note.id} participantColor={note.visibility === 'shared' ? 'both' : creatorColor} style={{ gap: theme.spacing.sm, borderColor: selectedId === note.id ? theme.colors.accent : theme.colors.border }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-start' }}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Open note ${note.title}`} onPress={() => setViewTarget(note)} style={({ pressed }) => ({ flex: 1, gap: theme.spacing.sm, opacity: pressed ? 0.76 : 1 })}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.sm }}><AppText variant="cardTitle" style={{ flex: 1 }}>{note.pinned ? '✦ ' : ''}{note.title}</AppText><TagChip subtle label={note.visibility === 'private' ? 'PRIVATE' : 'SHARED'} /></View>
              {note.body ? <AppText variant="bodySmall" tone="secondary" numberOfLines={3}>{note.body}</AppText> : null}
              {(note.tags ?? []).length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{(note.tags ?? []).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}</View> : null}
              <ParticipantAttribution userId={note.creator_id} suffix={updated} />
            </Pressable>
            <IconButton icon="overflow" label={`More actions for ${note.title}`} onPress={() => openNoteMenu(note)} />
          </View>
        </Card>;
      })}
    </View>
    <RecordViewSheet visible={!!viewTarget} onClose={() => setViewTarget(null)} eyebrow={viewTarget?.visibility === 'private' ? 'Private note' : 'Shared note'} title={viewTarget?.title ?? ''}>
      {viewTarget ? <View style={{ gap: theme.spacing.md }}>
        {viewTarget.visibility === 'shared' && presenceNote?.id === viewTarget.id && partnerOnSameNote
          ? <SharedNotePresence partnerName={livePartnerName} partnerMode={partnerNoteMode} />
          : null}
        <ParticipantAttribution userId={viewTarget.creator_id} suffix={new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(viewTarget.updated_at))} />
        <AppText tone={viewTarget.body ? 'primary' : 'muted'}>{viewTarget.body || 'This note has no body.'}</AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          <TagChip subtle label={viewTarget.visibility === 'private' ? 'PRIVATE' : 'SHARED'} />
          {viewTarget.pinned ? <TagChip subtle label="PINNED" /> : null}
          {(viewTarget.tags ?? []).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}
        </View>
      </View> : null}
    </RecordViewSheet>
    <ConfirmDialog visible={deleteOpen} title="Delete note?" body={deleteTarget ? `Delete “${deleteTarget.title}”? This can’t be undone.` : `Delete “${title}”? This can’t be undone.`} onCancel={() => setDeleteOpen(false)} onConfirm={() => removeConfirmed().catch(() => undefined)} />
  </AppScreen>;
}
