import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AppText } from './AppText';
import { ScreenTitle } from './ScreenTitle';
import { useAppTheme } from '@/theme/useAppTheme';
import { useInteractionFeedback } from '@/hooks/useInteractionFeedback';
import { AppIcon } from '@/components/art/AppIcon';

// One compact navigation row replaces separate back, section and title rows.
export function BackHeader({ eyebrow, title, subtitle, onBack }: { eyebrow?: string; title: string; subtitle?: string; onBack?: () => void }) {
  const theme = useAppTheme();
  const feedback = useInteractionFeedback();
  return (
    <View style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={6}
          onPress={() => { feedback(); (onBack ?? (() => router.back()))(); }}
          style={{ width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <AppIcon name="back" size={20} color={theme.colors.textPrimary} />
        </Pressable>
        <ScreenTitle parent={eyebrow} title={title} />
      </View>
      {subtitle ? <AppText variant="bodySmall" tone="secondary">{subtitle}</AppText> : null}
    </View>
  );
}
