import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { AppText } from '@/components/common/AppText';
import { AppButton } from '@/components/common/AppButton';
import { FormField } from '@/components/common/FormField';
import { MultiPhotoPickerField } from '@/components/common/MultiPhotoPickerField';
import { ChoiceChips } from '@/components/common/ChoiceChips';
import { TagChip } from '@/components/common/TagChip';
import { TagSelector } from '@/components/common/TagSelector';
import { ToggleRow } from '@/components/common/ToggleRow';
import { EmptyState } from '@/components/common/EmptyState';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';
import { DatePickerField } from '@/components/common/DatePickerField';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { FeatureGroupCard } from '@/components/navigation/FeatureGroupCard';
import { IconButton } from '@/components/common/IconButton';
import { createMemory, deleteMemory, getMemories, getTags, updateMemory } from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import type { CoupleMemory, Tag } from '@/types/database';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }
type Filter = 'all' | 'milestones' | 'mine' | 'partner';

const storyViews = [
  { icon: 'photo', title: 'Photos', subtitle: 'All photos and albums', href: '/features/photos' },
  { icon: 'timeline', title: 'Timeline', subtitle: 'See relationship milestones in order', href: '/features/timeline' },
  { icon: 'jar', title: 'Memory Jar', subtitle: 'Bring back a random saved moment', href: '/features/memory-jar' },
] as const;

export default function MemoriesScreen() {
  const theme = useAppTheme(); const params = useLocalSearchParams<{ focus?: string }>(); const { colorForUser, profile, partnerProfile } = useWorkspace();
  const [memories, setMemories] = useState<CoupleMemory[]>([]); const [tags, setTags] = useState<Tag[]>([]); const [title, setTitle] = useState(''); const [date, setDate] = useState(''); const [description, setDescription] = useState(''); const [location, setLocation] = useState(''); const [emoji, setEmoji] = useState('✦'); const [photoUrls, setPhotoUrls] = useState<string[]>([]); const [milestone, setMilestone] = useState(false); const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [composerOpen, setComposerOpen] = useState(false); const [filter, setFilter] = useState<Filter>('all'); const [busy, setBusy] = useState(false); const [editingId, setEditingId] = useState<string | null>(null); const [deleteTarget, setDeleteTarget] = useState<CoupleMemory | null>(null); const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => { try { const [nextMemories, nextTags] = await Promise.all([getMemories(), getTags()]); setMemories(nextMemories); setTags(nextTags); } catch (error) { Alert.alert('Couldn’t load memories', messageFrom(error)); } finally { setLoading(false); } }, []);
  useEffect(() => { refresh().catch(() => undefined); }, [refresh]); useRealtimeRefresh('memories', refresh); useRealtimeRefresh('tags', refresh);
  const visible = useMemo(() => memories.filter((memory) => filter === 'all' || (filter === 'milestones' ? memory.is_milestone : filter === 'mine' ? memory.creator_id === profile?.id : memory.creator_id === partnerProfile?.id)), [filter, memories, partnerProfile?.id, profile?.id]);
  function resetForm(close = true) { setEditingId(null); setTitle(''); setDate(''); setDescription(''); setLocation(''); setEmoji('✦'); setPhotoUrls([]); setMilestone(false); setSelectedTags([]); if (close) setComposerOpen(false); }
  function beginEdit(memory: CoupleMemory) { setEditingId(memory.id); setTitle(memory.title); setDate(memory.memory_date); setDescription(memory.description ?? ''); setLocation(memory.location ?? ''); setEmoji(memory.emoji || '✦'); setPhotoUrls((memory.photos ?? []).map((photo) => photo.media_url).length ? (memory.photos ?? []).map((photo) => photo.media_url) : memory.photo_url ? [memory.photo_url] : []); setMilestone(Boolean(memory.is_milestone)); setSelectedTags((memory.tags ?? []).map((tag) => tag.id)); setComposerOpen(true); }
  useEffect(() => { if (!params.focus || editingId === params.focus || !memories.length) return; const focused = memories.find((memory) => memory.id === params.focus); if (focused) beginEdit(focused); }, [params.focus, memories]);
  async function save() { if (!title.trim() || !date) { Alert.alert('Check the memory', 'Add a title and choose a date.'); return; } setBusy(true); try { const input = { title: title.trim(), memoryDate: date, description, location, emoji: emoji.trim() || '✦', photoUrls, isMilestone: milestone, tagIds: selectedTags }; if (editingId) await updateMemory(editingId, input); else await createMemory(input); resetForm(); await refresh(); } catch (error) { Alert.alert(editingId ? 'Couldn’t update memory' : 'Couldn’t save memory', messageFrom(error)); } finally { setBusy(false); } }
  async function toggleMilestone(memory: CoupleMemory) { try { await updateMemory(memory.id, { isMilestone: !memory.is_milestone }); await refresh(); } catch (error) { Alert.alert('Couldn’t update memory', messageFrom(error)); } }
  async function removeConfirmed() { const target = deleteTarget; setDeleteTarget(null); if (!target) return; try { await deleteMemory(target.id); setMemories((current) => current.filter((memory) => memory.id !== target.id)); if (editingId === target.id) resetForm(); } catch (error) { Alert.alert('Couldn’t delete memory', messageFrom(error)); } }
  function openMemoryMenu(memory: CoupleMemory) {
    Alert.alert(memory.title, 'Manage this memory', [
      { text: memory.is_milestone ? 'Remove from timeline' : 'Add to timeline', onPress: () => toggleMilestone(memory) },
      { text: 'Edit memory', onPress: () => beginEdit(memory) },
      { text: 'Delete', style: 'destructive', onPress: () => setDeleteTarget(memory) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }
  return <AppScreen>
    <BackHeader eyebrow="Us" title="Memories" subtitle="Keep the moment. Hide the admin." />
    <View style={{ marginBottom: theme.spacing.lg }}><FeatureGroupCard eyebrow="BROWSE" title="Our story" items={storyViews} /></View>
    <CollapsibleComposer title={editingId ? 'Edit memory' : 'Add a memory'} subtitle={`${memories.length} memories saved`} open={composerOpen} actionLabel="New memory" closeLabel={editingId ? 'Cancel edit' : 'Close'} tone="accent" style={{ marginBottom: theme.spacing.lg }} onToggle={() => composerOpen ? resetForm() : setComposerOpen(true)}>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}><View style={{ width: 82 }}><FormField label="ICON" value={emoji} onChangeText={setEmoji} maxLength={8} placeholder="✦" /></View><View style={{ flex: 1 }}><FormField label="TITLE" value={title} onChangeText={setTitle} placeholder="First meeting" /></View></View>
      <DatePickerField label="DATE" value={date} onChange={setDate} /><FormField label="DESCRIPTION" value={description} onChangeText={setDescription} multiline placeholder="What happened, what it felt like, the little details…" /><FormField label="LOCATION · OPTIONAL" value={location} onChangeText={setLocation} placeholder="Where were you?" /><MultiPhotoPickerField label="PHOTOS · OPTIONAL" values={photoUrls} onChange={setPhotoUrls} /><ToggleRow label="Relationship milestone" subtitle="Show this memory on your timeline." value={milestone} onChange={setMilestone} /><TagSelector tags={tags} selectedIds={selectedTags} onChange={setSelectedTags} /><AppButton label={busy ? 'Saving…' : editingId ? 'Update memory' : 'Save memory'} disabled={busy || !title.trim() || !date} onPress={save} />
    </CollapsibleComposer>
    <View style={{ marginBottom: theme.spacing.xxl }}><ChoiceChips value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'milestones', label: 'Milestones' }, { value: 'mine', label: profile?.display_name ?? 'Mine' }, ...(partnerProfile ? [{ value: 'partner' as const, label: partnerProfile.display_name }] : [])]} /></View>
    <View style={{ gap: theme.spacing.md }}>
      {loading ? <AppText tone="muted">Loading memories…</AppText> : null}
      {!loading && visible.length === 0 ? <EmptyState icon="memory" title={memories.length ? 'No memories in this view' : 'Your story starts here'} body={memories.length ? 'Switch the filter to see other saved moments.' : 'Save the ordinary days too. They become the good stuff later.'} actionLabel={memories.length ? undefined : 'Add a memory'} onAction={memories.length ? undefined : () => setComposerOpen(true)} /> : null}
      {visible.map((memory) => <Card key={memory.id} participantColor={colorForUser(memory.creator_id)} style={{ gap: theme.spacing.md, overflow: 'hidden', borderColor: editingId === memory.id ? theme.colors.accent : theme.colors.border }}>
        {((memory.photos ?? []).length || memory.photo_url) ? <View style={{ gap: theme.spacing.sm }}><Image source={{ uri: (memory.photos?.[0]?.media_url ?? memory.photo_url)! }} resizeMode="cover" style={{ width: '100%', height: 210, borderRadius: theme.radii.md, backgroundColor: theme.colors.elevatedBackground }} />{(memory.photos ?? []).length > 1 ? <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>{(memory.photos ?? []).slice(1, 5).map((photo, index) => <Image key={photo.id ?? `${memory.id}-${index}`} source={{ uri: photo.media_url }} resizeMode="cover" style={{ width: 58, height: 58, borderRadius: theme.radii.sm, backgroundColor: theme.colors.elevatedBackground }} />)}{(memory.photos ?? []).length > 5 ? <View style={{ width: 58, height: 58, borderRadius: theme.radii.sm, backgroundColor: theme.colors.elevatedBackground, alignItems: 'center', justifyContent: 'center' }}><AppText variant="caption" tone="secondary">+{(memory.photos ?? []).length - 5}</AppText></View> : null}</View> : null}</View> : null}
        <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 5 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}><AppText variant="section">{memory.emoji}</AppText><AppText variant="section" style={{ flex: 1 }}>{memory.title}</AppText></View><ParticipantAttribution userId={memory.creator_id} /><AppText variant="caption" tone="secondary">{memory.memory_date}{memory.location ? ` · ${memory.location}` : ''}</AppText>{memory.description ? <AppText tone="secondary">{memory.description}</AppText> : null}</View>
          <IconButton icon="overflow" label={`More actions for ${memory.title}`} onPress={() => openMemoryMenu(memory)} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>{memory.is_milestone ? <TagChip label="MILESTONE" /> : null}{(memory.tags ?? []).slice(0, 3).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}</View>
      </Card>)}
    </View>
    <ConfirmDialog visible={!!deleteTarget} title="Delete memory?" body={deleteTarget ? `Delete “${deleteTarget.title}”?` : ''} onCancel={() => setDeleteTarget(null)} onConfirm={() => removeConfirmed().catch(() => undefined)} />
  </AppScreen>;
}
