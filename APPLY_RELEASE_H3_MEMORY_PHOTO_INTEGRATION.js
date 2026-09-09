const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RELEASE = 'H3 — Memory / Photo Integration + Compatibility';
const MARKER = 'H3_MEMORY_PHOTO_INTEGRATION';
const root = process.cwd();

const migrationSource = "-- H3_MEMORY_PHOTO_INTEGRATION\n-- Compatibility bridge from Memory-owned images/albums to first-class H1/H2 Photos.\n-- Legacy tables and columns are deliberately retained; this migration copies rather than destroys.\n\nALTER TABLE photos ADD COLUMN IF NOT EXISTS memory_sort_order integer;\nALTER TABLE photos DROP CONSTRAINT IF EXISTS photos_memory_sort_order_check;\nALTER TABLE photos ADD CONSTRAINT photos_memory_sort_order_check\n  CHECK (memory_sort_order IS NULL OR memory_sort_order >= 0);\n\nCREATE INDEX IF NOT EXISTS photos_memory_order_idx\n  ON photos(linked_memory_id, memory_sort_order, created_at)\n  WHERE linked_memory_id IS NOT NULL;\n\n-- Import every currently renderable memory_media image into first-class Photos.\n-- Deterministic UUIDs make the copy stable if this SQL is ever replayed outside schema_migrations.\nINSERT INTO photos(\n  id,couple_id,creator_id,media_url,caption,taken_at,linked_memory_id,memory_sort_order,created_at,updated_at\n)\nSELECT\n  md5('h3-memory-media:' || mm.id::text)::uuid,\n  m.couple_id,\n  m.creator_id,\n  mm.media_url,\n  COALESCE(mm.caption,''),\n  (m.memory_date::timestamp AT TIME ZONE 'UTC'),\n  m.id,\n  GREATEST(mm.sort_order,0),\n  mm.created_at,\n  GREATEST(mm.created_at,m.updated_at)\nFROM memory_media mm\nJOIN memories m ON m.id=mm.memory_id\nWHERE mm.media_url IS NOT NULL\n  AND NOT EXISTS (\n    SELECT 1 FROM photos p\n    WHERE p.couple_id=m.couple_id\n      AND p.linked_memory_id=m.id\n      AND p.media_url=mm.media_url\n  )\nON CONFLICT (id) DO NOTHING;\n\n-- Older installs may only have memories.photo_url. Preserve those too when no\n-- first-class copy of the same Memory/image exists yet.\nINSERT INTO photos(\n  id,couple_id,creator_id,media_url,caption,taken_at,linked_memory_id,memory_sort_order,created_at,updated_at\n)\nSELECT\n  md5('h3-memory-fallback:' || m.id::text || ':' || m.photo_url)::uuid,\n  m.couple_id,\n  m.creator_id,\n  m.photo_url,\n  '',\n  (m.memory_date::timestamp AT TIME ZONE 'UTC'),\n  m.id,\n  0,\n  m.created_at,\n  m.updated_at\nFROM memories m\nWHERE m.photo_url IS NOT NULL\n  AND NOT EXISTS (\n    SELECT 1 FROM photos p\n    WHERE p.couple_id=m.couple_id\n      AND p.linked_memory_id=m.id\n      AND p.media_url=m.photo_url\n  )\nON CONFLICT (id) DO NOTHING;\n\n-- Preserve existing Memory Album organization by creating a corresponding\n-- photo-based Album. The old memory_albums rows remain untouched.\nINSERT INTO photo_albums(id,couple_id,creator_id,title,description,created_at,updated_at)\nSELECT\n  md5('h3-memory-album:' || a.id::text)::uuid,\n  a.couple_id,\n  a.creator_id,\n  a.title,\n  a.description,\n  a.created_at,\n  a.updated_at\nFROM memory_albums a\nWHERE NOT EXISTS (\n  SELECT 1 FROM photo_albums pa\n  WHERE pa.id=md5('h3-memory-album:' || a.id::text)::uuid\n)\nON CONFLICT (id) DO NOTHING;\n\n-- A legacy Memory Album contained Memories. Expand each of those Memories into\n-- its linked first-class Photos so the visible H2 album keeps the actual images.\nWITH expanded AS (\n  SELECT\n    md5('h3-memory-album:' || mai.album_id::text)::uuid AS album_id,\n    p.id AS photo_id,\n    mai.added_by,\n    (ROW_NUMBER() OVER (\n      PARTITION BY mai.album_id\n      ORDER BY mai.created_at, COALESCE(p.memory_sort_order, 1000000), COALESCE(p.taken_at,p.created_at), p.id\n    ) - 1)::integer AS sort_order,\n    mai.created_at\n  FROM memory_album_items mai\n  JOIN memory_albums a ON a.id=mai.album_id\n  JOIN photos p ON p.linked_memory_id=mai.memory_id AND p.couple_id=a.couple_id\n)\nINSERT INTO photo_album_items(album_id,photo_id,added_by,sort_order,created_at)\nSELECT album_id,photo_id,added_by,sort_order,created_at\nFROM expanded\nON CONFLICT (album_id,photo_id) DO NOTHING;\n";
const helperSource = "import { randomUUID } from 'node:crypto';\nimport type { PoolClient } from 'pg';\nimport { ApiError } from '../utils/http.js';\nimport { imageDataOrUrl } from './helpers.js';\n\nfunction uuidValue(value: unknown, label: string) {\n  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {\n    throw new ApiError(400, `${label} is invalid.`);\n  }\n  return value;\n}\n\nexport function memoryPhotoIds(body: Record<string, unknown>, key = 'photoIds') {\n  if (body[key] === undefined) return undefined;\n  if (!Array.isArray(body[key])) throw new ApiError(400, 'Existing photos are invalid.');\n  if ((body[key] as unknown[]).length > 8) throw new ApiError(400, 'A memory can contain up to 8 photos.');\n\n  const values = (body[key] as unknown[]).map((value, index) => uuidValue(value, `Photo ${index + 1}`));\n  return [...new Set(values)];\n}\n\nexport function memoryPhotoUrls(body: Record<string, unknown>, key = 'photoUrls') {\n  if (body[key] === undefined) return undefined;\n  if (!Array.isArray(body[key])) throw new ApiError(400, 'New photos are invalid.');\n  if ((body[key] as unknown[]).length > 8) throw new ApiError(400, 'A memory can contain up to 8 photos.');\n\n  return (body[key] as unknown[])\n    .map((value, index) => imageDataOrUrl(value, `Photo ${index + 1}`))\n    .filter((value): value is string => Boolean(value));\n}\n\nexport function memoryPhotosSql(alias: string) {\n  return `CASE\n    WHEN EXISTS (SELECT 1 FROM photos px WHERE px.linked_memory_id=${alias}.id)\n      THEN COALESCE((\n        SELECT json_agg(\n          json_build_object(\n            'id', ranked.id,\n            'media_url', ranked.media_url,\n            'caption', ranked.caption,\n            'sort_order', ranked.sort_order\n          )\n          ORDER BY ranked.sort_order, ranked.created_at\n        )\n        FROM (\n          SELECT p.id,p.media_url,p.caption,p.created_at,\n            ROW_NUMBER() OVER (\n              ORDER BY COALESCE(p.memory_sort_order,1000000),COALESCE(p.taken_at,p.created_at),p.created_at,p.id\n            ) - 1 AS sort_order\n          FROM photos p\n          WHERE p.linked_memory_id=${alias}.id\n        ) ranked\n      ), '[]'::json)\n    WHEN EXISTS (SELECT 1 FROM memory_media mmx WHERE mmx.memory_id=${alias}.id)\n      THEN COALESCE((\n        SELECT json_agg(\n          json_build_object('id',mm.id,'media_url',mm.media_url,'caption',mm.caption,'sort_order',mm.sort_order)\n          ORDER BY mm.sort_order,mm.created_at\n        )\n        FROM memory_media mm\n        WHERE mm.memory_id=${alias}.id AND mm.media_url IS NOT NULL\n      ), '[]'::json)\n    WHEN ${alias}.photo_url IS NOT NULL\n      THEN json_build_array(json_build_object('id',NULL,'media_url',${alias}.photo_url,'caption','','sort_order',0))\n    ELSE '[]'::json\n  END AS photos`;\n}\n\nexport async function syncStandaloneMemoryPhotos(client: PoolClient, input: {\n  coupleId: string;\n  memoryId: string;\n  creatorId: string;\n  memoryDate: string;\n  photoIds: string[];\n  photoUrls: string[];\n}) {\n  const photoIds = [...new Set(input.photoIds)];\n  if (photoIds.length + input.photoUrls.length > 8) {\n    throw new ApiError(400, 'A memory can contain up to 8 photos.');\n  }\n\n  if (photoIds.length) {\n    const existing = await client.query(\n      `SELECT id,linked_memory_id\n       FROM photos\n       WHERE couple_id=$1 AND id=ANY($2::uuid[])\n       FOR UPDATE`,\n      [input.coupleId, photoIds],\n    );\n    if ((existing.rowCount ?? 0) !== photoIds.length) {\n      throw new ApiError(400, 'One or more selected photos do not belong to this couple.');\n    }\n    if (existing.rows.some((row) => row.linked_memory_id && String(row.linked_memory_id) !== input.memoryId)) {\n      throw new ApiError(409, 'One of those photos is already linked to another memory.');\n    }\n  }\n\n  await client.query(\n    `UPDATE photos\n     SET linked_memory_id=NULL,memory_sort_order=NULL,updated_at=now()\n     WHERE couple_id=$1 AND linked_memory_id=$2\n       AND NOT (id=ANY($3::uuid[]))`,\n    [input.coupleId, input.memoryId, photoIds],\n  );\n\n  for (let index = 0; index < photoIds.length; index += 1) {\n    await client.query(\n      `UPDATE photos\n       SET linked_memory_id=$1,memory_sort_order=$2,updated_at=now()\n       WHERE id=$3 AND couple_id=$4`,\n      [input.memoryId, index, photoIds[index], input.coupleId],\n    );\n  }\n\n  for (let index = 0; index < input.photoUrls.length; index += 1) {\n    await client.query(\n      `INSERT INTO photos(\n        id,couple_id,creator_id,media_url,caption,taken_at,linked_memory_id,memory_sort_order\n      ) VALUES($1,$2,$3,$4,'',$5::date::timestamp AT TIME ZONE 'UTC',$6,$7)`,\n      [\n        randomUUID(),\n        input.coupleId,\n        input.creatorId,\n        input.photoUrls[index],\n        input.memoryDate,\n        input.memoryId,\n        photoIds.length + index,\n      ],\n    );\n  }\n\n  const result = await client.query(\n    `SELECT p.id,p.media_url,p.caption,\n       ROW_NUMBER() OVER (\n         ORDER BY COALESCE(p.memory_sort_order,1000000),COALESCE(p.taken_at,p.created_at),p.created_at,p.id\n       ) - 1 AS sort_order\n     FROM photos p\n     WHERE p.couple_id=$1 AND p.linked_memory_id=$2\n     ORDER BY COALESCE(p.memory_sort_order,1000000),COALESCE(p.taken_at,p.created_at),p.created_at,p.id`,\n    [input.coupleId, input.memoryId],\n  );\n\n  await client.query(\n    'UPDATE memories SET photo_url=$1 WHERE id=$2 AND couple_id=$3',\n    [result.rows[0]?.media_url ?? null, input.memoryId, input.coupleId],\n  );\n\n  return result.rows.map((row) => ({\n    id: String(row.id),\n    media_url: String(row.media_url),\n    caption: String(row.caption ?? ''),\n    sort_order: Number(row.sort_order ?? 0),\n  }));\n}\n\n// H3_MEMORY_PHOTO_INTEGRATION: Memory photo association is now a link to first-class Photos; un-linking never deletes the Photo.\n";
const fieldSource = "import { useMemo, useState } from 'react';\nimport { Image, Pressable, View } from 'react-native';\nimport { AppIcon } from '@/components/art/AppIcon';\nimport { AppButton } from '@/components/common/AppButton';\nimport { AppText } from '@/components/common/AppText';\nimport { MultiPhotoPickerField } from '@/components/common/MultiPhotoPickerField';\nimport { useAppTheme } from '@/theme/useAppTheme';\nimport type { CouplePhoto } from '@/types/database';\n\n// H3_MEMORY_PHOTO_INTEGRATION: a Memory can choose existing first-class Photos and/or upload new Photos in one composer.\nexport function MemoryPhotoField({\n  photos,\n  memoryId,\n  selectedIds,\n  onSelectedIdsChange,\n  uploadUrls,\n  onUploadUrlsChange,\n  max = 8,\n}: {\n  photos: CouplePhoto[];\n  memoryId?: string | null;\n  selectedIds: string[];\n  onSelectedIdsChange: (ids: string[]) => void;\n  uploadUrls: string[];\n  onUploadUrlsChange: (urls: string[]) => void;\n  max?: number;\n}) {\n  const theme = useAppTheme();\n  const [galleryOpen, setGalleryOpen] = useState(false);\n\n  const selectable = useMemo(\n    () => photos.filter((photo) =>\n      !photo.linked_memory_id\n      || photo.linked_memory_id === memoryId\n      || selectedIds.includes(photo.id)),\n    [memoryId, photos, selectedIds],\n  );\n\n  const selectedPhotos = useMemo(\n    () => selectedIds.map((id) => photos.find((photo) => photo.id === id)).filter((photo): photo is CouplePhoto => Boolean(photo)),\n    [photos, selectedIds],\n  );\n\n  const total = selectedIds.length + uploadUrls.length;\n  const uploadLimit = Math.max(0, max - selectedIds.length);\n\n  function toggle(photo: CouplePhoto) {\n    const selected = selectedIds.includes(photo.id);\n    if (selected) {\n      onSelectedIdsChange(selectedIds.filter((id) => id !== photo.id));\n      return;\n    }\n    if (total >= max) return;\n    onSelectedIdsChange([...selectedIds, photo.id]);\n  }\n\n  return (\n    <View style={{ gap: theme.spacing.md }}>\n      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm }}>\n        <View style={{ flex: 1 }}>\n          <AppText variant=\"caption\" tone=\"secondary\">PHOTOS</AppText>\n          <AppText variant=\"bodySmall\" tone=\"muted\">Choose from your gallery, upload new, or mix both.</AppText>\n        </View>\n        <AppText variant=\"caption\" tone={total >= max ? 'accent' : 'muted'}>{total}/{max}</AppText>\n      </View>\n\n      {selectedPhotos.length ? (\n        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>\n          {selectedPhotos.map((photo) => (\n            <View key={photo.id} style={{ position: 'relative' }}>\n              <Image source={{ uri: photo.media_url }} style={{ width: 86, height: 86, borderRadius: theme.radii.md, backgroundColor: theme.colors.elevatedBackground }} resizeMode=\"cover\" />\n              <Pressable\n                accessibilityRole=\"button\"\n                accessibilityLabel=\"Remove existing photo from memory\"\n                onPress={() => onSelectedIdsChange(selectedIds.filter((id) => id !== photo.id))}\n                style={{\n                  position: 'absolute',\n                  top: 4,\n                  right: 4,\n                  width: 26,\n                  height: 26,\n                  borderRadius: 13,\n                  backgroundColor: theme.colors.card,\n                  alignItems: 'center',\n                  justifyContent: 'center',\n                  borderWidth: 1,\n                  borderColor: theme.colors.border,\n                }}\n              >\n                <AppIcon name=\"close\" size={14} color={theme.colors.textPrimary} />\n              </Pressable>\n            </View>\n          ))}\n        </View>\n      ) : null}\n\n      <AppButton\n        compact\n        variant=\"secondary\"\n        label={galleryOpen ? 'Hide shared gallery' : 'Choose existing photos'}\n        onPress={() => setGalleryOpen((value) => !value)}\n      />\n\n      {galleryOpen ? (\n        <View style={{ gap: theme.spacing.sm }}>\n          {selectable.length === 0 ? (\n            <AppText variant=\"bodySmall\" tone=\"muted\">No available gallery photos yet.</AppText>\n          ) : (\n            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>\n              {selectable.map((photo) => {\n                const selected = selectedIds.includes(photo.id);\n                const blocked = !selected && total >= max;\n                return (\n                  <Pressable\n                    key={photo.id}\n                    accessibilityRole=\"checkbox\"\n                    accessibilityState={{ checked: selected, disabled: blocked }}\n                    accessibilityLabel={photo.caption ? `Photo: ${photo.caption}` : 'Gallery photo'}\n                    disabled={blocked}\n                    onPress={() => toggle(photo)}\n                    style={({ pressed }) => ({\n                      width: '31%',\n                      position: 'relative',\n                      opacity: blocked ? 0.4 : pressed ? 0.72 : 1,\n                    })}\n                  >\n                    <Image source={{ uri: photo.media_url }} style={{ width: '100%', aspectRatio: 1, borderRadius: theme.radii.md, backgroundColor: theme.colors.elevatedBackground }} resizeMode=\"cover\" />\n                    <View style={{ position: 'absolute', top: 5, right: 5, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.card, borderWidth: 1, borderColor: selected ? theme.colors.accent : theme.colors.border }}>\n                      <AppIcon name={selected ? 'squareCheck' : 'square'} size={15} color={selected ? theme.colors.accent : theme.colors.textMuted} />\n                    </View>\n                  </Pressable>\n                );\n              })}\n            </View>\n          )}\n        </View>\n      ) : null}\n\n      {uploadLimit > 0 ? (\n        <MultiPhotoPickerField\n          label=\"UPLOAD NEW PHOTOS\"\n          values={uploadUrls}\n          onChange={onUploadUrlsChange}\n          max={uploadLimit}\n          contextLabel=\"this memory\"\n        />\n      ) : (\n        <AppText variant=\"bodySmall\" tone=\"muted\">Remove an existing selection to upload another photo.</AppText>\n      )}\n    </View>\n  );\n}\n";
const memoriesScreenSource = "import { useCallback, useEffect, useMemo, useState } from 'react';\nimport { Alert, Image, Pressable, View } from 'react-native';\nimport { useLocalSearchParams } from 'expo-router';\nimport { AppScreen } from '@/components/common/AppScreen';\nimport { BackHeader } from '@/components/common/BackHeader';\nimport { Card } from '@/components/common/Card';\nimport { AppText } from '@/components/common/AppText';\nimport { AppButton } from '@/components/common/AppButton';\nimport { FormField } from '@/components/common/FormField';\nimport { ChoiceChips } from '@/components/common/ChoiceChips';\nimport { TagChip } from '@/components/common/TagChip';\nimport { TagSelector } from '@/components/common/TagSelector';\nimport { ToggleRow } from '@/components/common/ToggleRow';\nimport { EmptyState } from '@/components/common/EmptyState';\nimport { ParticipantAttribution } from '@/components/common/ParticipantAttribution';\nimport { ComposerSheet } from '@/components/common/ComposerSheet';\nimport { DetailsToggle } from '@/components/common/DetailsToggle';\nimport { DatePickerField } from '@/components/common/DatePickerField';\nimport { ConfirmDialog } from '@/components/common/ConfirmDialog';\nimport { IconButton } from '@/components/common/IconButton';\nimport { MemoryDetailModal } from '@/components/memories/MemoryDetailModal';\nimport { MemoryPhotoField } from '@/components/memories/MemoryPhotoField';\nimport { PhotoViewer } from '@/components/photos/PhotoViewer';\nimport { createMemory, deleteMemory, getMemories, getTags, updateMemory } from '@/services/backend/mvpFeatures';\nimport { getPhotos } from '@/services/backend/photos';\nimport { useRealtimeRefresh } from '@/hooks/useRealtimeRefresh';\nimport { useWorkspace } from '@/providers/WorkspaceProvider';\nimport { useAppTheme } from '@/theme/useAppTheme';\nimport { formatMemoryDate, memoryPhotoCount } from '@/utils/memories';\nimport type { CoupleMemory, CouplePhoto, Tag } from '@/types/database';\n\nfunction messageFrom(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.'; }\ntype Filter = 'all' | 'milestones' | 'mine' | 'partner';\n\n// G5_US_STORY_CONSOLIDATION: Memories focuses on memory entries; Us owns Photos, Timeline and rediscovery navigation.\n// G6_COMPOSER_SHEETS: major create/edit flow uses the explicit shared ComposerSheet primitive.\n// H3_MEMORY_PHOTO_INTEGRATION: Memories link to first-class Photos, can choose existing images, and photo taps open PhotoViewer.\nexport default function MemoriesScreen() {\n  const theme = useAppTheme();\n  const params = useLocalSearchParams<{ focus?: string; edit?: string }>();\n  const { profile, partnerProfile } = useWorkspace();\n\n  const [memories, setMemories] = useState<CoupleMemory[]>([]);\n  const [photos, setPhotos] = useState<CouplePhoto[]>([]);\n  const [tags, setTags] = useState<Tag[]>([]);\n  const [title, setTitle] = useState('');\n  const [date, setDate] = useState('');\n  const [description, setDescription] = useState('');\n  const [location, setLocation] = useState('');\n  const [emoji, setEmoji] = useState('✦');\n  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);\n  const [uploadUrls, setUploadUrls] = useState<string[]>([]);\n  const [milestone, setMilestone] = useState(false);\n  const [selectedTags, setSelectedTags] = useState<string[]>([]);\n\n  const [composerOpen, setComposerOpen] = useState(false);\n  const [detailsOpen, setDetailsOpen] = useState(false);\n  const [filter, setFilter] = useState<Filter>('all');\n  const [busy, setBusy] = useState(false);\n  const [editingId, setEditingId] = useState<string | null>(null);\n  const [detailTarget, setDetailTarget] = useState<CoupleMemory | null>(null);\n  const [deleteTarget, setDeleteTarget] = useState<CoupleMemory | null>(null);\n  const [loading, setLoading] = useState(true);\n\n  const [viewerVisible, setViewerVisible] = useState(false);\n  const [viewerPhotos, setViewerPhotos] = useState<CouplePhoto[]>([]);\n  const [viewerIndex, setViewerIndex] = useState(0);\n\n  const refresh = useCallback(async () => {\n    try {\n      const [nextMemories, nextPhotos, nextTags] = await Promise.all([getMemories(), getPhotos(), getTags()]);\n      setMemories(nextMemories);\n      setPhotos(nextPhotos);\n      setTags(nextTags);\n    } catch (error) {\n      Alert.alert('Couldn’t load memories', messageFrom(error));\n    } finally {\n      setLoading(false);\n    }\n  }, []);\n\n  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);\n  useRealtimeRefresh('memories', refresh);\n  useRealtimeRefresh('photos', refresh);\n  useRealtimeRefresh('tags', refresh);\n\n  const photoById = useMemo(() => new Map(photos.map((photo) => [photo.id, photo])), [photos]);\n\n  const visible = useMemo(\n    () => memories\n      .filter((memory) => filter === 'all'\n        || (filter === 'milestones'\n          ? memory.is_milestone\n          : filter === 'mine'\n            ? memory.creator_id === profile?.id\n            : memory.creator_id === partnerProfile?.id))\n      .sort((a, b) => b.memory_date.localeCompare(a.memory_date)),\n    [filter, memories, partnerProfile?.id, profile?.id],\n  );\n\n  function resetForm(close = true) {\n    setEditingId(null);\n    setTitle('');\n    setDate('');\n    setDescription('');\n    setLocation('');\n    setEmoji('✦');\n    setSelectedPhotoIds([]);\n    setUploadUrls([]);\n    setMilestone(false);\n    setSelectedTags([]);\n    setDetailsOpen(false);\n    if (close) setComposerOpen(false);\n  }\n\n  function beginEdit(memory: CoupleMemory) {\n    setEditingId(memory.id);\n    setTitle(memory.title);\n    setDate(memory.memory_date);\n    setDescription(memory.description ?? '');\n    setLocation(memory.location ?? '');\n    setEmoji(memory.emoji || '✦');\n    setSelectedPhotoIds((memory.photos ?? []).map((photo) => photo.id).filter((id): id is string => Boolean(id)));\n    setUploadUrls([]);\n    setMilestone(Boolean(memory.is_milestone));\n    setSelectedTags((memory.tags ?? []).map((tag) => tag.id));\n    setDetailsOpen(true);\n    setComposerOpen(true);\n  }\n\n  function standalonePhotosForMemory(memory: CoupleMemory) {\n    return (memory.photos ?? [])\n      .map((photo) => photo.id ? photoById.get(photo.id) ?? null : null)\n      .filter((photo): photo is CouplePhoto => Boolean(photo));\n  }\n\n  function openMemoryPhoto(memory: CoupleMemory, requestedIndex: number) {\n    const linked = standalonePhotosForMemory(memory);\n    if (!linked.length) {\n      setDetailTarget(memory);\n      return;\n    }\n\n    const requestedId = memory.photos?.[requestedIndex]?.id ?? null;\n    const index = requestedId ? Math.max(0, linked.findIndex((photo) => photo.id === requestedId)) : 0;\n    setViewerPhotos(linked);\n    setViewerIndex(index);\n    setViewerVisible(true);\n  }\n\n  useEffect(() => {\n    if (!params.focus || !memories.length) return;\n    const focused = memories.find((memory) => memory.id === params.focus);\n    if (focused) setDetailTarget(focused);\n  }, [params.focus, memories]);\n\n  useEffect(() => {\n    if (!params.edit || editingId === params.edit || !memories.length) return;\n    const target = memories.find((memory) => memory.id === params.edit);\n    if (target) beginEdit(target);\n  }, [params.edit, memories, editingId]);\n\n  async function save() {\n    if (!title.trim() || !date) {\n      Alert.alert('Check the memory', 'Add a title and choose a date.');\n      return;\n    }\n\n    setBusy(true);\n    try {\n      const input = {\n        title: title.trim(),\n        memoryDate: date,\n        description,\n        location,\n        emoji: emoji.trim() || '✦',\n        photoIds: selectedPhotoIds,\n        photoUrls: uploadUrls,\n        isMilestone: milestone,\n        tagIds: selectedTags,\n      };\n      if (editingId) await updateMemory(editingId, input);\n      else await createMemory(input);\n      resetForm();\n      await refresh();\n    } catch (error) {\n      Alert.alert(editingId ? 'Couldn’t update memory' : 'Couldn’t save memory', messageFrom(error));\n    } finally {\n      setBusy(false);\n    }\n  }\n\n  async function toggleMilestone(memory: CoupleMemory) {\n    try {\n      await updateMemory(memory.id, { isMilestone: !memory.is_milestone });\n      await refresh();\n    } catch (error) {\n      Alert.alert('Couldn’t update memory', messageFrom(error));\n    }\n  }\n\n  async function removeConfirmed() {\n    const target = deleteTarget;\n    setDeleteTarget(null);\n    if (!target) return;\n\n    try {\n      await deleteMemory(target.id);\n      setMemories((current) => current.filter((memory) => memory.id !== target.id));\n      if (editingId === target.id) resetForm();\n      await refresh();\n    } catch (error) {\n      Alert.alert('Couldn’t delete memory', messageFrom(error));\n    }\n  }\n\n  function openMemoryMenu(memory: CoupleMemory) {\n    Alert.alert(memory.title, 'Manage this memory', [\n      { text: memory.is_milestone ? 'Remove from timeline' : 'Add to timeline', onPress: () => toggleMilestone(memory) },\n      { text: 'Edit memory', onPress: () => beginEdit(memory) },\n      { text: 'Delete', style: 'destructive', onPress: () => setDeleteTarget(memory) },\n      { text: 'Cancel', style: 'cancel' },\n    ]);\n  }\n\n  return <AppScreen>\n    <BackHeader eyebrow=\"Us\" title=\"Memories\" subtitle=\"The moments you chose to keep, all in one place.\" />\n\n    <ComposerSheet\n      title={editingId ? 'Edit memory' : 'Add a memory'}\n      subtitle={`${memories.length} memories saved`}\n      open={composerOpen}\n      actionLabel=\"New memory\"\n      closeLabel={editingId ? 'Cancel edit' : 'Close'}\n      tone=\"accent\"\n      style={{ marginBottom: theme.spacing.lg }}\n      onToggle={() => composerOpen ? resetForm() : setComposerOpen(true)}\n    >\n      <FormField label=\"What happened?\" value={title} onChangeText={setTitle} placeholder=\"First meeting\" />\n      <DatePickerField label=\"When was it?\" value={date} onChange={setDate} />\n      <MemoryPhotoField\n        photos={photos}\n        memoryId={editingId}\n        selectedIds={selectedPhotoIds}\n        onSelectedIdsChange={setSelectedPhotoIds}\n        uploadUrls={uploadUrls}\n        onUploadUrlsChange={setUploadUrls}\n      />\n      <DetailsToggle\n        open={detailsOpen}\n        onToggle={() => setDetailsOpen((value) => !value)}\n        closedLabel=\"Add the story & details\"\n        openLabel=\"Hide story & details\"\n        hint=\"Description, place, icon, milestone and tags.\"\n      />\n      {detailsOpen ? <View style={{ gap: theme.spacing.lg }}>\n        <FormField label=\"What do you want to remember?\" value={description} onChangeText={setDescription} multiline placeholder=\"What happened, what it felt like, the little details…\" />\n        <FormField label=\"Where were you?\" value={location} onChangeText={setLocation} placeholder=\"Optional\" />\n        <FormField label=\"Memory icon\" value={emoji} onChangeText={setEmoji} maxLength={8} placeholder=\"✦\" />\n        <ToggleRow label=\"Relationship milestone\" subtitle=\"Show this memory on your timeline.\" value={milestone} onChange={setMilestone} />\n        <TagSelector tags={tags} selectedIds={selectedTags} onChange={setSelectedTags} />\n      </View> : null}\n      <AppButton label={busy ? 'Saving…' : editingId ? 'Update memory' : 'Save memory'} disabled={busy || !title.trim() || !date} onPress={save} />\n    </ComposerSheet>\n\n    <View style={{ marginBottom: theme.spacing.xxl }}>\n      <ChoiceChips\n        value={filter}\n        onChange={setFilter}\n        options={[\n          { value: 'all', label: 'All' },\n          { value: 'milestones', label: 'Milestones' },\n          { value: 'mine', label: profile?.display_name ?? 'Mine' },\n          ...(partnerProfile ? [{ value: 'partner' as const, label: partnerProfile.display_name }] : []),\n        ]}\n      />\n    </View>\n\n    <View style={{ gap: theme.spacing.md }}>\n      {loading ? <AppText tone=\"muted\">Loading memories…</AppText> : null}\n      {/* F2_EMPTY_STATE_COACHING: memory empties coach the first save and make filtered views recoverable. */}\n      {!loading && visible.length === 0 ? <EmptyState\n        icon=\"memory\"\n        eyebrow={memories.length ? 'NOTHING IN THIS FILTER' : 'START WITH ONE MOMENT'}\n        title={memories.length ? 'No memories in this view' : 'Your story starts here'}\n        body={memories.length ? 'The rest of your story is still saved — this filter just has nothing to show.' : 'Save the ordinary days too. They become the good stuff later.'}\n        tip={memories.length ? 'Show all memories again, then use Milestones only for the moments that really changed your story.' : 'A photo from today, an inside joke, or the first time you did something together is enough.'}\n        actionLabel={memories.length ? 'Show all memories' : 'Add a memory'}\n        onAction={memories.length ? () => setFilter('all') : () => setComposerOpen(true)}\n      /> : null}\n\n      {visible.map((memory) => {\n        const memoryPhotos = memory.photos ?? [];\n        const firstUrl = memoryPhotos[0]?.media_url ?? memory.photo_url;\n        return <Card key={memory.id} participantColor=\"both\" style={{ gap: theme.spacing.md, overflow: 'hidden', borderColor: editingId === memory.id ? theme.colors.accent : theme.colors.border }}>\n          {firstUrl ? <View style={{ gap: theme.spacing.sm }}>\n            <Pressable\n              accessibilityRole=\"button\"\n              accessibilityLabel={`Open photo from ${memory.title}`}\n              onPress={() => openMemoryPhoto(memory, 0)}\n              style={({ pressed }) => ({ opacity: pressed ? 0.82 : 1 })}\n            >\n              <Image source={{ uri: firstUrl }} resizeMode=\"cover\" style={{ width: '100%', height: 210, borderRadius: theme.radii.md, backgroundColor: theme.colors.elevatedBackground }} />\n            </Pressable>\n\n            {memoryPhotos.length > 1 ? <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>\n              {memoryPhotos.slice(1, 5).map((photo, index) => (\n                <Pressable\n                  key={photo.id ?? `${memory.id}-${index}`}\n                  accessibilityRole=\"button\"\n                  accessibilityLabel={`Open photo ${index + 2} from ${memory.title}`}\n                  onPress={() => openMemoryPhoto(memory, index + 1)}\n                >\n                  <Image source={{ uri: photo.media_url }} resizeMode=\"cover\" style={{ width: 58, height: 58, borderRadius: theme.radii.sm, backgroundColor: theme.colors.elevatedBackground }} />\n                </Pressable>\n              ))}\n              {memoryPhotos.length > 5 ? (\n                <Pressable\n                  accessibilityRole=\"button\"\n                  accessibilityLabel={`Open remaining photos from ${memory.title}`}\n                  onPress={() => openMemoryPhoto(memory, 4)}\n                  style={{ width: 58, height: 58, borderRadius: theme.radii.sm, backgroundColor: theme.colors.elevatedBackground, alignItems: 'center', justifyContent: 'center' }}\n                >\n                  <AppText variant=\"caption\" tone=\"secondary\">+{memoryPhotos.length - 5}</AppText>\n                </Pressable>\n              ) : null}\n            </View> : null}\n          </View> : null}\n\n          <View style={{ flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-start' }}>\n            <Pressable\n              accessibilityRole=\"button\"\n              accessibilityLabel={`Open memory ${memory.title}`}\n              onPress={() => setDetailTarget(memory)}\n              style={({ pressed }) => ({ flex: 1, gap: 5, opacity: pressed ? 0.78 : 1 })}\n            >\n              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>\n                <AppText variant=\"section\">{memory.emoji}</AppText>\n                <AppText variant=\"section\" style={{ flex: 1 }}>{memory.title}</AppText>\n              </View>\n              <ParticipantAttribution userId={memory.creator_id} />\n              <AppText variant=\"caption\" tone=\"secondary\">{formatMemoryDate(memory.memory_date)}{memory.location ? ` · ${memory.location}` : ''}</AppText>\n              {memory.description ? <AppText tone=\"secondary\" numberOfLines={3}>{memory.description}</AppText> : <AppText variant=\"bodySmall\" tone=\"muted\">Tap to open this memory.</AppText>}\n            </Pressable>\n            <IconButton icon=\"overflow\" label={`More actions for ${memory.title}`} onPress={() => openMemoryMenu(memory)} />\n          </View>\n\n          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>\n            {memory.is_milestone ? <TagChip label=\"MILESTONE\" /> : null}\n            {memoryPhotoCount(memory) > 1 ? <TagChip subtle label={`${memoryPhotoCount(memory)} PHOTOS`} /> : null}\n            {(memory.tags ?? []).slice(0, 3).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}\n          </View>\n        </Card>;\n      })}\n    </View>\n\n    <MemoryDetailModal\n      memory={detailTarget}\n      visible={!!detailTarget}\n      onClose={() => setDetailTarget(null)}\n      onEdit={(memory) => { setDetailTarget(null); beginEdit(memory); }}\n      onPhotoPress={(memory, index) => {\n        setDetailTarget(null);\n        openMemoryPhoto(memory, index);\n      }}\n    />\n\n    <PhotoViewer\n      visible={viewerVisible}\n      photos={viewerPhotos}\n      initialIndex={viewerIndex}\n      onClose={() => setViewerVisible(false)}\n      onViewMemory={(photo) => {\n        if (!photo.linked_memory_id) return;\n        const memory = memories.find((item) => item.id === photo.linked_memory_id);\n        setViewerVisible(false);\n        if (memory) setDetailTarget(memory);\n      }}\n    />\n\n    <ConfirmDialog\n      visible={!!deleteTarget}\n      title=\"Delete memory?\"\n      body={deleteTarget ? `Delete “${deleteTarget.title}”? The photos will stay in your shared gallery.` : ''}\n      onCancel={() => setDeleteTarget(null)}\n      onConfirm={() => removeConfirmed().catch(() => undefined)}\n    />\n  </AppScreen>;\n}\n";

function fail(message) {
  console.error(`\n[H3] ${message}`);
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
    ['src/app/(tabs)/us.tsx', 'G5_US_STORY_CONSOLIDATION'],
    ['src/components/common/ComposerSheet.tsx', 'G6_COMPOSER_SHEETS'],
    ['server/migrations/018_standalone_photos.sql', 'H1_STANDALONE_PHOTOS_DATA_MODEL'],
    ['server/src/routes/photos.ts', 'H1_STANDALONE_PHOTOS_DATA_MODEL'],
    ['src/services/backend/photos.ts', 'H1_STANDALONE_PHOTOS_DATA_MODEL'],
    ['src/app/features/photos.tsx', 'H2_STANDALONE_PHOTO_GALLERY'],
    ['src/components/photos/PhotoViewer.tsx', 'H2_STANDALONE_PHOTO_GALLERY'],
    ['src/components/common/MultiPhotoPickerField.tsx', 'H2_STANDALONE_PHOTO_GALLERY'],
    ['src/services/backend/realtime.ts', 'H2_STANDALONE_PHOTO_GALLERY'],
    ['src/components/us/UsStoryDashboard.tsx', 'H2_STANDALONE_PHOTO_GALLERY'],
  ];

  const failures = [];
  for (const [relativePath, expectedMarker] of guards) {
    const source = read(relativePath).replace(/\r\n/g, '\n');
    if (!source.includes(expectedMarker)) failures.push(`${relativePath} missing ${expectedMarker}`);
  }

  if (failures.length) fail(`Completed-phase guard failed before any H3 write:\n- ${failures.join('\n- ')}`);
}

function prepareNewFile(relativePath, output, preferredEol) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) return { relativePath, output, eol: preferredEol, write: true };

  const raw = fs.readFileSync(fullPath, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const source = raw.replace(/\r\n/g, '\n');

  if (!source.includes(MARKER)) {
    throw new Error(`${relativePath} already exists without the H3 marker; refusing to overwrite unrelated work.`);
  }

  return { relativePath, output: source, eol, write: false };
}

function prepareMemoryRoutes() {
  const { source, eol } = sourceWithEol('server/src/routes/memories.ts');
  if (source.includes(MARKER)) return { relativePath: 'server/src/routes/memories.ts', output: source, eol, write: false };

  let next = source;

  next = replaceOnce(
    next,
    "import type { PoolClient } from 'pg';\n",
    '',
    'remove old PoolClient import',
  );

  next = replaceOnce(
    next,
    "import { ApiError, sendError } from '../utils/http.js';\nimport { broadcast, dateOnlyOrNull, imageDataOrUrl, notifyPartner, optionalText, requiredText, requireCoupleId, setTags, tagsSql, validateTagIds } from './helpers.js';\n",
    "import { ApiError, sendError } from '../utils/http.js';\nimport { broadcast, dateOnlyOrNull, imageDataOrUrl, notifyPartner, optionalText, requiredText, requireCoupleId, setTags, tagsSql, validateTagIds } from './helpers.js';\nimport { memoryPhotoIds, memoryPhotoUrls, memoryPhotosSql, syncStandaloneMemoryPhotos } from './memoryPhotos.js';\n",
    'memory photo helper import',
  );

  const oldHelpers = `function photoValues(body: Record<string, unknown>, key = 'photoUrls') {
  if (body[key] === undefined) return undefined;
  if (!Array.isArray(body[key])) throw new ApiError(400, 'Photos are invalid.');
  const values = (body[key] as unknown[]).slice(0, 8).map((value, index) => imageDataOrUrl(value, \`Photo \${index + 1}\`)).filter((value): value is string => Boolean(value));
  if ((body[key] as unknown[]).length > 8) throw new ApiError(400, 'A memory can contain up to 8 photos.');
  return values;
}

async function replaceMemoryPhotos(client: PoolClient, memoryId: string, photos: string[]) {
  await client.query('DELETE FROM memory_media WHERE memory_id=$1', [memoryId]);
  for (let index = 0; index < photos.length; index += 1) {
    await client.query(
      \`INSERT INTO memory_media(id,memory_id,media_id,media_url,caption,sort_order) VALUES($1,$2,NULL,$3,'',$4)\`,
      [randomUUID(), memoryId, photos[index], index],
    );
  }
}

const photosSql = (alias: string) => \`CASE WHEN EXISTS (SELECT 1 FROM memory_media mmx WHERE mmx.memory_id=\${alias}.id)
  THEN COALESCE((SELECT json_agg(json_build_object('id',mm.id,'media_url',mm.media_url,'caption',mm.caption,'sort_order',mm.sort_order) ORDER BY mm.sort_order,mm.created_at)
    FROM memory_media mm WHERE mm.memory_id=\${alias}.id AND mm.media_url IS NOT NULL), '[]'::json)
  WHEN \${alias}.photo_url IS NOT NULL THEN json_build_array(json_build_object('id',NULL,'media_url',\${alias}.photo_url,'caption','','sort_order',0))
  ELSE '[]'::json END AS photos\`;
`;

  next = replaceOnce(
    next,
    oldHelpers,
    `// ${MARKER}: standalone Photos are canonical, with legacy memory_media/photo_url as a read-only fallback.\nconst photosSql = memoryPhotosSql;\n`,
    'legacy memory photo helper block',
  );

  const oldCreate = `      const photos = photoValues(body) ?? (body.photoUrl ? [imageDataOrUrl(body.photoUrl, 'Memory photo')].filter((value): value is string => Boolean(value)) : []);
      const id = randomUUID();
      await client.query('BEGIN');
      const result = await client.query(
        \`INSERT INTO memories(id,couple_id,creator_id,title,description,memory_date,location,is_milestone,emoji,photo_url)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *\`,
        [id, coupleId, request.userId, requiredText(body.title, 'Memory title', 200), optionalText(body.description, 10000), memoryDate,
          optionalText(body.location, 300), body.isMilestone === true, body.emoji ? requiredText(body.emoji, 'Emoji', 16) : '✦', photos[0] ?? null],
      );
      await replaceMemoryPhotos(client, id, photos);
      await client.query('COMMIT');
      await setTags(coupleId, 'memory', id, body.tagIds);
      await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'memory', preference: 'notification_memories', entityType: 'memory', entityId: id, title: 'New memory added', body: String(result.rows[0].title) });
      broadcast(realtime, coupleId, 'memories', 'created', id);
      return reply.code(201).send({ memory: { ...result.rows[0], photos: photos.map((media_url, index) => ({ id: null, media_url, caption: '', sort_order: index })) } });`;

  const newCreate = `      const selectedPhotoIds = memoryPhotoIds(body) ?? [];
      const newPhotoUrls = memoryPhotoUrls(body) ?? (body.photoUrl ? [imageDataOrUrl(body.photoUrl, 'Memory photo')].filter((value): value is string => Boolean(value)) : []);
      if (selectedPhotoIds.length + newPhotoUrls.length > 8) throw new ApiError(400, 'A memory can contain up to 8 photos.');
      const id = randomUUID();
      await client.query('BEGIN');
      const result = await client.query(
        \`INSERT INTO memories(id,couple_id,creator_id,title,description,memory_date,location,is_milestone,emoji,photo_url)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL) RETURNING *\`,
        [id, coupleId, request.userId, requiredText(body.title, 'Memory title', 200), optionalText(body.description, 10000), memoryDate,
          optionalText(body.location, 300), body.isMilestone === true, body.emoji ? requiredText(body.emoji, 'Emoji', 16) : '✦'],
      );
      const photos = await syncStandaloneMemoryPhotos(client, {
        coupleId,
        memoryId: id,
        creatorId: request.userId,
        memoryDate,
        photoIds: selectedPhotoIds,
        photoUrls: newPhotoUrls,
      });
      await client.query('COMMIT');
      await setTags(coupleId, 'memory', id, body.tagIds);
      await notifyPartner({ coupleId, actorUserId: request.userId, kind: 'memory', preference: 'notification_memories', entityType: 'memory', entityId: id, title: 'New memory added', body: String(result.rows[0].title) });
      broadcast(realtime, coupleId, 'memories', 'created', id);
      if (photos.length) broadcast(realtime, coupleId, 'photos', 'memory-linked', id);
      return reply.code(201).send({ memory: { ...result.rows[0], photo_url: photos[0]?.media_url ?? null, photos } });`;

  next = replaceOnce(next, oldCreate, newCreate, 'memory create standalone photo sync');

  const oldUpdate = `      const photos = photoValues(body);
      const legacyPhoto = body.photoUrl === undefined ? current.photo_url : imageDataOrUrl(body.photoUrl, 'Memory photo');
      const nextPrimary = photos === undefined ? legacyPhoto : (photos[0] ?? null);
      const result = await client.query(
        \`UPDATE memories SET title=$1,description=$2,memory_date=$3,location=$4,is_milestone=$5,emoji=$6,photo_url=$7,updated_at=now()
         WHERE id=$8 AND couple_id=$9 RETURNING *\`,
        [body.title === undefined ? current.title : requiredText(body.title, 'Memory title', 200),
          body.description === undefined ? current.description : optionalText(body.description, 10000), memoryDate,
          body.location === undefined ? current.location : optionalText(body.location, 300),
          body.isMilestone === undefined ? current.is_milestone : body.isMilestone === true,
          body.emoji === undefined ? current.emoji : requiredText(body.emoji, 'Emoji', 16), nextPrimary, id, coupleId],
      );
      if (photos !== undefined) await replaceMemoryPhotos(client, id, photos);
      await client.query('COMMIT');
      await setTags(coupleId, 'memory', id, body.tagIds);
      broadcast(realtime, coupleId, 'memories', 'updated', id);
      return reply.send({ memory: result.rows[0] });`;

  const newUpdate = `      const selectedPhotoIds = memoryPhotoIds(body);
      let newPhotoUrls = memoryPhotoUrls(body);
      if (newPhotoUrls === undefined && body.photoUrl !== undefined) {
        const legacyPhoto = imageDataOrUrl(body.photoUrl, 'Memory photo');
        newPhotoUrls = legacyPhoto ? [legacyPhoto] : [];
      }
      const photoSelectionChanged = selectedPhotoIds !== undefined || newPhotoUrls !== undefined;
      const result = await client.query(
        \`UPDATE memories SET title=$1,description=$2,memory_date=$3,location=$4,is_milestone=$5,emoji=$6,updated_at=now()
         WHERE id=$7 AND couple_id=$8 RETURNING *\`,
        [body.title === undefined ? current.title : requiredText(body.title, 'Memory title', 200),
          body.description === undefined ? current.description : optionalText(body.description, 10000), memoryDate,
          body.location === undefined ? current.location : optionalText(body.location, 300),
          body.isMilestone === undefined ? current.is_milestone : body.isMilestone === true,
          body.emoji === undefined ? current.emoji : requiredText(body.emoji, 'Emoji', 16), id, coupleId],
      );
      let photos;
      if (photoSelectionChanged) {
        photos = await syncStandaloneMemoryPhotos(client, {
          coupleId,
          memoryId: id,
          creatorId: request.userId,
          memoryDate,
          photoIds: selectedPhotoIds ?? [],
          photoUrls: newPhotoUrls ?? [],
        });
      } else {
        const photoResult = await client.query(
          \`SELECT p.id,p.media_url,p.caption,
             ROW_NUMBER() OVER (ORDER BY COALESCE(p.memory_sort_order,1000000),COALESCE(p.taken_at,p.created_at),p.created_at,p.id) - 1 AS sort_order
           FROM photos p
           WHERE p.couple_id=$1 AND p.linked_memory_id=$2
           ORDER BY COALESCE(p.memory_sort_order,1000000),COALESCE(p.taken_at,p.created_at),p.created_at,p.id\`,
          [coupleId, id],
        );
        photos = photoResult.rows;
      }
      await client.query('COMMIT');
      await setTags(coupleId, 'memory', id, body.tagIds);
      broadcast(realtime, coupleId, 'memories', 'updated', id);
      if (photoSelectionChanged) broadcast(realtime, coupleId, 'photos', 'memory-links-updated', id);
      return reply.send({ memory: { ...result.rows[0], photo_url: photos[0]?.media_url ?? current.photo_url ?? null, photos } });`;

  next = replaceOnce(next, oldUpdate, newUpdate, 'memory update standalone photo sync');

  next = replaceOnce(
    next,
    `      const result = await pool.query('DELETE FROM memories WHERE id=$1 AND couple_id=$2 RETURNING id', [id, coupleId]);
      if (!result.rowCount) throw new ApiError(404, 'Memory not found.');
      await pool.query("DELETE FROM content_tags WHERE entity_type='memory' AND entity_id=$1", [id]);
      broadcast(realtime, coupleId, 'memories', 'deleted', id);`,
    `      await pool.query('UPDATE photos SET linked_memory_id=NULL,memory_sort_order=NULL,updated_at=now() WHERE couple_id=$1 AND linked_memory_id=$2', [coupleId, id]);
      const result = await pool.query('DELETE FROM memories WHERE id=$1 AND couple_id=$2 RETURNING id', [id, coupleId]);
      if (!result.rowCount) throw new ApiError(404, 'Memory not found.');
      await pool.query("DELETE FROM content_tags WHERE entity_type='memory' AND entity_id=$1", [id]);
      broadcast(realtime, coupleId, 'memories', 'deleted', id);
      broadcast(realtime, coupleId, 'photos', 'memory-unlinked', id);`,
    'memory delete preserves standalone photos',
  );

  return { relativePath: 'server/src/routes/memories.ts', output: next, eol, write: true };
}

function prepareClientApi() {
  const { source, eol } = sourceWithEol('src/services/backend/mvpFeatures.ts');
  if (source.includes(MARKER)) return { relativePath: 'src/services/backend/mvpFeatures.ts', output: source, eol, write: false };

  let next = replaceOnce(
    source,
    "export async function createMemory(input: { title: string; description?: string; memoryDate: string; location?: string; isMilestone?: boolean; emoji?: string; photoUrl?: string | null; photoUrls?: string[]; tagIds?: string[] }) {",
    `// ${MARKER}: Memories can link existing first-class Photos and create new standalone Photos in the same save.\nexport async function createMemory(input: { title: string; description?: string; memoryDate: string; location?: string; isMilestone?: boolean; emoji?: string; photoUrl?: string | null; photoIds?: string[]; photoUrls?: string[]; tagIds?: string[] }) {`,
    'createMemory photoIds type',
  );

  next = replaceOnce(
    next,
    "export async function updateMemory(id: string, input: Partial<{ title: string; description: string; memoryDate: string; location: string; isMilestone: boolean; emoji: string; photoUrl: string | null; photoUrls: string[]; tagIds: string[] }>) {",
    "export async function updateMemory(id: string, input: Partial<{ title: string; description: string; memoryDate: string; location: string; isMilestone: boolean; emoji: string; photoUrl: string | null; photoIds: string[]; photoUrls: string[]; tagIds: string[] }>) {",
    'updateMemory photoIds type',
  );

  return { relativePath: 'src/services/backend/mvpFeatures.ts', output: next, eol, write: true };
}

function prepareDetailModal() {
  const { source, eol } = sourceWithEol('src/components/memories/MemoryDetailModal.tsx');
  if (source.includes(MARKER)) return { relativePath: 'src/components/memories/MemoryDetailModal.tsx', output: source, eol, write: false };

  let next = replaceOnce(
    source,
    "  onEdit,\n}: {",
    "  onEdit,\n  onPhotoPress,\n}: {",
    'detail modal prop destructure',
  );

  next = replaceOnce(
    next,
    "  onEdit?: (memory: CoupleMemory) => void;\n}) {",
    `  onEdit?: (memory: CoupleMemory) => void;\n  onPhotoPress?: (memory: CoupleMemory, index: number) => void;\n}) {\n  // ${MARKER}: callers can hand photo taps to the shared standalone PhotoViewer.`,
    'detail modal photo callback type',
  );

  next = replaceOnce(
    next,
    '            <Pressable accessibilityRole="button" accessibilityLabel="Open photo full screen" onPress={() => setLightbox(true)} style={({ pressed }) => ({ opacity: pressed ? 0.84 : 1 })}>',
    '            <Pressable accessibilityRole="button" accessibilityLabel="Open photo full screen" onPress={() => onPhotoPress ? onPhotoPress(memory, photoIndex) : setLightbox(true)} style={({ pressed }) => ({ opacity: pressed ? 0.84 : 1 })}>',
    'detail modal main photo callback',
  );

  next = replaceOnce(
    next,
    '              {photos.map((url, index) => <Pressable key={`${url.slice(-30)}-${index}`} accessibilityRole="button" accessibilityState={{ selected: index === photoIndex }} accessibilityLabel={`Photo ${index + 1} of ${photos.length}`} onPress={() => setPhotoIndex(index)}>',
    '              {photos.map((url, index) => <Pressable key={`${url.slice(-30)}-${index}`} accessibilityRole="button" accessibilityState={{ selected: index === photoIndex }} accessibilityLabel={`Photo ${index + 1} of ${photos.length}`} onPress={() => onPhotoPress ? onPhotoPress(memory, index) : setPhotoIndex(index)}>',
    'detail modal thumbnail callback',
  );

  return { relativePath: 'src/components/memories/MemoryDetailModal.tsx', output: next, eol, write: true };
}

function prepareMemoriesScreen() {
  const { source, eol } = sourceWithEol('src/app/features/memories.tsx');
  if (source.includes(MARKER)) return { relativePath: 'src/app/features/memories.tsx', output: source, eol, write: false };

  const expected = [
    'G5_US_STORY_CONSOLIDATION',
    'G6_COMPOSER_SHEETS',
    'MultiPhotoPickerField',
    'const [photoUrls, setPhotoUrls]',
    'MemoryDetailModal',
  ];
  const missing = expected.filter((anchor) => !source.includes(anchor));
  if (missing.length) throw new Error(`Memories screen no longer matches the verified H2 baseline. Missing: ${missing.join(', ')}`);

  return { relativePath: 'src/app/features/memories.tsx', output: memoriesScreenSource, eol, write: true };
}

function audit() {
  const migration = read('server/migrations/019_memory_photo_integration.sql').replace(/\r\n/g, '\n');
  const helper = read('server/src/routes/memoryPhotos.ts').replace(/\r\n/g, '\n');
  const routes = read('server/src/routes/memories.ts').replace(/\r\n/g, '\n');
  const api = read('src/services/backend/mvpFeatures.ts').replace(/\r\n/g, '\n');
  const field = read('src/components/memories/MemoryPhotoField.tsx').replace(/\r\n/g, '\n');
  const screen = read('src/app/features/memories.tsx').replace(/\r\n/g, '\n');
  const detail = read('src/components/memories/MemoryDetailModal.tsx').replace(/\r\n/g, '\n');
  const photosScreen = read('src/app/features/photos.tsx').replace(/\r\n/g, '\n');
  const failures = [];

  if (!migration.includes(MARKER)) failures.push('Migration 019 H3 marker missing');
  for (const required of [
    'INSERT INTO photos(',
    'FROM memory_media mm',
    'FROM memories m',
    'INSERT INTO photo_albums',
    'INSERT INTO photo_album_items',
    'ALTER TABLE photos ADD COLUMN IF NOT EXISTS memory_sort_order',
  ]) {
    if (!migration.includes(required)) failures.push(`Migration 019 missing ${required}`);
  }
  if (migration.includes('DELETE FROM memory_media') || migration.includes('DROP TABLE memory_')) {
    failures.push('Migration 019 contains destructive legacy photo operations');
  }

  if (!helper.includes(MARKER) || !helper.includes('syncStandaloneMemoryPhotos') || !helper.includes('memoryPhotosSql')) {
    failures.push('Server Memory photo helper missing');
  }
  if (!helper.includes('linked_memory_id=NULL') || !helper.includes('INSERT INTO photos(')) {
    failures.push('Memory photo sync must unlink without deleting and create standalone Photos');
  }

  if (!routes.includes(MARKER) || !routes.includes('memoryPhotoIds(body)') || !routes.includes("broadcast(realtime, coupleId, 'photos'")) {
    failures.push('Memory routes are not integrated with standalone Photos');
  }
  if (routes.includes('replaceMemoryPhotos(') || routes.includes('function photoValues(')) {
    failures.push('Legacy destructive Memory photo replacement still active');
  }
  if (!routes.includes("UPDATE photos SET linked_memory_id=NULL,memory_sort_order=NULL")) {
    failures.push('Deleting a Memory does not preserve/unlink its Photos');
  }

  if (!api.includes(MARKER) || !api.includes('photoIds?: string[]') || !api.includes('photoIds: string[]')) {
    failures.push('Client Memory API photoIds support missing');
  }

  if (!field.includes(MARKER) || !field.includes('Choose existing photos') || !field.includes('MultiPhotoPickerField')) {
    failures.push('Memory choose-existing/upload UI missing');
  }

  if (!screen.includes(MARKER) || !screen.includes('getPhotos()') || !screen.includes('<MemoryPhotoField') || !screen.includes('<PhotoViewer')) {
    failures.push('Memories screen H3 integration missing');
  }
  if (screen.includes('const [photoUrls, setPhotoUrls]')) failures.push('Memories screen still uses legacy single photoUrls form state');
  if (!screen.includes("useRealtimeRefresh('photos'")) failures.push('Memories screen photo realtime refresh missing');

  if (!detail.includes(MARKER) || !detail.includes('onPhotoPress?:')) failures.push('Memory detail PhotoViewer handoff missing');

  if (!photosScreen.includes('H2_STANDALONE_PHOTO_GALLERY')) failures.push('H2 Photos screen marker missing after H3');

  if (failures.length) fail(`Source audit failed:\n- ${failures.join('\n- ')}`);
}

function runNpm(args, label) {
  console.log(`\n[H3] ${label}`);
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
console.log(`[H3] Project root: ${root}`);

if (!fs.existsSync(path.join(root, 'package.json')) || !fs.existsSync(path.join(root, 'server', 'package.json'))) {
  fail('Run this installer from the Togetherly project root.');
}

guardCompletedPhases();

let pending;
try {
  const routes = prepareMemoryRoutes();
  const api = prepareClientApi();
  const detail = prepareDetailModal();
  const screen = prepareMemoriesScreen();
  const migration18 = sourceWithEol('server/migrations/018_standalone_photos.sql');

  pending = [
    prepareNewFile('server/migrations/019_memory_photo_integration.sql', migrationSource, migration18.eol),
    prepareNewFile('server/src/routes/memoryPhotos.ts', helperSource, routes.eol),
    routes,
    api,
    prepareNewFile('src/components/memories/MemoryPhotoField.tsx', fieldSource, screen.eol),
    detail,
    screen,
  ];
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

// Every output is prepared before the first source write.
for (const item of pending) {
  if (!item.write) {
    console.log(`[H3] ${item.relativePath}: already ready`);
    continue;
  }

  const fullPath = path.join(root, item.relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, restoreEol(item.output, item.eol), 'utf8');
  console.log(`[H3] ${item.relativePath}: ready`);
}

console.log('\n[H3] Source audit');
audit();
console.log('[H3] Source audit passed.');

if (process.env.TOGETHERLY_INSTALLER_SELF_TEST !== '1') {
  runNpm(['--prefix', 'server', 'run', 'migrate'], 'Database migration 019');
  runNpm(['run', 'typecheck'], 'Client typecheck');
  runNpm(['--prefix', 'server', 'run', 'typecheck'], 'Server typecheck');
  runNpm(['--prefix', 'server', 'run', 'logic'], 'Server logic');
}

console.log('\n[H3] ALL VALIDATIONS PASSED');
console.log('[H3] Migration 019 copied legacy images/albums into first-class Photos without deleting legacy rows.');
