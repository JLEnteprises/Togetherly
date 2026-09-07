import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppScreen } from '@/components/common/AppScreen';
import { BackHeader } from '@/components/common/BackHeader';
import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { EmptyState } from '@/components/common/EmptyState';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { ChoiceChips } from '@/components/common/ChoiceChips';
import { CollapsibleComposer } from '@/components/common/CollapsibleComposer';
import { FormField } from '@/components/common/FormField';
import { AppButton } from '@/components/common/AppButton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { IconButton } from '@/components/common/IconButton';
import { AppIcon } from '@/components/art/AppIcon';
import {
  addMemoryToAlbum,
  createMemoryAlbum,
  deleteMemoryAlbum,
  getMemories,
  getMemoryAlbum,
  getMemoryAlbums,
  removeMemoryFromAlbum,
  updateMemoryAlbum,
} from '@/services/backend/mvpFeatures';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { useAppTheme } from '@/theme/useAppTheme';
import type { CoupleMemory, MemoryAlbum } from '@/types/database';

type GalleryPhoto = { key: string; url: string; memory: CoupleMemory; index: number };
type PhotoView = 'all' | 'albums';

function messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }

export default function PhotosScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ view?: string }>();
  const { colorForUser } = useWorkspace();
  const [view, setView] = useState<PhotoView>(params.view === 'albums' ? 'albums' : 'all');
  const [memories, setMemories] = useState<CoupleMemory[]>([]);
  const [albums, setAlbums] = useState<MemoryAlbum[]>([]);
  const [selected, setSelected] = useState<MemoryAlbum | null>(null);
  const [albumMemories, setAlbumMemories] = useState<CoupleMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [albumEditOpen, setAlbumEditOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MemoryAlbum | null>(null);

  useEffect(() => { if (params.view === 'albums') setView('albums'); }, [params.view]);

  const refresh = useCallback(async () => {
    try {
      const [nextMemories, nextAlbums] = await Promise.all([getMemories(), getMemoryAlbums()]);
      setMemories(nextMemories);
      setAlbums(nextAlbums);
      if (selected?.id) {
        const detail = await getMemoryAlbum(selected.id);
        setSelected({ ...detail.album, memory_count: detail.memories.length, cover_url: nextAlbums.find((album) => album.id === selected.id)?.cover_url ?? null });
        setAlbumMemories(detail.memories);
      }
    } catch (error) { Alert.alert('Couldn’t load photos', messageFrom(error)); }
    finally { setLoading(false); }
  }, [selected?.id]);

  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);
  useRealtimeRefresh('memories', refresh);

  const photos = useMemo<GalleryPhoto[]>(() => memories.flatMap((memory) => {
    const attached = (memory.photos ?? []).filter((photo) => Boolean(photo.media_url));
    if (attached.length) return attached.map((photo, index) => ({ key: photo.id ?? `${memory.id}:${index}:${photo.media_url.slice(-24)}`, url: photo.media_url, memory, index }));
    return memory.photo_url ? [{ key: `${memory.id}:legacy`, url: memory.photo_url, memory, index: 0 }] : [];
  }), [memories]);

  async function openAlbum(album: MemoryAlbum) {
    try {
      const detail = await getMemoryAlbum(album.id);
      setSelected({ ...detail.album, memory_count: detail.memories.length, cover_url: album.cover_url });
      setAlbumMemories(detail.memories);
      setEditTitle(detail.album.title);
      setEditDescription(detail.album.description ?? '');
      setPickerOpen(false);
      setAlbumEditOpen(false);
    } catch (error) { Alert.alert('Couldn’t open album', messageFrom(error)); }
  }

  async function saveAlbum() {
    if (!title.trim()) return;
    try {
      const album = await createMemoryAlbum({ title: title.trim(), description });
      setTitle(''); setDescription(''); setComposerOpen(false);
      await refresh();
      await openAlbum(album);
    } catch (error) { Alert.alert('Couldn’t create album', messageFrom(error)); }
  }

  async function saveAlbumDetails() {
    if (!selected || !editTitle.trim()) return;
    try {
      const updated = await updateMemoryAlbum(selected.id, { title: editTitle.trim(), description: editDescription });
      setSelected((current) => current ? { ...current, ...updated } : current);
      setAlbumEditOpen(false);
      await refresh();
    } catch (error) { Alert.alert('Couldn’t update album', messageFrom(error)); }
  }

  async function toggleMemory(memory: CoupleMemory) {
    if (!selected) return;
    const inside = albumMemories.some((item) => item.id === memory.id);
    try {
      if (inside) await removeMemoryFromAlbum(selected.id, memory.id);
      else await addMemoryToAlbum(selected.id, memory.id);
      const detail = await getMemoryAlbum(selected.id);
      setAlbumMemories(detail.memories);
      await refresh();
    } catch (error) { Alert.alert('Couldn’t update album', messageFrom(error)); }
  }

  async function removeAlbum() {
    const album = deleteTarget;
    setDeleteTarget(null);
    if (!album) return;
    try {
      await deleteMemoryAlbum(album.id);
      if (selected?.id === album.id) { setSelected(null); setAlbumMemories([]); }
      await refresh();
    } catch (error) { Alert.alert('Couldn’t delete album', messageFrom(error)); }
  }

  if (selected) {
    return (
      <AppScreen>
        <BackHeader eyebrow="Photos · Album" title={selected.title} subtitle={selected.description || `${albumMemories.length} memories`} onBack={() => { setSelected(null); setAlbumMemories([]); }} />
        <Card participantColor={colorForUser(selected.creator_id)} style={{ gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md, alignItems: 'center' }}>
            <View style={{ flex: 1 }}><ParticipantAttribution userId={selected.creator_id} /><AppText variant="bodySmall" tone="secondary">{albumMemories.length} memories</AppText></View>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}><AppButton compact variant="ghost" label={albumEditOpen ? 'Done' : 'Edit'} onPress={() => setAlbumEditOpen((value) => !value)} /><AppButton compact variant="secondary" label={pickerOpen ? 'Done adding' : 'Add'} onPress={() => setPickerOpen((value) => !value)} /></View>
          </View>
          {albumEditOpen ? <View style={{ gap: theme.spacing.md }}><FormField label="ALBUM NAME" value={editTitle} onChangeText={setEditTitle} /><FormField label="DESCRIPTION · OPTIONAL" value={editDescription} onChangeText={setEditDescription} multiline /><AppButton compact label="Save changes" disabled={!editTitle.trim()} onPress={saveAlbumDetails} /></View> : null}
        </Card>

        {pickerOpen ? (
          <Card tone="secondary" style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
            <AppText variant="cardTitle">Add memories</AppText>
            {memories.length === 0 ? <AppText variant="bodySmall" tone="muted">No memories yet.</AppText> : memories.map((memory) => {
              const inside = albumMemories.some((item) => item.id === memory.id);
              return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: inside }} key={memory.id} onPress={() => toggleMemory(memory)} style={{ minHeight: 44, flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 6 }}><AppIcon name={inside ? 'squareCheck' : 'square'} size={18} color={inside ? theme.colors.accent : theme.colors.textMuted} /><AppText style={{ flex: 1 }}>{memory.emoji} {memory.title}</AppText><AppText variant="caption" tone="muted">{memory.memory_date}</AppText></Pressable>;
            })}
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          {albumMemories.length === 0 ? <View style={{ width: '100%' }}><EmptyState icon="photo" title="Nothing here yet" body="Add memories to this album." /></View> : null}
          {albumMemories.map((memory) => {
            const image = memory.photos?.[0]?.media_url ?? memory.photo_url;
            return (
              <Card key={memory.id} participantColor={colorForUser(memory.creator_id)} style={{ width: '47%', padding: 0, overflow: 'hidden' }}>
                {image ? <Image source={{ uri: image }} style={{ width: '100%', aspectRatio: 1, backgroundColor: theme.colors.elevatedBackground }} resizeMode="cover" /> : <View style={{ aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.elevatedBackground }}><AppText variant="hero">{memory.emoji}</AppText></View>}
                <View style={{ padding: theme.spacing.md, gap: 6 }}><AppText variant="cardTitle" numberOfLines={2}>{memory.title}</AppText><AppText variant="caption" tone="muted">{memory.memory_date}</AppText><AppButton compact variant="ghost" label="Remove" onPress={() => toggleMemory(memory)} /></View>
              </Card>
            );
          })}
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <BackHeader eyebrow="Us" title="Photos" subtitle="Your photos and albums." />
      <View style={{ marginBottom: theme.spacing.lg }}><ChoiceChips value={view} onChange={setView} options={[{ value: 'all', label: 'All photos' }, { value: 'albums', label: 'Albums' }]} /></View>

      {view === 'all' ? (
        <>
          {loading ? <AppText tone="muted">Loading photos…</AppText> : null}
          {!loading && photos.length === 0 ? <EmptyState icon="photo" title="No photos yet" body="Add a photo to a memory and it’ll show up here." actionLabel="Add a memory" onAction={() => router.push('/features/memories' as never)} /> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
            {photos.map(({ key, url, memory, index }) => (
              <Pressable key={key} accessibilityRole="button" onPress={() => router.push(`/features/memories?focus=${encodeURIComponent(memory.id)}` as never)} style={{ width: '47%' }}>
                {({ pressed }) => (
                  <Card participantColor={colorForUser(memory.creator_id)} style={{ padding: 0, overflow: 'hidden', opacity: pressed ? 0.76 : 1 }}>
                    <Image source={{ uri: url }} resizeMode="cover" style={{ width: '100%', aspectRatio: 1, backgroundColor: theme.colors.elevatedBackground }} />
                    <View style={{ padding: theme.spacing.md, gap: 4 }}><AppText variant="cardTitle" numberOfLines={2}>{memory.title}</AppText><AppText variant="caption" tone="muted">{memory.memory_date}{(memory.photos?.length ?? 0) > 1 ? ` · ${index + 1}/${memory.photos?.length}` : ''}</AppText></View>
                  </Card>
                )}
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <>
          <CollapsibleComposer title="Albums" subtitle={`${albums.length} ${albums.length === 1 ? 'album' : 'albums'}`} open={composerOpen} actionLabel="New album" closeLabel="Close" tone="accent" style={{ marginBottom: theme.spacing.lg }} onToggle={() => setComposerOpen((value) => !value)}>
            <FormField label="ALBUM NAME" value={title} onChangeText={setTitle} placeholder="First visit" />
            <FormField label="DESCRIPTION · OPTIONAL" value={description} onChangeText={setDescription} multiline placeholder="A little note about this album" />
            <AppButton label="Create album" disabled={!title.trim()} onPress={saveAlbum} />
          </CollapsibleComposer>
          {loading ? <AppText tone="muted">Loading albums…</AppText> : null}
          {!loading && albums.length === 0 ? <EmptyState icon="photo" title="No albums yet" body="Group your favourite memories into an album." actionLabel="Create album" onAction={() => setComposerOpen(true)} /> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
            {albums.map((album) => (
              <Card key={album.id} participantColor={colorForUser(album.creator_id)} style={{ width: '47%', padding: 0, overflow: 'hidden' }}>
                <Pressable accessibilityRole="button" onPress={() => openAlbum(album)} style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}>
                  {album.cover_url ? <Image source={{ uri: album.cover_url }} style={{ width: '100%', aspectRatio: 1.15, backgroundColor: theme.colors.elevatedBackground }} resizeMode="cover" /> : <View style={{ aspectRatio: 1.15, backgroundColor: theme.colors.elevatedBackground, alignItems: 'center', justifyContent: 'center' }}><AppIcon name="photo" size={34} color={theme.colors.accent} /></View>}
                  <View style={{ padding: theme.spacing.md, gap: 5 }}><AppText variant="cardTitle" numberOfLines={2}>{album.title}</AppText>{album.description ? <AppText variant="caption" tone="secondary" numberOfLines={2}>{album.description}</AppText> : null}<AppText variant="caption" tone="muted">{album.memory_count ?? 0} memories</AppText></View>
                </Pressable>
                <View style={{ position: 'absolute', top: 8, right: 8 }}><IconButton icon="overflow" label={`More actions for ${album.title}`} onPress={() => Alert.alert(album.title, 'Manage this album', [{ text: 'Delete album', style: 'destructive', onPress: () => setDeleteTarget(album) }, { text: 'Cancel', style: 'cancel' }])} /></View>
              </Card>
            ))}
          </View>
        </>
      )}
      <ConfirmDialog visible={!!deleteTarget} title="Delete album?" body={deleteTarget ? `Delete “${deleteTarget.title}”? The memories will stay saved.` : ''} onCancel={() => setDeleteTarget(null)} onConfirm={() => removeAlbum().catch(() => undefined)} />
    </AppScreen>
  );
}
