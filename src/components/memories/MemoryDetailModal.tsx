import { useEffect, useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/common/AppButton';
import { AppText } from '@/components/common/AppText';
import { Card } from '@/components/common/Card';
import { ParticipantAttribution } from '@/components/common/ParticipantAttribution';
import { TagChip } from '@/components/common/TagChip';
import type { CoupleMemory } from '@/types/database';
import { useAppTheme } from '@/theme/useAppTheme';
import { useWorkspace } from '@/providers/WorkspaceProvider';
import { formatMemoryDate, memoryPhotoUrls } from '@/utils/memories';

export function MemoryDetailModal({
  memory,
  visible,
  initialPhotoIndex = 0,
  openPhotoImmediately = false,
  onClose,
  onEdit,
  onPhotoPress,
}: {
  memory: CoupleMemory | null;
  visible: boolean;
  initialPhotoIndex?: number;
  openPhotoImmediately?: boolean;
  onClose: () => void;
  onEdit?: (memory: CoupleMemory) => void;
  onPhotoPress?: (memory: CoupleMemory, index: number) => void;
}) {
  // H3_MEMORY_PHOTO_INTEGRATION: callers can hand photo taps to the shared standalone PhotoViewer.
  const theme = useAppTheme();
  const { colorForUser } = useWorkspace();
  const photos = useMemo(() => memoryPhotoUrls(memory), [memory]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const safeIndex = Math.max(0, Math.min(photos.length - 1, initialPhotoIndex));
    setPhotoIndex(Number.isFinite(safeIndex) ? safeIndex : 0);
    setLightbox(openPhotoImmediately && photos.length > 0);
  }, [initialPhotoIndex, openPhotoImmediately, photos.length, visible]);

  if (!memory) return null;

  return <>
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'left', 'right', 'bottom']}>
        <View style={{ paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md }}>
          <AppText variant="caption" tone="secondary">MEMORY</AppText>
          <AppButton compact variant="ghost" label="Close" onPress={onClose} />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 50, gap: theme.spacing.xl }} showsVerticalScrollIndicator={false}>
          {photos.length ? <View style={{ gap: theme.spacing.sm }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Open photo full screen" onPress={() => onPhotoPress ? onPhotoPress(memory, photoIndex) : setLightbox(true)} style={({ pressed }) => ({ opacity: pressed ? 0.84 : 1 })}>
              <Image source={{ uri: photos[photoIndex] }} resizeMode="cover" style={{ width: '100%', aspectRatio: 1.15, backgroundColor: theme.colors.elevatedBackground }} />
            </Pressable>
            {photos.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: theme.spacing.xl }}>
              {photos.map((url, index) => <Pressable key={`${url.slice(-30)}-${index}`} accessibilityRole="button" accessibilityState={{ selected: index === photoIndex }} accessibilityLabel={`Photo ${index + 1} of ${photos.length}`} onPress={() => onPhotoPress ? onPhotoPress(memory, index) : setPhotoIndex(index)}>
                <Image source={{ uri: url }} style={{ width: 72, height: 72, borderRadius: theme.radii.sm, borderWidth: index === photoIndex ? 2 : 1, borderColor: index === photoIndex ? theme.colors.accent : theme.colors.border, backgroundColor: theme.colors.elevatedBackground }} resizeMode="cover" />
              </Pressable>)}
            </ScrollView> : null}
          </View> : null}

          <View style={{ paddingHorizontal: theme.spacing.xl, gap: theme.spacing.lg }}>
            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="caption" tone="secondary">
                {formatMemoryDate(memory.memory_date).toUpperCase()}
              </AppText>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }}>
                <AppText variant="pageTitle">{memory.emoji}</AppText>
                <AppText variant="pageTitle" style={{ flex: 1 }}>{memory.title}</AppText>
              </View>
              <ParticipantAttribution userId={memory.creator_id} />
              {memory.location ? <AppText variant="bodySmall" tone="muted">{memory.location}</AppText> : null}
            </View>

            {memory.description ? (
              <Card participantColor={colorForUser(memory.creator_id)} tone="secondary" style={{ gap: theme.spacing.sm, padding: theme.spacing.xl }}>
                <AppText variant="caption" tone="secondary">THE STORY</AppText>
                <AppText variant="section" style={{ lineHeight: 28 }}>{memory.description}</AppText>
              </Card>
            ) : (
              <Card tone="secondary">
                <AppText tone="muted">No story text yet. The date and photos still keep the moment.</AppText>
              </Card>
            )}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {memory.is_milestone ? <TagChip label="MILESTONE" /> : null}
              {photos.length > 1 ? <TagChip subtle label={`${photos.length} PHOTOS`} /> : null}
              {(memory.tags ?? []).map((tag) => <TagChip key={tag.id} subtle icon={tag.icon} iconDrawing={tag.icon_drawing} label={tag.name.toUpperCase()} />)}
            </View>

            {onEdit ? <AppButton variant="secondary" label="Edit memory" onPress={() => onEdit(memory)} /> : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>

    <Modal visible={visible && lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(false)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.96)' }} edges={['top', 'left', 'right', 'bottom']}>
        <View style={{ flex: 1, padding: theme.spacing.lg, gap: theme.spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText style={{ color: '#ffffff' }}>{photoIndex + 1} / {photos.length}</AppText>
            <AppButton compact variant="ghost" label="Close photo" onPress={() => setLightbox(false)} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close full screen photo" onPress={() => setLightbox(false)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            {photos[photoIndex] ? <Image source={{ uri: photos[photoIndex] }} resizeMode="contain" style={{ width: '100%', height: '100%' }} /> : null}
          </Pressable>
          {photos.length > 1 ? <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <View style={{ flex: 1 }}><AppButton variant="secondary" label="Previous" disabled={photoIndex === 0} onPress={() => setPhotoIndex((current) => Math.max(0, current - 1))} /></View>
            <View style={{ flex: 1 }}><AppButton variant="secondary" label="Next" disabled={photoIndex === photos.length - 1} onPress={() => setPhotoIndex((current) => Math.min(photos.length - 1, current + 1))} /></View>
          </View> : null}
        </View>
      </SafeAreaView>
    </Modal>
  </>;
}
