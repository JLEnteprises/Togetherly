import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Modal, Pressable, SafeAreaView, View, useWindowDimensions } from 'react-native';
import { AppIcon } from '@/components/art/AppIcon';
import { AppButton } from '@/components/common/AppButton';
import { AppText } from '@/components/common/AppText';
import { useAppTheme } from '@/theme/useAppTheme';
import type { CouplePhoto } from '@/types/database';

function displayDate(photo: CouplePhoto) {
  const raw = photo.taken_at ?? photo.created_at;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

// H2_STANDALONE_PHOTO_GALLERY: tapping a gallery photo opens the photo itself first; Memory navigation is secondary.
export function PhotoViewer({
  visible,
  photos,
  initialIndex = 0,
  onClose,
  onViewMemory,
}: {
  visible: boolean;
  photos: CouplePhoto[];
  initialIndex?: number;
  onClose: () => void;
  onViewMemory?: (photo: CouplePhoto) => void;
}) {
  const theme = useAppTheme();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<CouplePhoto>>(null);
  const safeInitialIndex = useMemo(
    () => Math.min(Math.max(initialIndex, 0), Math.max(photos.length - 1, 0)),
    [initialIndex, photos.length],
  );
  const [activeIndex, setActiveIndex] = useState(safeInitialIndex);

  useEffect(() => {
    if (!visible || !photos.length) return;
    setActiveIndex(safeInitialIndex);
    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: safeInitialIndex, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [photos.length, safeInitialIndex, visible, width]);

  const activePhoto = photos[activeIndex] ?? photos[safeInitialIndex] ?? null;
  const dateLabel = activePhoto ? displayDate(activePhoto) : null;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ flex: 1 }}>
          {photos.length ? (
            <FlatList
              ref={listRef}
              data={photos}
              horizontal
              pagingEnabled
              keyExtractor={(photo) => photo.id}
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={safeInitialIndex}
              getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
              onScrollToIndexFailed={({ index }) => {
                requestAnimationFrame(() => listRef.current?.scrollToIndex({ index, animated: false }));
              }}
              onMomentumScrollEnd={(event) => {
                const next = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));
                setActiveIndex(Math.min(Math.max(next, 0), photos.length - 1));
              }}
              renderItem={({ item }) => (
                <View style={{ width, flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 74 }}>
                  <Image
                    source={{ uri: item.media_url }}
                    resizeMode="contain"
                    style={{ width: '100%', height: '100%', backgroundColor: theme.colors.background }}
                    accessibilityLabel={item.caption ? `Photo. ${item.caption}` : 'Photo'}
                  />
                </View>
              )}
            />
          ) : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <AppText tone="muted">No photo to show.</AppText>
            </View>
          )}

          <View style={{ position: 'absolute', top: theme.spacing.sm, left: theme.spacing.md }}>
            <View style={{ minHeight: 38, minWidth: 58, paddingHorizontal: 12, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }}>
              <AppText variant="caption" tone="secondary">{photos.length ? `${activeIndex + 1} / ${photos.length}` : '0 / 0'}</AppText>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo viewer"
            onPress={onClose}
            style={({ pressed }) => ({
              position: 'absolute',
              top: theme.spacing.sm,
              right: theme.spacing.md,
              width: 42,
              height: 42,
              borderRadius: 21,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.card,
              borderWidth: 1,
              borderColor: theme.colors.border,
              opacity: pressed ? 0.72 : 1,
            })}
          >
            <AppIcon name="close" size={20} color={theme.colors.textPrimary} />
          </Pressable>

          {activePhoto ? (
            <View
              style={{
                position: 'absolute',
                left: theme.spacing.md,
                right: theme.spacing.md,
                bottom: theme.spacing.md,
                gap: theme.spacing.sm,
                padding: theme.spacing.md,
                borderRadius: theme.radii.lg,
                backgroundColor: theme.colors.card,
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <View style={{ gap: 3 }}>
                {activePhoto.caption ? <AppText variant="body">{activePhoto.caption}</AppText> : <AppText variant="bodySmall" tone="muted">No caption</AppText>}
                {dateLabel ? <AppText variant="caption" tone="secondary">{dateLabel}</AppText> : null}
                {activePhoto.linked_memory_title ? <AppText variant="caption" tone="muted">Linked to: {activePhoto.linked_memory_title}</AppText> : null}
              </View>
              {activePhoto.linked_memory_id && onViewMemory ? (
                <AppButton compact variant="secondary" label="View memory" onPress={() => onViewMemory(activePhoto)} />
              ) : null}
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}
