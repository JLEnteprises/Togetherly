import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
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
import { ToggleRow } from '@/components/common/ToggleRow';
import { EmptyState } from '@/components/common/EmptyState';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { ComposerSheet } from '@/components/common/ComposerSheet';
import { DetailsToggle } from '@/components/common/DetailsToggle';
import { DatePickerField } from '@/components/common/DatePickerField';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { IconButton } from '@/components/common/IconButton';
import { MemoryDetailModal } from '@/components/memories/MemoryDetailModal';
import { MemoryPhotoField } from '@/components/memories/MemoryPhotoField';
import { PhotoViewer } from '@/components/photos/PhotoViewer';
import { createMemory, deleteMemory, getMemories, getTags, updateMemory, getEvents, getTrip } from '@/services/backend/mvpFeatures';
import { getPhotos } from '@/services/backend/photos';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import { formatMemoryDate, memoryPhotoCount } from '@/utils/memories';
import { localDateKey } from '@/utils/experience';
import type { CoupleMemory, CouplePhoto, Tag } from '@/types/database';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }
type Filter = 'all' | 'milestones' | 'mine' | 'partner';

// G5_US_STORY_CONSOLIDATION: Memories focuses on memory entries; Us owns Photos, Timeline and rediscovery navigation.
// G6_COMPOSER_SHEETS: major create/edit flow uses the explicit shared ComposerSheet primitive.
// H3_MEMORY_PHOTO_INTEGRATION: Memories link to first-class Photos, can choose existing images, and photo taps open PhotoViewer.
export default function MemoriesScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ focus?: string; edit?: string; sourceEvent?: string; sourceTrip?: string }>();
  const { profile, partnerProfile } = useWorkspace();

  const [memories, setMemories] = useState<CoupleMemory[]>([]);
  const [photos, setPhotos] = useState<CouplePhoto[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [source, setSource] = useState<{ event?: string; trip?: string }>({});
  const hydratedSource = useRef('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [emoji, setEmoji] = useState('✦');
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [uploadUrls, setUploadUrls] = useState<string[]>([]);
  const [milestone, setMilestone] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [composerOpen, setComposerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailTarget, setDetailTarget] = useState<CoupleMemory | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CoupleMemory | null>(null);
  const [loading, setLoading] = useState(true);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<CouplePhoto[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [nextMemories, nextPhotos, nextTags] = await Promise.all([getMemories(), getPhotos(), getTags()]);
      setMemories(nextMemories);
      setPhotos(nextPhotos);
      setTags(nextTags);
    } catch (error) {
      Alert.alert('Couldn’t load memories', messageFrom(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('memories', refresh);
  useRealtimeRefresh('photos', refresh);
  useRealtimeRefresh('tags', refresh);

  const photoById = useMemo(() => new Map(photos.map((photo) => [photo.id, photo])), [photos]);

  const visible = useMemo(
    () => memories
      .filter((memory) => filter === 'all'
        || (filter === 'milestones'
          ? memory.is_milestone
          : filter === 'mine'
            ? memory.creator_id === profile?.id
            : memory.creator_id === partnerProfile?.id))
      .sort((a, b) => b.memory_date.localeCompare(a.memory_date)),
    [filter, memories, partnerProfile?.id, profile?.id],
  );

  function resetForm(close = true) {
    setSource({});
    setEditingId(null);
    setTitle('');
    setDate('');
    setDescription('');
    setLocation('');
    setEmoji('✦');
    setSelectedPhotoIds([]);
    setUploadUrls([]);
    setMilestone(false);
    setSelectedTags([]);
    setDetailsOpen(false);
    if (close) setComposerOpen(false);
  }

  function beginEdit(memory: CoupleMemory) {
    setSource({});
    setEditingId(memory.id);
    setTitle(memory.title);
    setDate(memory.memory_date);
    setDescription(memory.description ?? '');
    setLocation(memory.location ?? '');
    setEmoji(memory.emoji || '✦');
    setSelectedPhotoIds((memory.photos ?? []).map((photo) => photo.id).filter((id): id is string => Boolean(id)));
    setUploadUrls([]);
    setMilestone(Boolean(memory.is_milestone));
    setSelectedTags((memory.tags ?? []).map((tag) => tag.id));
    setDetailsOpen(true);
    setComposerOpen(true);
  }

  function standalonePhotosForMemory(memory: CoupleMemory) {
    return (memory.photos ?? [])
      .map((photo) => photo.id ? photoById.get(photo.id) ?? null : null)
      .filter((photo): photo is CouplePhoto => Boolean(photo));
  }

  function openMemoryPhoto(memory: CoupleMemory, requestedIndex: number) {
    const linked = standalonePhotosForMemory(memory);
    if (!linked.length) {
      setDetailTarget(memory);
      return;
    }

    const requestedId = memory.photos?.[requestedIndex]?.id ?? null;
    const index = requestedId ? Math.max(0, linked.findIndex((photo) => photo.id === requestedId)) : 0;
    setViewerPhotos(linked);
    setViewerIndex(index);
    setViewerVisible(true);
  }

  useEffect(() => {
    if (!params.focus || !memories.length) return;
    const focused = memories.find((memory) => memory.id === params.focus);
    if (focused) setDetailTarget(focused);
  }, [params.focus, memories]);

  useEffect(() => {
    if (!params.edit || editingId === params.edit || !memories.length) return;
    const target = memories.find((memory) => memory.id === params.edit);
    if (target) beginEdit(target);
  }, [params.edit, memories, editingId]);

  useEffect(() => {
    const key = params.sourceEvent || params.sourceTrip || '';
    if (!key || hydratedSource.current === key) return;
    let active = true;
    async function loadSource() {
      try {
        if (params.sourceEvent) {
          const event = (await getEvents()).find((item) => item.id === params.sourceEvent);
          if (!event) throw new Error('The calendar event is no longer available.');
          if (!active) return;
          setTitle(event.title); setDate(event.start_date || localDateKey(new Date(event.start_at))); setLocation(event.location || ''); setSource({ event: event.id });
        } else if (params.sourceTrip) {
          const { trip } = await getTrip(params.sourceTrip);
          if (!active) return;
          setTitle(trip.title); setDate(trip.start_date || localDateKey()); setLocation(trip.destination || ''); setSource({ trip: trip.id });
        }
        hydratedSource.current = key; setComposerOpen(true);
      } catch (error) { if (active) Alert.alert('Couldn’t open the plan', messageFrom(error)); }
    }
    void loadSource(); return () => { active = false; };
  }, [params.sourceEvent, params.sourceTrip]);

  async function save() {
    if (!title.trim() || !date) {
      Alert.alert('Check the memory', 'Add a title and choose a date.');
      return;
    }

    setBusy(true);
    try {
      const input = {
        sourceEventId: source.event,
        sourceTripId: source.trip,
        title: title.trim(),
        memoryDate: date,
        description,
        location,
        emoji: emoji.trim() || '✦',
        photoIds: selectedPhotoIds,
        photoUrls: uploadUrls,
        isMilestone: milestone,
        tagIds: selectedTags,
      };
      if (editingId) await updateMemory(editingId, input);
      else await createMemory(input);
      resetForm();
      await refresh();
    } catch (error) {
      Alert.alert(editingId ? 'Couldn’t update memory' : 'Couldn’t save memory', messageFrom(error));
    } finally {
      setBusy(false);
    }
  }

  async function toggleMilestone(memory: CoupleMemory) {
    try {
      await updateMemory(memory.id, { isMilestone: !memory.is_milestone });
      await refresh();
    } catch (error) {
      Alert.alert('Couldn’t update memory', messageFrom(error));
    }
  }

  async function removeConfirmed() {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (!target) return;

    try {
      await deleteMemory(target.id);
      setMemories((current) => current.filter((memory) => memory.id !== target.id));
      if (editingId === target.id) resetForm();
      await refresh();
    } catch (error) {
      Alert.alert('Couldn’t delete memory', messageFrom(error));
    }
  }

  function openMemoryMenu(memory: CoupleMemory) {
    Alert.alert(memory.title, 'Manage this memory', [
      { text: memory.is_milestone ? 'Remove from timeline' : 'Add to timeline', onPress: () => toggleMilestone(memory) },
      { text: 'Edit memory', onPress: () => beginEdit(memory) },
      { text: 'Delete', style: 'destructive', onPress: () => setDeleteTarget(memory) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return <AppScreen>
    <BackHeader eyebrow="Our story" title="Memories" subtitle="The moments you chose to keep, all in one place." />

    <ComposerSheet
      title={editingId ? 'Edit memory' : 'Add a memory'}
      subtitle={`${memories.length} memories saved`}
      open={composerOpen}
      actionLabel="New memory"
      closeLabel={editingId ? 'Cancel edit' : 'Close'}
      tone="accent"
      style={{ marginBottom: theme.spacing.lg }}
      dirty={Boolean(title || description || uploadUrls.length || selectedPhotoIds.length)} onDiscard={() => resetForm()} busy={busy} onToggle={() => setComposerOpen(!composerOpen)}
    >
      <FormField label="What happened?" value={title} onChangeText={setTitle} placeholder="First meeting" />
      <DatePickerField label="When was it?" value={date} onChange={setDate} />
      <MemoryPhotoField
        photos={photos}
        memoryId={editingId}
        selectedIds={selectedPhotoIds}
        onSelectedIdsChange={setSelectedPhotoIds}
        uploadUrls={uploadUrls}
        onUploadUrlsChange={setUploadUrls}
      />
      <DetailsToggle
        open={detailsOpen}
        onToggle={() => setDetailsOpen((value) => !value)}
        closedLabel="Add the story & details"
        openLabel="Hide story & details"
        hint="Description, place, icon, milestone and tags."
      />
      {detailsOpen ? <View style={{ gap: theme.spacing.lg }}>
        <FormField label="What do you want to remember?" value={description} onChangeText={setDescription} multiline placeholder="What happened, what it felt like, the little details…" />
        <FormField label="Where were you?" value={location} onChangeText={setLocation} placeholder="Optional" />
        <FormField label="Memory icon" value={emoji} onChangeText={setEmoji} maxLength={8} placeholder="✦" />
        <ToggleRow label="Relationship milestone" subtitle="Show this memory on your timeline." value={milestone} onChange={setMilestone} />
        <TagSelector tags={tags} selectedIds={selectedTags} onChange={setSelectedTags} />
      </View> : null}
      <AppButton label={busy ? 'Saving…' : editingId ? 'Update memory' : 'Save memory'} disabled={busy || !title.trim() || !date} onPress={save} />
    </ComposerSheet>

    <View style={{ marginBottom: theme.spacing.xxl }}>
      <ChoiceChips
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'milestones', label: 'Milestones' },
          { value: 'mine', label: profile?.display_name ?? 'Mine' },
          ...(partnerProfile ? [{ value: 'partner' as const, label: partnerProfile.display_name }] : []),
        ]}
      />
    </View>

    <View style={{ gap: theme.spacing.md }}>
      {loading ? <AppText tone="muted">Loading memories…</AppText> : null}
      {/* F2_EMPTY_STATE_COACHING: memory empties coach the first save and make filtered views recoverable. */}
      {!loading && visible.length === 0 ? <EmptyState
        icon="memory"
        eyebrow={memories.length ? 'NOTHING IN THIS FILTER' : 'START WITH ONE MOMENT'}
        title={memories.length ? 'No memories in this view' : 'Your story starts here'}
        body={memories.length ? 'The rest of your story is still saved — this filter just has nothing to show.' : 'Save the ordinary days too. They become the good stuff later.'}
        tip={memories.length ? 'Show all memories again, then use Milestones only for the moments that really changed your story.' : 'A photo from today, an inside joke, or the first time you did something together is enough.'}
        actionLabel={memories.length ? 'Show all memories' : 'Add a memory'}
        onAction={memories.length ? () => setFilter('all') : () => setComposerOpen(true)}
      /> : null}

      {visible.map((memory) => {
        const memoryPhotos = memory.photos ?? [];
        const firstUrl = memoryPhotos[0]?.media_url ?? memory.photo_url;
        return <Card key={memory.id} participantColor="both" style={{ gap: theme.spacing.md, overflow: 'hidden', borderColor: editingId === memory.id ? theme.colors.accent : theme.colors.border }}>
          {firstUrl ? <View style={{ gap: theme.spacing.sm }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open photo from ${memory.title}`}
              onPress={() => openMemoryPhoto(memory, 0)}
              style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}
            >
              <Image source={{ uri: firstUrl }} resizeMode="cover" style={{ width: '100%', height: 210, borderRadius: theme.radii.md, backgroundColor: theme.colors.elevatedBackground }} />
            </Pressable>

            {memoryPhotos.length > 1 ? <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              {memoryPhotos.slice(1, 5).map((photo, index) => (
                <Pressable
                  key={photo.id ?? `${memory.id}-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Open photo ${index + 2} from ${memory.title}`}
                  onPress={() => openMemoryPhoto(memory, index + 1)}
                >
                  <Image source={{ uri: photo.media_url }} resizeMode="cover" style={{ width: 58, height: 58, borderRadius: theme.radii.sm, backgroundColor: theme.colors.elevatedBackground }} />
                </Pressable>
              ))}
              {memoryPhotos.length > 5 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open remaining photos from ${memory.title}`}
                  onPress={() => openMemoryPhoto(memory, 4)}
                  style={{ width: 58, height: 58, borderRadius: theme.radii.sm, backgroundColor: theme.colors.elevatedBackground, alignItems: 'center', justifyContent: 'center' }}
                >
                  <AppText variant="caption" tone="secondary">+{memoryPhotos.length - 5}</AppText>
                </Pressable>
              ) : null}
            </View> : null}
          </View> : null}

          <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open memory ${memory.title}`}
              onPress={() => setDetailTarget(memory)}
              style={({ pressed }) => ({ flex: 1, gap: 5, opacity: pressed ? 0.78 : 1 })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                <AppText variant="section">{memory.emoji}</AppText>
                <AppText variant="section" style={{ flex: 1 }}>{memory.title}</AppText>
              </View>
              <ParticipantAttribution userId={memory.creator_id} />
              <AppText variant="caption" tone="secondary">{formatMemoryDate(memory.memory_date)}{memory.location ? ` · ${memory.location}` : ''}</AppText>
              {memory.description ? <AppText tone="secondary" numberOfLines={3}>{memory.description}</AppText> : <AppText variant="bodySmall" tone="muted">Tap to open this memory.</AppText>}
            </Pressable>
            <IconButton icon="overflow" label={`More actions for ${memory.title}`} onPress={() => openMemoryMenu(memory)} />
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {memory.is_milestone ? <TagChip label="MILESTONE" /> : null}
            {memoryPhotoCount(memory) > 1 ? <TagChip subtle label={`${memoryPhotoCount(memory)} PHOTOS`} /> : null}
            {(memory.tags ?? []).slice(0, 3).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}
          </View>
        </Card>;
      })}
    </View>

    <MemoryDetailModal
      memory={detailTarget}
      visible={!!detailTarget}
      onClose={() => setDetailTarget(null)}
      onEdit={(memory) => { setDetailTarget(null); beginEdit(memory); }}
      onPhotoPress={(memory, index) => {
        setDetailTarget(null);
        openMemoryPhoto(memory, index);
      }}
    />

    <PhotoViewer
      visible={viewerVisible}
      photos={viewerPhotos}
      initialIndex={viewerIndex}
      onClose={() => setViewerVisible(false)}
      onViewMemory={(photo) => {
        if (!photo.linked_memory_id) return;
        const memory = memories.find((item) => item.id === photo.linked_memory_id);
        setViewerVisible(false);
        if (memory) setDetailTarget(memory);
      }}
    />

    <ConfirmDialog
      visible={!!deleteTarget}
      title="Delete memory?"
      body={deleteTarget ? `Delete “${deleteTarget.title}”? The photos will stay in your shared gallery.` : ''}
      onCancel={() => setDeleteTarget(null)}
      onConfirm={() => removeConfirmed().catch(() => undefined)}
    />
  </AppScreen>;
}
