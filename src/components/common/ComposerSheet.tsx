import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View, type ViewStyle } from 'react-native';
import { AppIcon } from '@/components/art/AppIcon';
import { useInteractionFeedback } from '@/hooks/useInteractionFeedback';
import { useAppTheme } from '@/theme/useAppTheme';
import { AppText } from './AppText';
import { Card } from './Card';

export type ComposerSheetProps = {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  actionLabel?: string;
  closeLabel?: string;
  tone?: 'default' | 'accent' | 'secondary';
  style?: ViewStyle;
  showLauncher?: boolean;
};

// G6_COMPOSER_SHEETS: explicit shared create/edit sheet keeps the page stable while forms live in a keyboard-safe modal surface.
export function ComposerSheet({
  title,
  subtitle,
  open,
  onToggle,
  children,
  actionLabel = 'New',
  closeLabel = 'Close',
  tone = 'default',
  style,
  showLauncher = true,
}: ComposerSheetProps) {
  const theme = useAppTheme();
  const feedback = useInteractionFeedback();
  const isEditing = /^edit\b/i.test(title.trim());

  function toggle() {
    feedback();
    onToggle();
  }

  return (
    <>
      {showLauncher ? (
        <Card
          tone="default"
          style={style ? [{ paddingVertical: theme.spacing.sm }, style] : { paddingVertical: theme.spacing.sm }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${actionLabel}: ${title}`}
            accessibilityState={{ expanded: open }}
            onPress={toggle}
            style={({ pressed }) => ({
              minHeight: 46,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.md,
              opacity: pressed ? 0.74 : 1,
            })}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="section">{title}</AppText>
              {subtitle ? <AppText variant="bodySmall" tone="secondary" numberOfLines={1}>{subtitle}</AppText> : null}
            </View>

            <View
              style={{
                minHeight: 38,
                paddingHorizontal: 14,
                borderRadius: theme.radii.pill,
                borderWidth: 1,
                borderColor: theme.colors.accent,
                backgroundColor: theme.colors.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <AppIcon name="plus" size={14} color={theme.colors.accent} />
                <AppText variant="bodySmall" tone="accent">{actionLabel}</AppText>
              </View>
            </View>
          </Pressable>
        </Card>
      ) : null}

      <Modal
        visible={open}
        transparent
        animationType={theme.reducedMotion ? 'none' : 'slide'}
        onRequestClose={toggle}
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
              onPress={toggle}
              style={{ flex: 1 }}
            />

            <View
              style={{
                maxHeight: '92%',
                borderTopLeftRadius: theme.radii.xl,
                borderTopRightRadius: theme.radii.xl,
                borderWidth: 1,
                borderBottomWidth: 0,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.background,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: 42,
                  height: 4,
                  borderRadius: 2,
                  alignSelf: 'center',
                  backgroundColor: theme.colors.border,
                  marginTop: 9,
                }}
              />

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: theme.spacing.md,
                  paddingHorizontal: theme.spacing.lg,
                  paddingTop: theme.spacing.lg,
                  paddingBottom: theme.spacing.sm,
                }}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText variant="caption" tone={tone === 'accent' ? 'accent' : 'secondary'}>
                    {isEditing ? 'QUICK EDIT' : 'QUICK ADD'}
                  </AppText>
                  <AppText variant="pageTitle">{title}</AppText>
                  {subtitle ? <AppText variant="bodySmall" tone="secondary">{subtitle}</AppText> : null}
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={closeLabel}
                  hitSlop={10}
                  onPress={toggle}
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

              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                  paddingHorizontal: theme.spacing.lg,
                  paddingTop: theme.spacing.sm,
                  paddingBottom: theme.spacing.xxl,
                  gap: theme.spacing.lg,
                }}
              >
                {children}
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
