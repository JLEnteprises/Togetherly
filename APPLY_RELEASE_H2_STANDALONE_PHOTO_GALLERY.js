const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RELEASE = 'H2 — Standalone Photo Gallery / Fullscreen Viewer';
const MARKER = 'H2_STANDALONE_PHOTO_GALLERY';
const root = process.cwd();

const photosScreenSource = "import { useCallback, useEffect, useState } from 'react';\nimport { Alert, Image, Pressable, View } from 'react-native';\nimport { router, useLocalSearchParams } from 'expo-router';\nimport { AppIcon } from '@/components/art/AppIcon';\nimport { AppButton } from '@/components/common/AppButton';\nimport { AppScreen } from '@/components/common/AppScreen';\nimport { AppText } from '@/components/common/AppText';\nimport { BackHeader } from '@/components/common/BackHeader';\nimport { Card } from '@/components/common/Card';\nimport { ChoiceChips } from '@/components/common/ChoiceChips';\nimport { ComposerSheet } from '@/components/common/ComposerSheet';\nimport { ConfirmDialog } from '@/components/common/ConfirmDialog';\nimport { EmptyState } from '@/components/common/EmptyState';\nimport { FormField } from '@/components/common/FormField';\nimport { IconButton } from '@/components/common/IconButton';\nimport { MultiPhotoPickerField } from '@/components/common/MultiPhotoPickerField';\nimport { ParticipantAttribution } from '@/components/common/ParticipantAttribution';\nimport { PhotoViewer } from '@/components/photos/PhotoViewer';\nimport { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';\nimport { useWorkspace } from '@/providers/WorkspaceProvider';\nimport {\n  addPhotoToAlbum,\n  createPhoto,\n  createPhotoAlbum,\n  deletePhoto,\n  deletePhotoAlbum,\n  getPhotoAlbum,\n  getPhotoAlbums,\n  getPhotos,\n  removePhotoFromAlbum,\n  updatePhotoAlbum,\n} from '@/services/backend/photos';\nimport { useAppTheme } from '@/theme/useAppTheme';\nimport type { CouplePhoto, PhotoAlbum } from '@/types/database';\n\ntype PhotoView = 'all' | 'albums';\n\nfunction messageFrom(error: unknown) {\n  return error instanceof Error ? error.message : 'Something went wrong.';\n}\n\nfunction displayPhotoDate(photo: CouplePhoto) {\n  const value = photo.taken_at ?? photo.created_at;\n  const date = new Date(value);\n  if (!Number.isFinite(date.getTime())) return 'Saved photo';\n  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);\n}\n\n// G5_US_STORY_CONSOLIDATION: Photos stays a canonical story destination owned by Us.\n// G6_COMPOSER_SHEETS: major create/edit flows use the shared ComposerSheet primitive.\n// H2_STANDALONE_PHOTO_GALLERY: this screen now reads/writes first-class Photos and photo-based Albums from H1.\nexport default function PhotosScreen() {\n  const theme = useAppTheme();\n  const params = useLocalSearchParams<{ view?: string }>();\n  const { colorForUser } = useWorkspace();\n\n  const [view, setView] = useState<PhotoView>(params.view === 'albums' ? 'albums' : 'all');\n  const [photos, setPhotos] = useState<CouplePhoto[]>([]);\n  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);\n  const [selected, setSelected] = useState<PhotoAlbum | null>(null);\n  const [albumPhotos, setAlbumPhotos] = useState<CouplePhoto[]>([]);\n  const [loading, setLoading] = useState(true);\n\n  const [uploadOpen, setUploadOpen] = useState(false);\n  const [uploadUrls, setUploadUrls] = useState<string[]>([]);\n  const [uploadCaption, setUploadCaption] = useState('');\n  const [uploadBusy, setUploadBusy] = useState(false);\n\n  const [albumComposerOpen, setAlbumComposerOpen] = useState(false);\n  const [albumPickerOpen, setAlbumPickerOpen] = useState(false);\n  const [albumEditOpen, setAlbumEditOpen] = useState(false);\n  const [albumTitle, setAlbumTitle] = useState('');\n  const [albumDescription, setAlbumDescription] = useState('');\n  const [editTitle, setEditTitle] = useState('');\n  const [editDescription, setEditDescription] = useState('');\n\n  const [viewerVisible, setViewerVisible] = useState(false);\n  const [viewerPhotos, setViewerPhotos] = useState<CouplePhoto[]>([]);\n  const [viewerIndex, setViewerIndex] = useState(0);\n\n  const [deletePhotoTarget, setDeletePhotoTarget] = useState<CouplePhoto | null>(null);\n  const [deleteAlbumTarget, setDeleteAlbumTarget] = useState<PhotoAlbum | null>(null);\n\n  useEffect(() => {\n    if (params.view === 'albums') setView('albums');\n  }, [params.view]);\n\n  const refresh = useCallback(async () => {\n    try {\n      const [nextPhotos, nextAlbums] = await Promise.all([getPhotos(), getPhotoAlbums()]);\n      setPhotos(nextPhotos);\n      setAlbums(nextAlbums);\n\n      if (selected?.id) {\n        const detail = await getPhotoAlbum(selected.id);\n        const listAlbum = nextAlbums.find((album) => album.id === selected.id);\n        setSelected({\n          ...detail.album,\n          photo_count: detail.photos.length,\n          cover_url: listAlbum?.cover_url ?? detail.album.cover_url ?? null,\n        });\n        setAlbumPhotos(detail.photos);\n      }\n    } catch (error) {\n      Alert.alert('Couldn’t load photos', messageFrom(error));\n    } finally {\n      setLoading(false);\n    }\n  }, [selected?.id]);\n\n  useEffect(() => {\n    refresh().catch(() => undefined);\n  }, [refresh]);\n\n  useRealtimeRefresh('photos', refresh);\n\n  function openViewer(items: CouplePhoto[], index: number) {\n    setViewerPhotos(items);\n    setViewerIndex(index);\n    setViewerVisible(true);\n  }\n\n  function viewLinkedMemory(photo: CouplePhoto) {\n    if (!photo.linked_memory_id) return;\n    setViewerVisible(false);\n    router.push(`/features/memories?focus=${encodeURIComponent(photo.linked_memory_id)}` as never);\n  }\n\n  async function saveUploads() {\n    if (!uploadUrls.length || uploadBusy) return;\n    setUploadBusy(true);\n\n    let saved = 0;\n    try {\n      for (const mediaUrl of uploadUrls) {\n        await createPhoto({ mediaUrl, caption: uploadCaption.trim() });\n        saved += 1;\n      }\n\n      setUploadUrls([]);\n      setUploadCaption('');\n      setUploadOpen(false);\n      await refresh();\n    } catch (error) {\n      setUploadUrls((current) => current.slice(saved));\n      await refresh().catch(() => undefined);\n      Alert.alert(\n        saved ? 'Some photos were added' : 'Couldn’t add photos',\n        saved ? `${saved} saved before the upload stopped. ${messageFrom(error)}` : messageFrom(error),\n      );\n    } finally {\n      setUploadBusy(false);\n    }\n  }\n\n  async function openAlbum(album: PhotoAlbum) {\n    try {\n      const detail = await getPhotoAlbum(album.id);\n      setSelected({\n        ...detail.album,\n        photo_count: detail.photos.length,\n        cover_url: album.cover_url ?? detail.album.cover_url ?? null,\n      });\n      setAlbumPhotos(detail.photos);\n      setEditTitle(detail.album.title);\n      setEditDescription(detail.album.description ?? '');\n      setAlbumPickerOpen(false);\n      setAlbumEditOpen(false);\n    } catch (error) {\n      Alert.alert('Couldn’t open album', messageFrom(error));\n    }\n  }\n\n  async function saveAlbum() {\n    if (!albumTitle.trim()) return;\n    try {\n      const album = await createPhotoAlbum({ title: albumTitle.trim(), description: albumDescription });\n      setAlbumTitle('');\n      setAlbumDescription('');\n      setAlbumComposerOpen(false);\n      await refresh();\n      await openAlbum(album);\n    } catch (error) {\n      Alert.alert('Couldn’t create album', messageFrom(error));\n    }\n  }\n\n  async function saveAlbumDetails() {\n    if (!selected || !editTitle.trim()) return;\n    try {\n      const updated = await updatePhotoAlbum(selected.id, {\n        title: editTitle.trim(),\n        description: editDescription,\n      });\n      setSelected((current) => current ? { ...current, ...updated } : current);\n      setAlbumEditOpen(false);\n      await refresh();\n    } catch (error) {\n      Alert.alert('Couldn’t update album', messageFrom(error));\n    }\n  }\n\n  async function toggleAlbumPhoto(photo: CouplePhoto) {\n    if (!selected) return;\n    const inside = albumPhotos.some((item) => item.id === photo.id);\n    try {\n      if (inside) await removePhotoFromAlbum(selected.id, photo.id);\n      else await addPhotoToAlbum(selected.id, photo.id);\n      await refresh();\n    } catch (error) {\n      Alert.alert('Couldn’t update album', messageFrom(error));\n    }\n  }\n\n  async function removePhotoConfirmed() {\n    const target = deletePhotoTarget;\n    setDeletePhotoTarget(null);\n    if (!target) return;\n\n    try {\n      await deletePhoto(target.id);\n      if (viewerPhotos.some((photo) => photo.id === target.id)) setViewerVisible(false);\n      await refresh();\n    } catch (error) {\n      Alert.alert('Couldn’t delete photo', messageFrom(error));\n    }\n  }\n\n  async function removeAlbumConfirmed() {\n    const target = deleteAlbumTarget;\n    setDeleteAlbumTarget(null);\n    if (!target) return;\n\n    try {\n      await deletePhotoAlbum(target.id);\n      if (selected?.id === target.id) {\n        setSelected(null);\n        setAlbumPhotos([]);\n      }\n      await refresh();\n    } catch (error) {\n      Alert.alert('Couldn’t delete album', messageFrom(error));\n    }\n  }\n\n  if (selected) {\n    return (\n      <AppScreen>\n        <BackHeader\n          eyebrow=\"Photos · Album\"\n          title={selected.title}\n          subtitle={selected.description || `${albumPhotos.length} ${albumPhotos.length === 1 ? 'photo' : 'photos'}`}\n          onBack={() => {\n            setSelected(null);\n            setAlbumPhotos([]);\n            setAlbumPickerOpen(false);\n            setAlbumEditOpen(false);\n          }}\n        />\n\n        <Card participantColor={colorForUser(selected.creator_id)} style={{ gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>\n          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md, alignItems: 'center' }}>\n            <View style={{ flex: 1, gap: 4 }}>\n              <ParticipantAttribution userId={selected.creator_id} />\n              <AppText variant=\"bodySmall\" tone=\"secondary\">{albumPhotos.length} {albumPhotos.length === 1 ? 'photo' : 'photos'}</AppText>\n            </View>\n            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>\n              <AppButton\n                compact\n                variant=\"ghost\"\n                label=\"Edit\"\n                onPress={() => {\n                  setEditTitle(selected.title);\n                  setEditDescription(selected.description ?? '');\n                  setAlbumEditOpen(true);\n                }}\n              />\n              <AppButton\n                compact\n                variant=\"secondary\"\n                label={albumPickerOpen ? 'Done adding' : 'Add photos'}\n                onPress={() => setAlbumPickerOpen((value) => !value)}\n              />\n            </View>\n          </View>\n        </Card>\n\n        <ComposerSheet\n          title=\"Edit album\"\n          subtitle=\"Change the album name or description.\"\n          open={albumEditOpen}\n          closeLabel=\"Cancel edit\"\n          showLauncher={false}\n          onToggle={() => setAlbumEditOpen(false)}\n        >\n          <FormField label=\"ALBUM NAME\" value={editTitle} onChangeText={setEditTitle} />\n          <FormField label=\"DESCRIPTION · OPTIONAL\" value={editDescription} onChangeText={setEditDescription} multiline />\n          <AppButton label=\"Save changes\" disabled={!editTitle.trim()} onPress={saveAlbumDetails} />\n        </ComposerSheet>\n\n        {albumPickerOpen ? (\n          <Card tone=\"secondary\" style={{ gap: theme.spacing.sm, marginBottom: theme.spacing.lg }}>\n            <AppText variant=\"cardTitle\">Add photos</AppText>\n            <AppText variant=\"bodySmall\" tone=\"muted\">Choose any photo from your shared gallery.</AppText>\n            {photos.length === 0 ? (\n              <AppText variant=\"bodySmall\" tone=\"muted\">No standalone photos yet. Add photos from the main Photos view first.</AppText>\n            ) : photos.map((photo) => {\n              const inside = albumPhotos.some((item) => item.id === photo.id);\n              return (\n                <Pressable\n                  accessibilityRole=\"checkbox\"\n                  accessibilityState={{ checked: inside }}\n                  key={photo.id}\n                  onPress={() => toggleAlbumPhoto(photo)}\n                  style={({ pressed }) => ({\n                    minHeight: 58,\n                    flexDirection: 'row',\n                    gap: 10,\n                    alignItems: 'center',\n                    paddingVertical: 6,\n                    opacity: pressed ? 0.72 : 1,\n                  })}\n                >\n                  <Image source={{ uri: photo.media_url }} style={{ width: 46, height: 46, borderRadius: theme.radii.sm, backgroundColor: theme.colors.elevatedBackground }} resizeMode=\"cover\" />\n                  <View style={{ flex: 1 }}>\n                    <AppText variant=\"bodySmall\" numberOfLines={1}>{photo.caption || 'Photo'}</AppText>\n                    <AppText variant=\"caption\" tone=\"muted\">{displayPhotoDate(photo)}</AppText>\n                  </View>\n                  <AppIcon name={inside ? 'squareCheck' : 'square'} size={18} color={inside ? theme.colors.accent : theme.colors.textMuted} />\n                </Pressable>\n              );\n            })}\n          </Card>\n        ) : null}\n\n        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>\n          {albumPhotos.length === 0 ? (\n            <View style={{ width: '100%' }}>\n              <EmptyState icon=\"photo\" title=\"Nothing here yet\" body=\"Add photos from your shared gallery to this album.\" actionLabel=\"Add photos\" onAction={() => setAlbumPickerOpen(true)} />\n            </View>\n          ) : null}\n\n          {albumPhotos.map((photo, index) => (\n            <Card key={photo.id} participantColor={colorForUser(photo.creator_id)} style={{ width: '47%', padding: 0, overflow: 'hidden' }}>\n              <Pressable\n                accessibilityRole=\"button\"\n                accessibilityLabel={photo.caption ? `Open photo. ${photo.caption}` : 'Open photo'}\n                onPress={() => openViewer(albumPhotos, index)}\n                style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}\n              >\n                <Image source={{ uri: photo.media_url }} resizeMode=\"cover\" style={{ width: '100%', aspectRatio: 1, backgroundColor: theme.colors.elevatedBackground }} />\n                <View style={{ padding: theme.spacing.md, gap: 4 }}>\n                  <AppText variant=\"bodySmall\" numberOfLines={2}>{photo.caption || 'Photo'}</AppText>\n                  <AppText variant=\"caption\" tone=\"muted\">{displayPhotoDate(photo)}</AppText>\n                  {photo.linked_memory_title ? <AppText variant=\"caption\" tone=\"secondary\" numberOfLines={1}>Linked to: {photo.linked_memory_title}</AppText> : null}\n                </View>\n              </Pressable>\n              <View style={{ paddingHorizontal: theme.spacing.sm, paddingBottom: theme.spacing.sm }}>\n                <AppButton compact variant=\"ghost\" label=\"Remove\" onPress={() => toggleAlbumPhoto(photo)} />\n              </View>\n            </Card>\n          ))}\n        </View>\n\n        <PhotoViewer visible={viewerVisible} photos={viewerPhotos} initialIndex={viewerIndex} onClose={() => setViewerVisible(false)} onViewMemory={viewLinkedMemory} />\n      </AppScreen>\n    );\n  }\n\n  return (\n    <AppScreen>\n      <BackHeader eyebrow=\"Us\" title=\"Photos\" subtitle=\"A shared gallery that doesn’t require a Memory.\" />\n      <View style={{ marginBottom: theme.spacing.lg }}>\n        <ChoiceChips value={view} onChange={setView} options={[{ value: 'all', label: 'All photos' }, { value: 'albums', label: 'Albums' }]} />\n      </View>\n\n      {view === 'all' ? (\n        <>\n          <ComposerSheet\n            title=\"Add photos\"\n            subtitle={`${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} in your shared gallery`}\n            open={uploadOpen}\n            actionLabel=\"Add photos\"\n            closeLabel=\"Close\"\n            tone=\"accent\"\n            style={{ marginBottom: theme.spacing.lg }}\n            onToggle={() => {\n              if (uploadOpen) {\n                setUploadOpen(false);\n                setUploadUrls([]);\n                setUploadCaption('');\n              } else {\n                setUploadOpen(true);\n              }\n            }}\n          >\n            <MultiPhotoPickerField\n              label=\"Photos\"\n              values={uploadUrls}\n              onChange={setUploadUrls}\n              max={8}\n              contextLabel=\"this upload\"\n            />\n            <FormField\n              label=\"CAPTION · OPTIONAL\"\n              value={uploadCaption}\n              onChangeText={setUploadCaption}\n              multiline\n              placeholder=\"A note for these photos\"\n            />\n            <AppButton\n              label={uploadBusy ? 'Adding…' : uploadUrls.length > 1 ? `Add ${uploadUrls.length} photos` : 'Add photo'}\n              disabled={uploadBusy || !uploadUrls.length}\n              onPress={saveUploads}\n            />\n          </ComposerSheet>\n\n          {loading ? <AppText tone=\"muted\">Loading photos…</AppText> : null}\n          {!loading && photos.length === 0 ? (\n            <EmptyState\n              icon=\"photo\"\n              eyebrow=\"YOUR SHARED GALLERY\"\n              title=\"No standalone photos yet\"\n              body=\"Add photos directly here. You can connect them to memories later, but a Memory is no longer required.\"\n              actionLabel=\"Add photos\"\n              onAction={() => setUploadOpen(true)}\n            />\n          ) : null}\n\n          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>\n            {photos.map((photo, index) => (\n              <Card key={photo.id} participantColor={colorForUser(photo.creator_id)} style={{ width: '47%', padding: 0, overflow: 'hidden' }}>\n                <Pressable\n                  accessibilityRole=\"button\"\n                  accessibilityLabel={photo.caption ? `Open photo. ${photo.caption}` : 'Open photo'}\n                  onPress={() => openViewer(photos, index)}\n                  style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}\n                >\n                  <Image source={{ uri: photo.media_url }} resizeMode=\"cover\" style={{ width: '100%', aspectRatio: 1, backgroundColor: theme.colors.elevatedBackground }} />\n                  <View style={{ padding: theme.spacing.md, gap: 4 }}>\n                    <AppText variant=\"bodySmall\" numberOfLines={2}>{photo.caption || 'Photo'}</AppText>\n                    <AppText variant=\"caption\" tone=\"muted\">{displayPhotoDate(photo)}</AppText>\n                    {photo.linked_memory_title ? <AppText variant=\"caption\" tone=\"secondary\" numberOfLines={1}>Linked to: {photo.linked_memory_title}</AppText> : null}\n                  </View>\n                </Pressable>\n                <View style={{ position: 'absolute', top: 8, right: 8 }}>\n                  <IconButton\n                    icon=\"overflow\"\n                    label={`More actions for ${photo.caption || 'photo'}`}\n                    onPress={() => Alert.alert(\n                      photo.caption || 'Photo',\n                      'Manage this photo',\n                      [\n                        { text: 'Delete photo', style: 'destructive', onPress: () => setDeletePhotoTarget(photo) },\n                        { text: 'Cancel', style: 'cancel' },\n                      ],\n                    )}\n                  />\n                </View>\n              </Card>\n            ))}\n          </View>\n        </>\n      ) : (\n        <>\n          <ComposerSheet\n            title=\"Albums\"\n            subtitle={`${albums.length} ${albums.length === 1 ? 'album' : 'albums'}`}\n            open={albumComposerOpen}\n            actionLabel=\"New album\"\n            closeLabel=\"Close\"\n            tone=\"accent\"\n            style={{ marginBottom: theme.spacing.lg }}\n            onToggle={() => setAlbumComposerOpen((value) => !value)}\n          >\n            <FormField label=\"ALBUM NAME\" value={albumTitle} onChangeText={setAlbumTitle} placeholder=\"First visit\" />\n            <FormField label=\"DESCRIPTION · OPTIONAL\" value={albumDescription} onChangeText={setAlbumDescription} multiline placeholder=\"A little note about this album\" />\n            <AppButton label=\"Create album\" disabled={!albumTitle.trim()} onPress={saveAlbum} />\n          </ComposerSheet>\n\n          {loading ? <AppText tone=\"muted\">Loading albums…</AppText> : null}\n          {!loading && albums.length === 0 ? (\n            <EmptyState icon=\"photo\" title=\"No albums yet\" body=\"Albums now contain individual photos, not whole memories.\" actionLabel=\"Create album\" onAction={() => setAlbumComposerOpen(true)} />\n          ) : null}\n\n          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>\n            {albums.map((album) => (\n              <Card key={album.id} participantColor={colorForUser(album.creator_id)} style={{ width: '47%', padding: 0, overflow: 'hidden' }}>\n                <Pressable accessibilityRole=\"button\" accessibilityLabel={`Open album ${album.title}`} onPress={() => openAlbum(album)} style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}>\n                  {album.cover_url ? (\n                    <Image source={{ uri: album.cover_url }} style={{ width: '100%', aspectRatio: 1.15, backgroundColor: theme.colors.elevatedBackground }} resizeMode=\"cover\" />\n                  ) : (\n                    <View style={{ aspectRatio: 1.15, backgroundColor: theme.colors.elevatedBackground, alignItems: 'center', justifyContent: 'center' }}>\n                      <AppIcon name=\"photo\" size={34} color={theme.colors.accent} />\n                    </View>\n                  )}\n                  <View style={{ padding: theme.spacing.md, gap: 5 }}>\n                    <AppText variant=\"cardTitle\" numberOfLines={2}>{album.title}</AppText>\n                    {album.description ? <AppText variant=\"caption\" tone=\"secondary\" numberOfLines={2}>{album.description}</AppText> : null}\n                    <AppText variant=\"caption\" tone=\"muted\">{album.photo_count ?? 0} {(album.photo_count ?? 0) === 1 ? 'photo' : 'photos'}</AppText>\n                  </View>\n                </Pressable>\n                <View style={{ position: 'absolute', top: 8, right: 8 }}>\n                  <IconButton\n                    icon=\"overflow\"\n                    label={`More actions for ${album.title}`}\n                    onPress={() => Alert.alert(\n                      album.title,\n                      'Manage this album',\n                      [\n                        { text: 'Delete album', style: 'destructive', onPress: () => setDeleteAlbumTarget(album) },\n                        { text: 'Cancel', style: 'cancel' },\n                      ],\n                    )}\n                  />\n                </View>\n              </Card>\n            ))}\n          </View>\n        </>\n      )}\n\n      <PhotoViewer visible={viewerVisible} photos={viewerPhotos} initialIndex={viewerIndex} onClose={() => setViewerVisible(false)} onViewMemory={viewLinkedMemory} />\n      <ConfirmDialog\n        visible={!!deletePhotoTarget}\n        title=\"Delete photo?\"\n        body={deletePhotoTarget ? `Delete this photo${deletePhotoTarget.caption ? ` — “${deletePhotoTarget.caption}”` : ''}? It will also be removed from photo albums, but any linked Memory will stay saved.` : ''}\n        onCancel={() => setDeletePhotoTarget(null)}\n        onConfirm={() => removePhotoConfirmed().catch(() => undefined)}\n      />\n      <ConfirmDialog\n        visible={!!deleteAlbumTarget}\n        title=\"Delete album?\"\n        body={deleteAlbumTarget ? `Delete “${deleteAlbumTarget.title}”? The photos will stay in your shared gallery.` : ''}\n        onCancel={() => setDeleteAlbumTarget(null)}\n        onConfirm={() => removeAlbumConfirmed().catch(() => undefined)}\n      />\n    </AppScreen>\n  );\n}\n";
const photoViewerSource = "import { useEffect, useMemo, useRef, useState } from 'react';\nimport { FlatList, Image, Modal, Pressable, SafeAreaView, View, useWindowDimensions } from 'react-native';\nimport { AppIcon } from '@/components/art/AppIcon';\nimport { AppButton } from '@/components/common/AppButton';\nimport { AppText } from '@/components/common/AppText';\nimport { useAppTheme } from '@/theme/useAppTheme';\nimport type { CouplePhoto } from '@/types/database';\n\nfunction displayDate(photo: CouplePhoto) {\n  const raw = photo.taken_at ?? photo.created_at;\n  const date = new Date(raw);\n  if (!Number.isFinite(date.getTime())) return null;\n  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);\n}\n\n// H2_STANDALONE_PHOTO_GALLERY: tapping a gallery photo opens the photo itself first; Memory navigation is secondary.\nexport function PhotoViewer({\n  visible,\n  photos,\n  initialIndex = 0,\n  onClose,\n  onViewMemory,\n}: {\n  visible: boolean;\n  photos: CouplePhoto[];\n  initialIndex?: number;\n  onClose: () => void;\n  onViewMemory?: (photo: CouplePhoto) => void;\n}) {\n  const theme = useAppTheme();\n  const { width } = useWindowDimensions();\n  const listRef = useRef<FlatList<CouplePhoto>>(null);\n  const safeInitialIndex = useMemo(\n    () => Math.min(Math.max(initialIndex, 0), Math.max(photos.length - 1, 0)),\n    [initialIndex, photos.length],\n  );\n  const [activeIndex, setActiveIndex] = useState(safeInitialIndex);\n\n  useEffect(() => {\n    if (!visible || !photos.length) return;\n    setActiveIndex(safeInitialIndex);\n    const frame = requestAnimationFrame(() => {\n      listRef.current?.scrollToIndex({ index: safeInitialIndex, animated: false });\n    });\n    return () => cancelAnimationFrame(frame);\n  }, [photos.length, safeInitialIndex, visible, width]);\n\n  const activePhoto = photos[activeIndex] ?? photos[safeInitialIndex] ?? null;\n  const dateLabel = activePhoto ? displayDate(activePhoto) : null;\n\n  return (\n    <Modal visible={visible} animationType=\"fade\" presentationStyle=\"fullScreen\" onRequestClose={onClose}>\n      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>\n        <View style={{ flex: 1 }}>\n          {photos.length ? (\n            <FlatList\n              ref={listRef}\n              data={photos}\n              horizontal\n              pagingEnabled\n              keyExtractor={(photo) => photo.id}\n              showsHorizontalScrollIndicator={false}\n              initialScrollIndex={safeInitialIndex}\n              getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}\n              onScrollToIndexFailed={({ index }) => {\n                requestAnimationFrame(() => listRef.current?.scrollToIndex({ index, animated: false }));\n              }}\n              onMomentumScrollEnd={(event) => {\n                const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));\n                setActiveIndex(Math.min(Math.max(next, 0), photos.length - 1));\n              }}\n              renderItem={({ item }) => (\n                <View style={{ width, flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 74 }}>\n                  <Image\n                    source={{ uri: item.media_url }}\n                    resizeMode=\"contain\"\n                    style={{ width: '100%', height: '100%', backgroundColor: theme.colors.background }}\n                    accessibilityLabel={item.caption ? `Photo. ${item.caption}` : 'Photo'}\n                  />\n                </View>\n              )}\n            />\n          ) : (\n            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>\n              <AppText tone=\"muted\">No photo to show.</AppText>\n            </View>\n          )}\n\n          <View style={{ position: 'absolute', top: theme.spacing.sm, left: theme.spacing.md }}>\n            <View style={{ minHeight: 38, minWidth: 58, paddingHorizontal: 12, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }}>\n              <AppText variant=\"caption\" tone=\"secondary\">{photos.length ? `${activeIndex + 1} / ${photos.length}` : '0 / 0'}</AppText>\n            </View>\n          </View>\n\n          <Pressable\n            accessibilityRole=\"button\"\n            accessibilityLabel=\"Close photo viewer\"\n            onPress={onClose}\n            style={({ pressed }) => ({\n              position: 'absolute',\n              top: theme.spacing.sm,\n              right: theme.spacing.md,\n              width: 42,\n              height: 42,\n              borderRadius: 21,\n              alignItems: 'center',\n              justifyContent: 'center',\n              backgroundColor: theme.colors.card,\n              borderWidth: 1,\n              borderColor: theme.colors.border,\n              opacity: pressed ? 0.72 : 1,\n            })}\n          >\n            <AppIcon name=\"close\" size={20} color={theme.colors.textPrimary} />\n          </Pressable>\n\n          {activePhoto ? (\n            <View\n              style={{\n                position: 'absolute',\n                left: theme.spacing.md,\n                right: theme.spacing.md,\n                bottom: theme.spacing.md,\n                gap: theme.spacing.sm,\n                padding: theme.spacing.md,\n                borderRadius: theme.radii.lg,\n                backgroundColor: theme.colors.card,\n                borderWidth: 1,\n                borderColor: theme.colors.border,\n              }}\n            >\n              <View style={{ gap: 3 }}>\n                {activePhoto.caption ? <AppText variant=\"body\">{activePhoto.caption}</AppText> : <AppText variant=\"bodySmall\" tone=\"muted\">No caption</AppText>}\n                {dateLabel ? <AppText variant=\"caption\" tone=\"secondary\">{dateLabel}</AppText> : null}\n                {activePhoto.linked_memory_title ? <AppText variant=\"caption\" tone=\"muted\">Linked to: {activePhoto.linked_memory_title}</AppText> : null}\n              </View>\n              {activePhoto.linked_memory_id && onViewMemory ? (\n                <AppButton compact variant=\"secondary\" label=\"View memory\" onPress={() => onViewMemory(activePhoto)} />\n              ) : null}\n            </View>\n          ) : null}\n        </View>\n      </SafeAreaView>\n    </Modal>\n  );\n}\n";

function fail(message) {
  console.error(`\n[H2] ${message}`);
  process.exit(1);
}

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) fail(`Missing expected file: ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function sourceWithEol(relativePath) {
  const source = read(relativePath);
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  return { source: source.replace(/\r\n/g, '\n'), eol };
}

function restoreEol(source, eol) {
  return eol === '\r\n' ? source.replace(/\n/g, '\r\n') : source;
}

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Could not find patch anchor: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Patch anchor is ambiguous: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function guardCompletedPhases() {
  const guards = [
    ['src/components/navigation/ExpandableFeatureGroup.tsx', 'G1_UI_HIERARCHY_EXPANDABLE_HUB_FOUNDATION'],
    ['src/components/dashboard/HomeConnectionActions.tsx', 'G2_HOME_DECLUTTER'],
    ['src/app/(tabs)/together.tsx', 'G3_TOGETHER_CONSOLIDATION'],
    ['src/app/(tabs)/plan.tsx', 'G4_PLAN_EXPANDABLE_GROUPS'],
    ['src/app/(tabs)/us.tsx', 'G5_US_STORY_CONSOLIDATION'],
    ['src/components/us/UsStoryDashboard.tsx', 'G5_US_STORY_CONSOLIDATION'],
    ['src/components/common/ComposerSheet.tsx', 'G6_COMPOSER_SHEETS'],
    ['src/services/backend/photos.ts', 'H1_STANDALONE_PHOTOS_DATA_MODEL'],
    ['src/types/database.ts', 'H1_STANDALONE_PHOTOS_DATA_MODEL'],
    ['server/migrations/018_standalone_photos.sql', 'H1_STANDALONE_PHOTOS_DATA_MODEL'],
    ['server/src/routes/photos.ts', 'H1_STANDALONE_PHOTOS_DATA_MODEL'],
  ];

  const failures = [];
  for (const [relativePath, expectedMarker] of guards) {
    const source = read(relativePath).replace(/\r\n/g, '\n');
    if (!source.includes(expectedMarker)) failures.push(`${relativePath} missing ${expectedMarker}`);
  }

  if (failures.length) fail(`Completed-phase guard failed before any H2 write:\n- ${failures.join('\n- ')}`);
}

function prepareNewFile(relativePath, output, preferredEol) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return { relativePath, output, eol: preferredEol, write: true };

  const raw = fs.readFileSync(fullPath, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const source = raw.replace(/\r\n/g, '\n');

  if (!source.includes(MARKER)) {
    throw new Error(`${relativePath} already exists without the H2 marker; refusing to overwrite unrelated work.`);
  }

  return { relativePath, output: source, eol, write: false };
}

function preparePhotosScreen() {
  const { source, eol } = sourceWithEol('src/app/features/photos.tsx');
  if (source.includes(MARKER)) return { relativePath: 'src/app/features/photos.tsx', output: source, eol, write: false };

  const expected = [
    'G6_COMPOSER_SHEETS',
    'type GalleryPhoto =',
    'MemoryDetailModal',
    'getMemoryAlbums',
    "useRealtimeRefresh('memories'",
    'memory.photos',
  ];

  const missing = expected.filter((anchor) => !source.includes(anchor));
  if (missing.length) throw new Error(`Photos screen no longer matches the verified H1 baseline. Missing: ${missing.join(', ')}`);

  return { relativePath: 'src/app/features/photos.tsx', output: photosScreenSource, eol, write: true };
}

function prepareMultiPhotoPicker() {
  const { source, eol } = sourceWithEol('src/components/common/MultiPhotoPickerField.tsx');
  if (source.includes(MARKER)) return { relativePath: 'src/components/common/MultiPhotoPickerField.tsx', output: source, eol, write: false };

  let next = replaceOnce(
    source,
    "export function MultiPhotoPickerField({ label, values, onChange, max = 8 }: {\n  label: string;\n  values: string[];\n  onChange: (values: string[]) => void;\n  max?: number;\n}) {",
    `// ${MARKER}: the existing picker can describe Memory uploads or standalone gallery uploads without misleading copy.\nexport function MultiPhotoPickerField({ label, values, onChange, max = 8, contextLabel = 'this memory' }: {\n  label: string;\n  values: string[];\n  onChange: (values: string[]) => void;\n  max?: number;\n  contextLabel?: string;\n}) {`,
    'multi-photo picker props',
  );

  next = replaceOnce(
    next,
    "    if (values.length >= max) { Alert.alert('Photo limit reached', `A memory can contain up to ${max} photos.`); return; }",
    "    if (values.length >= max) { Alert.alert('Photo limit reached', `You can add up to ${max} photos to ${contextLabel}.`); return; }",
    'multi-photo picker limit copy',
  );

  next = replaceOnce(
    next,
    '    {values.length ? <View style={{ flexDirection: \'row\', flexWrap: \'wrap\', gap: theme.spacing.sm }}>{values.map((value, index) => <View key={`${value.slice(0, 30)}-${index}`} style={{ position: \'relative\' }}><Image source={{ uri: value }} style={{ width: 86, height: 86, borderRadius: theme.radii.md, backgroundColor: theme.colors.elevatedBackground }} resizeMode="cover" /><Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`} onPress={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} style={{ position: \'absolute\', top: 4, right: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: theme.colors.card, alignItems: \'center\', justifyContent: \'center\', borderWidth: 1, borderColor: theme.colors.border }}><AppIcon name="close" size={14} color={theme.colors.textPrimary} /></Pressable></View>)}</View> : <AppText variant="bodySmall" tone="muted">Add up to {max} photos to this memory.</AppText>}',
    '    {values.length ? <View style={{ flexDirection: \'row\', flexWrap: \'wrap\', gap: theme.spacing.sm }}>{values.map((value, index) => <View key={`${value.slice(0, 30)}-${index}`} style={{ position: \'relative\' }}><Image source={{ uri: value }} style={{ width: 86, height: 86, borderRadius: theme.radii.md, backgroundColor: theme.colors.elevatedBackground }} resizeMode="cover" /><Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`} onPress={() => onChange(values.filter((_, itemIndex) => itemIndex !== index))} style={{ position: \'absolute\', top: 4, right: 4, width: 26, height: 26, borderRadius: 13, backgroundColor: theme.colors.card, alignItems: \'center\', justifyContent: \'center\', borderWidth: 1, borderColor: theme.colors.border }}><AppIcon name="close" size={14} color={theme.colors.textPrimary} /></Pressable></View>)}</View> : <AppText variant="bodySmall" tone="muted">Add up to {max} photos to {contextLabel}.</AppText>}',
    'multi-photo picker empty copy',
  );

  return { relativePath: 'src/components/common/MultiPhotoPickerField.tsx', output: next, eol, write: true };
}

function prepareRealtime() {
  const { source, eol } = sourceWithEol('src/services/backend/realtime.ts');
  if (source.includes(MARKER)) return { relativePath: 'src/services/backend/realtime.ts', output: source, eol, write: false };

  const before = "export type RealtimeResource = 'tasks' | 'notes' | 'lists' | 'countdowns' | 'events' | 'goals' | 'trips' | 'memories' | 'activities' | 'questions' | 'moods' | 'tags' | 'schedules' | 'games' | 'location' | 'relationship_pings' | 'decision_wheel';";
  const after = `// ${MARKER}: H1 already broadcasts this resource; H2 teaches the client to subscribe to it.\nexport type RealtimeResource = 'tasks' | 'notes' | 'lists' | 'countdowns' | 'events' | 'goals' | 'trips' | 'memories' | 'photos' | 'activities' | 'questions' | 'moods' | 'tags' | 'schedules' | 'games' | 'location' | 'relationship_pings' | 'decision_wheel';`;

  return {
    relativePath: 'src/services/backend/realtime.ts',
    output: replaceOnce(source, before, after, 'realtime photos resource'),
    eol,
    write: true,
  };
}

function prepareUsStory() {
  const { source, eol } = sourceWithEol('src/components/us/UsStoryDashboard.tsx');
  if (source.includes(MARKER)) return { relativePath: 'src/components/us/UsStoryDashboard.tsx', output: source, eol, write: false };

  let next = replaceOnce(
    source,
    "import { getMemories, getMemoryAlbums, getTimeline } from '@/services/backend/mvpFeatures';",
    "import { getMemories, getTimeline } from '@/services/backend/mvpFeatures';\nimport { getPhotoAlbums, getPhotos } from '@/services/backend/photos';",
    'Us story photo imports',
  );

  next = replaceOnce(
    next,
    "import type { CoupleMemory, MemoryAlbum } from '@/types/database';",
    "import type { CoupleMemory, CouplePhoto, PhotoAlbum } from '@/types/database';",
    'Us story photo types',
  );

  next = replaceOnce(
    next,
    "  const [memories, setMemories] = useState<CoupleMemory[]>([]);\n  const [albums, setAlbums] = useState<MemoryAlbum[]>([]);\n  const [timeline, setTimeline] = useState<TimelineSummary | null>(null);",
    "  const [memories, setMemories] = useState<CoupleMemory[]>([]);\n  const [photos, setPhotos] = useState<CouplePhoto[]>([]);\n  const [photoAlbums, setPhotoAlbums] = useState<PhotoAlbum[]>([]);\n  const [timeline, setTimeline] = useState<TimelineSummary | null>(null);",
    'Us story photo state',
  );

  next = replaceOnce(
    next,
    "  const refresh = useCallback(async () => {\n    const [memoryResult, albumResult, timelineResult] = await Promise.allSettled([\n      getMemories(),\n      getMemoryAlbums(),\n      getTimeline(),\n    ]);\n\n    if (memoryResult.status === 'fulfilled') setMemories(memoryResult.value);\n    if (albumResult.status === 'fulfilled') setAlbums(albumResult.value);\n    if (timelineResult.status === 'fulfilled') setTimeline(timelineResult.value);\n  }, []);",
    "  const refresh = useCallback(async () => {\n    const [memoryResult, photoResult, albumResult, timelineResult] = await Promise.allSettled([\n      getMemories(),\n      getPhotos(),\n      getPhotoAlbums(),\n      getTimeline(),\n    ]);\n\n    if (memoryResult.status === 'fulfilled') setMemories(memoryResult.value);\n    if (photoResult.status === 'fulfilled') setPhotos(photoResult.value);\n    if (albumResult.status === 'fulfilled') setPhotoAlbums(albumResult.value);\n    if (timelineResult.status === 'fulfilled') setTimeline(timelineResult.value);\n  }, []);",
    'Us story refresh',
  );

  next = replaceOnce(
    next,
    "  useRealtimeRefresh('memories', refresh);",
    `  useRealtimeRefresh('memories', refresh);\n  // ${MARKER}: the Us summary now reflects the same first-class Photos data as the Photos screen.\n  useRealtimeRefresh('photos', refresh);`,
    'Us story realtime',
  );

  next = replaceOnce(
    next,
    "  const photoCount = useMemo(\n    () => memories.reduce(\n      (total, memory) => total + ((memory.photos?.length ?? 0) || (memory.photo_url ? 1 : 0)),\n      0,\n    ),\n    [memories],\n  );",
    "  const photoCount = photos.length;",
    'Us story photo count',
  );

  next = replaceOnce(
    next,
    "  const photoSummary = `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'} · ${albums.length} ${albums.length === 1 ? 'album' : 'albums'}`;",
    "  const photoSummary = `${photoCount} ${photoCount === 1 ? 'photo' : 'photos'} · ${photoAlbums.length} ${photoAlbums.length === 1 ? 'album' : 'albums'}`;",
    'Us story photo summary',
  );

  return { relativePath: 'src/components/us/UsStoryDashboard.tsx', output: next, eol, write: true };
}

function audit() {
  const photos = read('src/app/features/photos.tsx').replace(/\r\n/g, '\n');
  const viewer = read('src/components/photos/PhotoViewer.tsx').replace(/\r\n/g, '\n');
  const picker = read('src/components/common/MultiPhotoPickerField.tsx').replace(/\r\n/g, '\n');
  const realtime = read('src/services/backend/realtime.ts').replace(/\r\n/g, '\n');
  const us = read('src/components/us/UsStoryDashboard.tsx').replace(/\r\n/g, '\n');
  const photoApi = read('src/services/backend/photos.ts').replace(/\r\n/g, '\n');
  const failures = [];

  if (!photoApi.includes('H1_STANDALONE_PHOTOS_DATA_MODEL')) failures.push('H1 Photo client API marker missing');

  if (!photos.includes(MARKER)) failures.push('Photos screen H2 marker missing');
  for (const needed of [
    'getPhotos',
    'createPhoto',
    'getPhotoAlbums',
    'getPhotoAlbum',
    'addPhotoToAlbum',
    'removePhotoFromAlbum',
    '<PhotoViewer',
    "useRealtimeRefresh('photos'",
  ]) {
    if (!photos.includes(needed)) failures.push(`Photos screen missing ${needed}`);
  }
  for (const forbidden of ['MemoryDetailModal', 'getMemoryAlbums', 'type GalleryPhoto =']) {
    if (photos.includes(forbidden)) failures.push(`Photos screen still contains legacy architecture: ${forbidden}`);
  }

  if (!viewer.includes(MARKER)) failures.push('Photo viewer H2 marker missing');
  if (!viewer.includes('pagingEnabled')) failures.push('Fullscreen viewer is not swipe-paged');
  if (!viewer.includes('linked_memory_id') || !viewer.includes('View memory')) failures.push('Optional View memory action missing');
  if (!viewer.includes('presentationStyle="fullScreen"')) failures.push('Fullscreen viewer presentation missing');

  if (!picker.includes(MARKER) || !picker.includes('contextLabel')) failures.push('Standalone-aware photo picker copy missing');

  if (!realtime.includes(MARKER) || !realtime.includes("| 'photos' |")) failures.push('Realtime photos resource missing');

  if (!us.includes(MARKER) || !us.includes('getPhotos()') || !us.includes('getPhotoAlbums()') || !us.includes("useRealtimeRefresh('photos'")) {
    failures.push('Us photo summary is not connected to standalone Photos');
  }

  if (failures.length) fail(`Source audit failed:\n- ${failures.join('\n- ')}`);
}

function runNpm(args, label) {
  console.log(`\n[H2] ${label}`);
  let result;

  if (process.platform === 'win32') {
    const comspec = process.env.ComSpec || 'cmd.exe';
    const command = ['npm.cmd', ...args].join(' ');
    result = spawnSync(comspec, ['/d', '/s', '/c', command], { cwd: root, stdio: 'inherit' });
  } else {
    result = spawnSync('npm', args, { cwd: root, stdio: 'inherit' });
  }

  if (result.error) fail(`${label} could not start: ${result.error.message}`);
  if (result.status !== 0) fail(`${label} failed with exit code ${result.status}. Source changes have been left in place for a targeted repair if needed.`);
}

console.log(`\n=== Togetherly ${RELEASE} ===`);
console.log(`[H2] Project root: ${root}`);

if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'server', 'package.json'))) {
  fail('Run this installer from the Togetherly project root.');
}

guardCompletedPhases();

let pending;
try {
  const photos = preparePhotosScreen();
  const picker = prepareMultiPhotoPicker();
  const realtime = prepareRealtime();
  const us = prepareUsStory();

  pending = [
    photos,
    prepareNewFile('src/components/photos/PhotoViewer.tsx', photoViewerSource, photos.eol),
    picker,
    realtime,
    us,
  ];
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

// Every modified output is prepared before the first source write.
for (const item of pending) {
  if (!item.write) {
    console.log(`[H2] ${item.relativePath}: already ready`);
    continue;
  }

  const fullPath = path.join(root, item.relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, restoreEol(item.output, item.eol), 'utf8');
  console.log(`[H2] ${item.relativePath}: ready`);
}

console.log('\n[H2] Source audit');
audit();
console.log('[H2] Source audit passed.');

if (process.env.TOGETHERLY_INSTALLER_SELF_TEST !== '1') {
  runNpm(['run', 'typecheck'], 'Client typecheck');
  runNpm(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
  runNpm(['--prefix', 'server', 'run', 'logic'], 'Server logic');
}

console.log('\n[H2] ALL VALIDATIONS PASSED');
console.log('[H2] No migration was required. H1 migration 018 remains the standalone photo data foundation.');
