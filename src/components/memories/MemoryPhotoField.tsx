import { useMemo, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { AppIcon } from '@/components/art/AppIcon';
import { AppButton } from '@/components/common/AppButton';
import { AppText } from '@/components/common/AppText';
import { MultiPhotoPickerField } from '@/components/common/MultiPhotoPickerField';
import { useAppTheme } from '@/theme/useAppTheme';
import type { CouplePhoto } from '@/types/database';

// H3_MEMORY_PHOTO_INTEGRATION: a Memory can choose existing first-class Photos and/or upload new Photos in one composer.
export function MemoryPhotoField({
  photos,
  memoryId,
  selectedIds,
  onSelectedIdsChange,
  uploadUrls,
  onUploadUrlsChange,
  max = 8,
}: {
  photos: CouplePhoto[];
  memoryId?: string | null;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  uploadUrls: string[];
  onUploadUrlsChange: (urls: string[]) => void;
  max?: number;
}) {
  const theme = useAppTheme();
  const [galleryOpen, setGalleryOpen] = useState(false);

  const selectable = useMemo(
    () => photos.filter((photo) =>
      !photo.linked_memory_id
      || photo.linked_memory_id === memoryId
      || selectedIds.includes(photo.id)),
    [memoryId, photos, selectedIds],
  );

  const selectedPhotos = useMemo(
    () => selectedIds.map((id) => photos.find((photo) => photo.id === id)).filter((photo): photo is CouplePhoto => Boolean(photo)),
    [photos, selectedIds],
  );

  const total = selectedIds.length + uploadUrls.length;
  const uploadLimit = Math.max(0, max - selectedIds.length);

  function toggle(photo: CouplePhoto) {
    const selected = selectedIds.includes(photo.id);
    if (selected) {
      onSelectedIdsChange(selectedIds.filter((id) => id !== photo.id));
      return;
    }
    if (total >= max) return;
    onSelectedIdsChange([...selectedIds, photo.id]);
  }

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm }}>
        <View style={{ flex: 1 }}>
          <AppText variant="caption" tone="secondary">PHOTOS</AppText>
          <AppText variant="bodySmall" tone="muted">Choose from your gallery, upload new, or mix both.</AppText>
        </View>
        <AppText variant="caption" tone={total >= max ? 'accent' : 'muted'}>{total}/{max}</AppText>
      </View>

      {selectedPhotos.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {selectedPhotos.map((photo) => (
            <View key={photo.id} style={{ position: 'relative' }}>
              <Image source={{ uri: photo.media_url }} style={{ width: 86, height: 86, borderRadius: theme.radii.md, backgroundColor: theme.colors.elevatedBackground }} resizeMode="cover" />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove existing photo from memory"
                onPress={() => onSelectedIdsChange(selectedIds.filter((id) => id !== photo.id))}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  backgroundColor: theme.colors.card,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <AppIcon name="close" size={14} color={theme.colors.textPrimary} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <AppButton
        compact
        variant="secondary"
        label={galleryOpen ? 'Hide shared gallery' : 'Choose existing photos'}
        onPress={() => setGalleryOpen((value) => !value)}
      />

      {galleryOpen ? (
        <View style={{ gap: theme.spacing.sm }}>
          {selectable.length === 0 ? (
            <AppText variant="bodySmall" tone="muted">No available gallery photos yet.</AppText>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
              {selectable.map((photo) => {
                const selected = selectedIds.includes(photo.id);
                const blocked = !selected && total >= max;
                return (
                  <Pressable
                    key={photo.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected, disabled: blocked }}
                    accessibilityLabel={photo.caption ? `Photo: ${photo.caption}` : 'Gallery photo'}
                    disabled={blocked}
                    onPress={() => toggle(photo)}
                    style={({ pressed }) => ({
                      width: '31%',
                      position: 'relative',
                      opacity: blocked ? 0.4 : pressed ? 0.72 : 1,
                    })}
                  >
                    <Image source={{ uri: photo.media_url }} style={{ width: '100%', aspectRatio: 1, borderRadius: theme.radii.md, backgroundColor: theme.colors.elevatedBackground }} resizeMode="cover" />
                    <View style={{ position: 'absolute', top: 5, right: 5, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.card, borderWidth: 1, borderColor: selected ? theme.colors.accent : theme.colors.border }}>
                      <AppIcon name={selected ? 'squareCheck' : 'square'} size={15} color={selected ? theme.colors.accent : theme.colors.textMuted} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      ) : null}

      {uploadLimit > 0 ? (
        <MultiPhotoPickerField
          label="UPLOAD NEW PHOTOS"
          values={uploadUrls}
          onChange={onUploadUrlsChange}
          max={uploadLimit}
          contextLabel="this memory"
        />
      ) : (
        <AppText variant="bodySmall" tone="muted">Remove an existing selection to upload another photo.</AppText>
      )}
    </View>
  );
}
