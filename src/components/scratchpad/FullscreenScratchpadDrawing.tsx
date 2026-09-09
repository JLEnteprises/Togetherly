import { Modal, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '@/components/common/AppButton';
import { AppText } from '@/components/common/AppText';
import { DrawingCanvas } from '@/components/common/DrawingCanvas';
import { useAppTheme } from '@/theme/useAppTheme';
import type { DrawingStroke } from '@/types/database';

// I1_FULLSCREEN_SCRATCHPAD_DRAWING: fullscreen is another view of the same in-memory shared scratchpad draft, not a second scratchpad.
export function FullscreenScratchpadDrawing({
  visible,
  strokes,
  currentUserId,
  partnerName,
  partnerInScratchpad,
  partnerSameMode,
  saving,
  loading,
  dirty,
  remoteUpdate,
  onClose,
  onSave,
  onReloadLatest,
  onStroke,
  onUndoMine,
  onClear,
  strokeColorForUser,
}: {
  visible: boolean;
  strokes: DrawingStroke[];
  currentUserId?: string;
  partnerName: string;
  partnerInScratchpad: boolean;
  partnerSameMode: boolean;
  saving: boolean;
  loading: boolean;
  dirty: boolean;
  remoteUpdate: boolean;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  onReloadLatest: () => void;
  onStroke: (stroke: DrawingStroke) => void;
  onUndoMine: () => void;
  onClear: () => void;
  strokeColorForUser: (userId: string | undefined) => string;
}) {
  const theme = useAppTheme();
  const { height } = useWindowDimensions();
  const canvasHeight = Math.max(300, height - (remoteUpdate ? 265 : 215));

  const presenceLabel = partnerSameMode
    ? `${partnerName} is drawing here too`
    : partnerInScratchpad
      ? `${partnerName} is in the scratchpad`
      : 'Only you are here right now';

  return (
    <Modal
      visible={visible}
      animationType={theme.reducedMotion ? 'none' : 'fade'}
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top', 'left', 'right', 'bottom']}>
        <View style={{ flex: 1, paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm, paddingBottom: theme.spacing.sm, gap: theme.spacing.sm }}>
          <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
            <AppButton compact variant="ghost" label="Close" onPress={onClose} />

            <View style={{ flex: 1, alignItems: 'center', gap: 1 }}>
              <AppText variant="caption" tone={partnerSameMode ? 'accent' : 'muted'} numberOfLines={1}>
                {partnerSameMode ? 'YOU’RE BOTH HERE' : partnerInScratchpad ? 'PARTNER IS HERE' : 'SHARED DRAWING'}
              </AppText>
              <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>{presenceLabel}</AppText>
            </View>

            <AppButton
              compact
              label={saving ? 'Saving…' : 'Save'}
              disabled={saving || loading || !dirty || remoteUpdate}
              onPress={onSave}
            />
          </View>

          {remoteUpdate ? (
            <View
              style={{
                gap: 6,
                padding: theme.spacing.sm,
                borderRadius: theme.radii.md,
                borderWidth: 1,
                borderColor: theme.colors.warning,
                backgroundColor: theme.colors.elevatedBackground,
              }}
            >
              <AppText variant="bodySmall" style={{ color: theme.colors.warning, fontWeight: '700' }}>
                Your partner changed this while you were drawing.
              </AppText>
              <AppText variant="caption" tone="muted">
                Your draft is still here. Saving is paused so neither version is silently overwritten.
              </AppText>
              <View style={{ alignSelf: 'flex-start' }}>
                <AppButton compact variant="secondary" label="Reload latest" onPress={onReloadLatest} />
              </View>
            </View>
          ) : null}

          <View style={{ flex: 1, justifyContent: 'center' }}>
            <DrawingCanvas
              strokes={strokes}
              currentUserId={currentUserId}
              height={canvasHeight}
              showTools
              compactTools
              onStroke={onStroke}
              strokeColorForUser={strokeColorForUser}
            />
          </View>

          <View style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <AppButton compact variant="ghost" label="Undo mine" disabled={!strokes.length || saving} onPress={onUndoMine} />
              <AppButton compact variant="ghost" label="Clear" disabled={!strokes.length || saving} onPress={onClear} />
            </View>
            <AppText variant="caption" tone={remoteUpdate ? 'muted' : dirty ? 'accent' : 'muted'}>
              {remoteUpdate ? 'Newer version available' : dirty ? 'Unsaved' : 'Saved'}
            </AppText>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
