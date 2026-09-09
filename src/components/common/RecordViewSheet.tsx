import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { AppIcon } from '@/components/art/AppIcon';
import { useAppTheme } from '@/theme/useAppTheme';
import { AppText } from './AppText';

export function RecordViewSheet({
  visible,
  onClose,
  eyebrow,
  title,
  subtitle,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  const theme = useAppTheme();

  return (
    <Modal visible={visible} transparent animationType={theme.reducedMotion ? 'none' : 'slide'} statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close details" onPress={onClose} style={{ flex: 1 }} />
        <View
          style={{
            maxHeight: '88%',
            borderTopLeftRadius: theme.radii.xl,
            borderTopRightRadius: theme.radii.xl,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.background,
            paddingBottom: theme.spacing.xxl,
          }}
        >
          <View style={{ width: 42, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: theme.colors.border, marginTop: 9 }} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.md }}>
              <View style={{ flex: 1, gap: 4 }}>
                <AppText variant="caption" tone="secondary">{eyebrow.toUpperCase()}</AppText>
                <AppText variant="pageTitle">{title}</AppText>
                {subtitle ? <AppText variant="bodySmall" tone="secondary">{subtitle}</AppText> : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close details"
                hitSlop={10}
                onPress={onClose}
                style={({ pressed }) => ({
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.elevatedBackground,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <AppIcon name="close" size={17} color={theme.colors.textSecondary} />
              </Pressable>
            </View>
            {children}
            <AppText variant="caption" tone="muted">Close this view, then use ••• on the card for any edit or delete options.</AppText>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
