import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppIcon } from '@/components/art/AppIcon';
import { AppButton } from '@/components/common/AppButton';
import { AppScreen } from '@/components/common/AppScreen';
import { AppText } from '@/components/common/AppText';
import { BackHeader } from '@/components/common/BackHeader';
import { Card } from '@/components/common/Card';
import { ChoiceChips } from '@/components/common/ChoiceChips';
import { ComposerSheet } from '@/components/common/ComposerSheet';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { FormField } from '@/components/common/FormField';
import { IconButton } from '@/components/common/IconButton';
import { MultiPhotoPickerField } from '@/components/common/MultiPhotoPickerField';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { PhotoViewer } from '@/components/photos/PhotoViewer';
import { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import {
  addPhotoToAlbum,
  createPhoto,
  createPhotoAlbum,
  deletePhoto,
  deletePhotoAlbum,
  getPhotoAlbum,
  getPhotoAlbums,
  getPhotos,
  removePhotoFromAlbum,
  updatePhotoAlbum,
} from '@/services/backend/photos';
import { useAppTheme } from '@/theme/useAppTheme';
import type { CouplePhoto, PhotoAlbum } from '@/types/database';

type PhotoView = 'all' | 'albums';

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function displayPhotoDate(photo: CouplePhoto) {
  const value = photo.taken_at ?? photo.created_at;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Saved photo';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

// G5_US_STORY_CONSOLIDATION: Photos stays a canonical story destination owned by Us.
// G6_COMPOSER_SHEETS: major create/edit flows use the shared ComposerSheet primitive.
// H2_STANDALONE_PHOTO_GALLERY: this screen now reads/writes first-class Photos and photo-based Albums from H1.
export default function PhotosScreen() {
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ view?: string }>();
  const { colorForUser } = useWorkspace();

  const [view, setView] = useState<PhotoView>(params.view === 'albums' ? 'albums' : 'all');
  const [photos, setPhotos] = useState<CouplePhoto[]>([]);
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [selected, setSelected] = useState<PhotoAlbum | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<CouplePhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadUrls, setUploadUrls] = useState<string[]>([]);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploadBusy, setUploadBusy] = useState(false);

  const [albumComposerOpen, setAlbumComposerOpen] = useState(false);
  const [albumPickerOpen, setAlbumPickerOpen] = useState(false);
  const [albumEditOpen, setAlbumEditOpen] = useState(false);
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumDescription, setAlbumDescription] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerPhotos, setViewerPhotos] = useState<CouplePhoto[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  const [deletePhotoTarget, setDeletePhotoTarget] = useState<CouplePhoto | null>(null);
  const [deleteAlbumTarget, setDeleteAlbumTarget] = useState<PhotoAlbum | null>(null);

  useEffect(() => {
    if (params.view === 'albums') setView('albums');
  }, [params.view]);

  const refresh = useCallback(async () => {
    try {
      const [nextPhotos, nextAlbums] = await Promise.all([getPhotos(), getPhotoAlbums()]);
      setPhotos(nextPhotos);
      setAlbums(nextAlbums);

      if (selected?.id) {
        const detail = await getPhotoAlbum(selected.id);
        const listAlbum = nextAlbums.find((album) => album.id === selected.id);
        setSelected({
          ...detail.album,
          photo_count: detail.photos.length,
          cover_url: listAlbum?.cover_url ?? detail.album.cover_url ?? null,
        });
        setAlbumPhotos(detail.photos);
      }
    } catch (error) {
      Alert.alert('Couldn’t load photos', messageFrom(error));
    } finally {
      setLoading(false);
    }
  }, [selected?.id]);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  useRealtimeRefresh('photos', refresh);

  function openViewer(items: CouplePhoto[], index: number) {
    setViewerPhotos(items);
    setViewerIndex(index);
    setViewerVisible(true);
  }

  function viewLinkedMemory(photo: CouplePhoto) {
    if (!photo.linked_memory_id) return;
    setViewerVisible(false);
    router.push(`/features/memories?focus=${encodeURIComponent(photo.linked_memory_id)}` as never);
  }

  async function saveUploads() {
    if (!uploadUrls.length || uploadBusy) return;
    setUploadBusy(true);

    let saved = 0;
    try {
      for (const mediaUrl of uploadUrls) {
        await createPhoto({ mediaUrl, caption: uploadCaption.trim() });
        saved += 1;
      }

      setUploadUrls([]);
      setUploadCaption('');
      setUploadOpen(false);
      await refresh();
    } catch (error) {
      setUploadUrls((current) => current.slice(saved));
      await refresh().catch(() => undefined);
      Alert.alert(
        saved ? 'Some photos were added' : 'Couldn’t add photos',
        saved ? `${saved} saved before the upload stopped. ${messageFrom(error)}` : messageFrom(error),
      );
    } finally {
      setUploadBusy(false);
    }
  }

  async function openAlbum(album: PhotoAlbum) {
    try {
      const detail = await getPhotoAlbum(album.id);
      setSelected({
        ...detail.album,
        photo_count: detail.photos.length,
        cover_url: album.cover_url ?? detail.album.cover_url ?? null,
      });
      setAlbumPhotos(detail.photos);
      setEditTitle(detail.album.title);
      setEditDescription(detail.album.description ?? '');
      setAlbumPickerOpen(false);
      setAlbumEditOpen(false);
    } catch (error) {
      Alert.alert('Couldn’t open album', messageFrom(error));
    }
  }

  async function saveAlbum() {
    if (!albumTitle.trim()) return;
    try {
      const album = await createPhotoAlbum({ title: albumTitle.trim(), description: albumDescription });
      setAlbumTitle('');
      setAlbumDescription('');
      setAlbumComposerOpen(false);
      await refresh();
      await openAlbum(album);
    } catch (error) {
      Alert.alert('Couldn’t create album', messageFrom(error));
    }
  }

  async function saveAlbumDetails() {
    if (!selected || !editTitle.trim()) return;
    try {
      const updated = await updatePhotoAlbum(selected.id, {
        title: editTitle.trim(),
        description: editDescription,
      });
      setSelected((current) => current ? { ...current, ...updated } : current);
      setAlbumEditOpen(false);
      await refresh();
    } catch (error) {
      Alert.alert('Couldn’t update album', messageFrom(error));
    }
  }

  async function toggleAlbumPhoto(photo: CouplePhoto) {
    if (!selected) return;
    const inside = albumPhotos.some((item) => item.id === photo.id);
    try {
      if (inside) await removePhotoFromAlbum(selected.id, photo.id);
      else await addPhotoToAlbum(selected.id, photo.id);
      await refresh();
    } catch (error) {
      Alert.alert('Couldn’t update album', messageFrom(error));
    }
  }

  async function removePhotoConfirmed() {
    const target = deletePhotoTarget;
    setDeletePhotoTarget(null);
    if (!target) return;

    try {
      await deletePhoto(target.id);
      if (viewerPhotos.some((photo) => photo.id === target.id)) setViewerVisible(false);
      await refresh();
    } catch (error) {
      Alert.alert('Couldn’t delete photo', messageFrom(error));
    }
  }

  async function removeAlbumConfirmed() {
    const target = deleteAlbumTarget;
    setDeleteAlbumTarget(null);
    if (!target) return;

    try {
      await deletePhotoAlbum(target.id);
      if (selected?.id === target.id) {
        setSelected(null);
        setAlbumPhotos([]);
      }
      await refresh();
    } catch (error) {
      Alert.alert('Couldn’t delete album', messageFrom(error));
    }
  }

  if (selected) {
    return (
      <AppScreen>
        <BackHeader
          eyebrow="Photos · Album"
          title={selected.title}
          subtitle={selected.description || `${albumPhotos.length} ${albumPhotos.length === 1 ? 'photo' : 'photos'}`}
          onBack={() => {
            setSelected(null);
            setAlbumPhotos([]);
            setAlbumPickerOpen(false);
            setAlbumEditOpen(false);
          }}
        />

        <Card participantColor={colorForUser(selected.creator_id)} style={{ gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md, alignItems: 'center' }}>
            <View style={{ flex: 1, gap: 4 }}>
              <ParticipantAttribution userId={selected.creator_id} />
              <AppText variant="bodySmall" tone="secondary">{albumPhotos.length} {albumPhotos.length === 1 ? 'photo' : 'photos'}</AppText>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <AppButton
                compact
                variant="ghost"
                label="Edit"
                onPress={() => {
                  setEditTitle(selected.title);
                  setEditDescription(selected.description ?? '');
                  setAlbumEditOpen(true);
                }}
              />
              <AppButton
                compact
                variant="secondary"
                label={albumPickerOpen ? 'Done adding' : 'Add photos'}
                onPress={() => setAlbumPickerOpen((value) => !value)}
              />
            </View>
          </View>
        </Card>

        <ComposerSheet
          title="Edit album"
          subtitle="Change the album name or description."
          open={albumEditOpen}
          closeLabel="Cancel edit"
          showLauncher={false}
          onToggle={() => setAlbumEditOpen(false)}
        >
          <FormField label="ALBUM NAME" value={editTitle} onChangeText={setEditTitle} />
          <FormField label="DESCRIPTION · OPTIONAL" value={editDescription} onChangeText={setEditDescription} multiline />
          <AppButton label="Save changes" disabled={!editTitle.trim()} onPress={saveAlbumDetails} />
        </ComposerSheet>

        {albumPickerOpen ? (
          <Card tone="secondary" style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>
            <AppText variant="cardTitle">Add photos</AppText>
            <AppText variant="bodySmall" tone="muted">Choose any photo from your shared gallery.</AppText>
            {photos.length === 0 ? (
              <AppText variant="bodySmall" tone="muted">No standalone photos yet. Add photos from the main Photos view first.</AppText>
            ) : photos.map((photo) => {
              const inside = albumPhotos.some((item) => item.id === photo.id);
              return (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: inside }}
                  key={photo.id}
                  onPress={() => toggleAlbumPhoto(photo)}
                  style={({ pressed }) => ({
                    minHeight: 58,
                    flexDirection: 'row',
                    gap: 10,
                    alignItems: 'center',
                    paddingVertical: 6,
                    opacity: pressed ? 0.72 : 1,
                  })}
                >
                  <Image source={{ uri: photo.media_url }} style={{ width: 46, height: 46, borderRadius: theme.radii.sm, backgroundColor: theme.colors.elevatedBackground }} resizeMode="cover" />
                  <View style={{ flex: 1 }}>
                    <AppText variant="bodySmall" numberOfLines={1}>{photo.caption || 'Photo'}</AppText>
                    <AppText variant="caption" tone="muted">{displayPhotoDate(photo)}</AppText>
                  </View>
                  <AppIcon name={inside ? 'squareCheck' : 'square'} size={18} color={inside ? theme.colors.accent : theme.colors.textMuted} />
                </Pressable>
              );
            })}
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          {albumPhotos.length === 0 ? (
            <View style={{ width: '100%' }}>
              <EmptyState icon="photo" title="Nothing here yet" body="Add photos from your shared gallery to this album." actionLabel="Add photos" onAction={() => setAlbumPickerOpen(true)} />
            </View>
          ) : null}

          {albumPhotos.map((photo, index) => (
            <Card key={photo.id} participantColor={colorForUser(photo.creator_id)} style={{ width: '47%', padding: 0, overflow: 'hidden' }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={photo.caption ? `Open photo. ${photo.caption}` : 'Open photo'}
                onPress={() => openViewer(albumPhotos, index)}
                style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}
              >
                <Image source={{ uri: photo.media_url }} resizeMode="cover" style={{ width: '100%', aspectRatio: 1, backgroundColor: theme.colors.elevatedBackground }} />
                <View style={{ padding: theme.spacing.md, gap: 4 }}>
                  <AppText variant="bodySmall" numberOfLines={2}>{photo.caption || 'Photo'}</AppText>
                  <AppText variant="caption" tone="muted">{displayPhotoDate(photo)}</AppText>
                  {photo.linked_memory_title ? <AppText variant="caption" tone="secondary" numberOfLines={1}>Linked to: {photo.linked_memory_title}</AppText> : null}
                </View>
              </Pressable>
              <View style={{ paddingHorizontal: theme.spacing.sm, paddingBottom: theme.spacing.sm }}>
                <AppButton compact variant="ghost" label="Remove" onPress={() => toggleAlbumPhoto(photo)} />
              </View>
            </Card>
          ))}
        </View>

        <PhotoViewer visible={viewerVisible} photos={viewerPhotos} initialIndex={viewerIndex} onClose={() => setViewerVisible(false)} onViewMemory={viewLinkedMemory} />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <BackHeader eyebrow="Us" title="Photos" subtitle="A shared gallery that doesn’t require a Memory." />
      <View style={{ marginBottom: theme.spacing.lg }}>
        <ChoiceChips value={view} onChange={setView} options={[{ value: 'all', label: 'All photos' }, { value: 'albums', label: 'Albums' }]} />
      </View>

      {view === 'all' ? (
        <>
          <ComposerSheet
            title="Add photos"
            subtitle={`${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} in your shared gallery`}
            open={uploadOpen}
            actionLabel="Add photos"
            closeLabel="Close"
            tone="accent"
            style={{ marginBottom: theme.spacing.lg }}
            onToggle={() => {
              if (uploadOpen) {
                setUploadOpen(false);
                setUploadUrls([]);
                setUploadCaption('');
              } else {
                setUploadOpen(true);
              }
            }}
          >
            <MultiPhotoPickerField
              label="Photos"
              values={uploadUrls}
              onChange={setUploadUrls}
              max={8}
              contextLabel="this upload"
            />
            <FormField
              label="CAPTION · OPTIONAL"
              value={uploadCaption}
              onChangeText={setUploadCaption}
              multiline
              placeholder="A note for these photos"
            />
            <AppButton
              label={uploadBusy ? 'Adding…' : uploadUrls.length > 1 ? `Add ${uploadUrls.length} photos` : 'Add photo'}
              disabled={uploadBusy || !uploadUrls.length}
              onPress={saveUploads}
            />
          </ComposerSheet>

          {loading ? <AppText tone="muted">Loading photos…</AppText> : null}
          {!loading && photos.length === 0 ? (
            <EmptyState
              icon="photo"
              eyebrow="YOUR SHARED GALLERY"
              title="No standalone photos yet"
              body="Add photos directly here. You can connect them to memories later, but a Memory is no longer required."
              actionLabel="Add photos"
              onAction={() => setUploadOpen(true)}
            />
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
            {photos.map((photo, index) => (
              <Card key={photo.id} participantColor={colorForUser(photo.creator_id)} style={{ width: '47%', padding: 0, overflow: 'hidden' }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={photo.caption ? `Open photo. ${photo.caption}` : 'Open photo'}
                  onPress={() => openViewer(photos, index)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}
                >
                  <Image source={{ uri: photo.media_url }} resizeMode="cover" style={{ width: '100%', aspectRatio: 1, backgroundColor: theme.colors.elevatedBackground }} />
                  <View style={{ padding: theme.spacing.md, gap: 4 }}>
                    <AppText variant="bodySmall" numberOfLines={2}>{photo.caption || 'Photo'}</AppText>
                    <AppText variant="caption" tone="muted">{displayPhotoDate(photo)}</AppText>
                    {photo.linked_memory_title ? <AppText variant="caption" tone="secondary" numberOfLines={1}>Linked to: {photo.linked_memory_title}</AppText> : null}
                  </View>
                </Pressable>
                <View style={{ position: 'absolute', top: 8, right: 8 }}>
                  <IconButton
                    icon="overflow"
                    label={`More actions for ${photo.caption || 'photo'}`}
                    onPress={() => Alert.alert(
                      photo.caption || 'Photo',
                      'Manage this photo',
                      [
                        { text: 'Delete photo', style: 'destructive', onPress: () => setDeletePhotoTarget(photo) },
                        { text: 'Cancel', style: 'cancel' },
                      ],
                    )}
                  />
                </View>
              </Card>
            ))}
          </View>
        </>
      ) : (
        <>
          <ComposerSheet
            title="Albums"
            subtitle={`${albums.length} ${albums.length === 1 ? 'album' : 'albums'}`}
            open={albumComposerOpen}
            actionLabel="New album"
            closeLabel="Close"
            tone="accent"
            style={{ marginBottom: theme.spacing.lg }}
            onToggle={() => setAlbumComposerOpen((value) => !value)}
          >
            <FormField label="ALBUM NAME" value={albumTitle} onChangeText={setAlbumTitle} placeholder="First visit" />
            <FormField label="DESCRIPTION · OPTIONAL" value={albumDescription} onChangeText={setAlbumDescription} multiline placeholder="A little note about this album" />
            <AppButton label="Create album" disabled={!albumTitle.trim()} onPress={saveAlbum} />
          </ComposerSheet>

          {loading ? <AppText tone="muted">Loading albums…</AppText> : null}
          {!loading && albums.length === 0 ? (
            <EmptyState icon="photo" title="No albums yet" body="Albums now contain individual photos, not whole memories." actionLabel="Create album" onAction={() => setAlbumComposerOpen(true)} />
          ) : null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
            {albums.map((album) => (
              <Card key={album.id} participantColor={colorForUser(album.creator_id)} style={{ width: '47%', padding: 0, overflow: 'hidden' }}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Open album ${album.title}`} onPress={() => openAlbum(album)} style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}>
                  {album.cover_url ? (
                    <Image source={{ uri: album.cover_url }} style={{ width: '100%', aspectRatio: 1.15, backgroundColor: theme.colors.elevatedBackground }} resizeMode="cover" />
                  ) : (
                    <View style={{ aspectRatio: 1.15, backgroundColor: theme.colors.elevatedBackground, alignItems: 'center', justifyContent: 'center' }}>
                      <AppIcon name="photo" size={34} color={theme.colors.accent} />
                    </View>
                  )}
                  <View style={{ padding: theme.spacing.md, gap: 5 }}>
                    <AppText variant="cardTitle" numberOfLines={2}>{album.title}</AppText>
                    {album.description ? <AppText variant="caption" tone="secondary" numberOfLines={2}>{album.description}</AppText> : null}
                    <AppText variant="caption" tone="muted">{album.photo_count ?? 0} {(album.photo_count ?? 0) === 1 ? 'photo' : 'photos'}</AppText>
                  </View>
                </Pressable>
                <View style={{ position: 'absolute', top: 8, right: 8 }}>
                  <IconButton
                    icon="overflow"
                    label={`More actions for ${album.title}`}
                    onPress={() => Alert.alert(
                      album.title,
                      'Manage this album',
                      [
                        { text: 'Delete album', style: 'destructive', onPress: () => setDeleteAlbumTarget(album) },
                        { text: 'Cancel', style: 'cancel' },
                      ],
                    )}
                  />
                </View>
              </Card>
            ))}
          </View>
        </>
      )}

      <PhotoViewer visible={viewerVisible} photos={viewerPhotos} initialIndex={viewerIndex} onClose={() => setViewerVisible(false)} onViewMemory={viewLinkedMemory} />
      <ConfirmDialog
        visible={!!deletePhotoTarget}
        title="Delete photo?"
        body={deletePhotoTarget ? `Delete this photo${deletePhotoTarget.caption ? ` — “${deletePhotoTarget.caption}”` : ''}? It will also be removed from photo albums, but any linked Memory will stay saved.` : ''}
        onCancel={() => setDeletePhotoTarget(null)}
        onConfirm={() => removePhotoConfirmed().catch(() => undefined)}
      />
      <ConfirmDialog
        visible={!!deleteAlbumTarget}
        title="Delete album?"
        body={deleteAlbumTarget ? `Delete “${deleteAlbumTarget.title}”? The photos will stay in your shared gallery.` : ''}
        onCancel={() => setDeleteAlbumTarget(null)}
        onConfirm={() => removeAlbumConfirmed().catch(() => undefined)}
      />
    </AppScreen>
  );
}
