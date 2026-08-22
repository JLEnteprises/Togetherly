import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { AppText } from './AppText';
import { useAppTheme } from '@/theme/useAppTheme';
import { useInteractionFeedback } from '@/hooks/useInteractionFeedback';

export function BackHeader({ eyebrow, title, subtitle, onBack }: { eyebrow?: string; title: string; subtitle?: string; onBack?: () => void }) {
  const theme = useAppTheme();
  const feedback = useInteractionFeedback();
  return (
    <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.xxl }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={6}
        onPress={() => { feedback(); (onBack ?? (() => router.back()))(); }}
        style={{ alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingRight: 16 }}
      >
        <AppText tone="accent">‹ Back</AppText>
      </Pressable>
      <View style={{ gap: theme.spacing.xs }}>
        {eyebrow ? <AppText variant="caption" tone="accent">{eyebrow.toUpperCase()}</AppText> : null}
        <AppText variant="pageTitle" accessibilityRole="header">{title}</AppText>
        {subtitle ? <AppText tone="secondary">{subtitle}</AppText> : null}
      </View>
    </View>
  );
}
